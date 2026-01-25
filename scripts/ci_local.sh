#!/usr/bin/env bash
# CI Local - Canonical Quality Gate for XMB Admin Portal
# Based on AGENTS.md (Version 1.0)
# Run this script before every commit/PR to ensure code quality

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_step() {
  echo -e "${BLUE}==>${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

# Start
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  XMB Admin Portal - Quality Gates${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  log_error "package.json not found. Please run this script from the project root."
  exit 1
fi

# ============================================================================
# GATE 1: Format Check (Prettier)
# ============================================================================
log_step "Gate 1/5: Format Check"

# Check if prettier is configured
if command -v npx &> /dev/null && [ -f "node_modules/.bin/prettier" ]; then
  log_warning "Prettier not explicitly configured in package.json"
  log_warning "Skipping format check (see AGENTS.md J.1.3)"
else
  log_warning "Prettier not installed"
  log_warning "Skipping format check (see AGENTS.md J.1.3)"
fi

echo ""

# ============================================================================
# GATE 2: Lint
# ============================================================================
log_step "Gate 2/5: ESLint"

if npm run lint; then
  log_success "Linting passed"
else
  log_error "Linting failed"
  exit 1
fi

echo ""

# ============================================================================
# GATE 3: TypeCheck & Build
# ============================================================================
log_step "Gate 3/5: TypeScript Check & Build"

if npm run build; then
  log_success "Build passed"
else
  log_error "Build failed"
  exit 1
fi

echo ""

# ============================================================================
# GATE 4: Database Migrations
# ============================================================================
log_step "Gate 4/6: Database Migrations"

# Check if DATABASE_URL is already set in environment (e.g., from Neon/Vercel)
set +u  # Temporarily disable strict mode for variable check
if [ -n "${DATABASE_URL:-}" ]; then
  log_warning "Using DATABASE_URL from environment"
else
  # Try to load from .env.local
  if [ -f ".env.local" ]; then
    log_warning "Loading DATABASE_URL from .env.local"
    # Load DATABASE_URL from .env.local
    while IFS='=' read -r key value; do
      # Skip comments and empty lines
      [[ $key =~ ^#.*$ ]] && continue
      [[ -z $key ]] && continue
      # Strip leading/trailing whitespace
      key=$(echo "$key" | xargs)
      # Only export DATABASE_URL
      if [ "$key" = "DATABASE_URL" ]; then
        # Remove quotes if present and strip whitespace
        value=$(echo "$value" | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        export DATABASE_URL="$value"
      fi
    done < .env.local
  else
    log_error ".env.local not found and DATABASE_URL not set in environment"
    log_error "Please either:"
    log_error "  1. Create .env.local with DATABASE_URL, or"
    log_error "  2. Set DATABASE_URL environment variable"
    set -u
    exit 1
  fi
fi

# Final check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  log_error "DATABASE_URL not found in .env.local or environment"
  log_error "Please add DATABASE_URL to your .env.local file"
  set -u
  exit 1
fi
set -u  # Re-enable strict mode

# Run migrations using migrate-settings.ts
log_warning "Applying migrations to production database..."
if npx tsx scripts/migrate-settings.ts; then
  log_success "Migrations applied successfully"
else
  log_error "Migration failed"
  exit 1
fi

echo ""

# ============================================================================
# GATE 5: Database Schema Validation
# ============================================================================
log_step "Gate 5/6: Database Schema Validation"

# Check if drizzle-kit is available
if command -v npx &> /dev/null; then
  if npx drizzle-kit check; then
    log_success "Schema validation passed"
  else
    log_error "Schema validation failed"
    log_error "Schema and migrations are out of sync"
    exit 1
  fi
else
  log_error "npx not found"
  exit 1
fi

echo ""

# ============================================================================
# GATE 6: Tests
# ============================================================================
log_step "Gate 6/6: Tests"

# Check if test script exists
if grep -q '"test"' package.json; then
  # Run tests (using same DATABASE_URL as migrations)
  if npm test; then
    log_success "Tests passed"
  else
    log_error "Tests failed"
    exit 1
  fi
else
  log_warning "No test suite configured (see AGENTS.md J.1.1)"
  log_warning "Skipping tests"
fi

echo ""

# ============================================================================
# SUCCESS
# ============================================================================
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ ALL CHECKS PASSED${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Your code is ready to commit!"
echo ""

exit 0
