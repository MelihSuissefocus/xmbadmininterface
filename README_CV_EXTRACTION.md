# CV Extraction System v2.2 (LLM-Enhanced)

## Definition of Done Checklist

| Requirement | Status | Details |
|-------------|--------|---------|
| **PII-safe logging** | ✅ | Central logger (`src/lib/logger.ts`) with redaction for emails, phones, names, addresses, SSN, AHV numbers |
| **Per-user rate limit** | ✅ | 10 analyses/min via `checkRateLimit()` |
| **Per-user daily quota** | ✅ | 100 analyses/day via `checkDailyQuota()` |
| **Per-tenant configurable quota** | ✅ | Stored in `tenant_quota_config` table, default 500/day |
| **SHA256 deduplication** | ✅ | File hash computed, cached results reused for 1 hour |
| **Overall analysis timeout** | ✅ | 60s hard limit enforced via `AbortController` |
| **Poller max wait** | ✅ | 25s limit in Azure DI client |
| **Structured error handling** | ✅ | `CVError` class with user-safe messages (DE) and error codes |
| **Auth required for /api/cv-extract** | ✅ | No public API route exists; server actions require session + role check |
| **Magic-byte validation** | ✅ | `validateFileMagicBytes()` before processing |
| **Filename sanitization** | ✅ | `sanitizeFilename()` removes path traversal |
| **Metrics counters** | ✅ | Success/failure, latency, pages, autofill_rate, review_rate in `src/lib/metrics.ts` |
| **Non-PII analytics** | ✅ | Daily aggregates in `cv_analytics_daily` table |
| **No file storage** | ✅ | Files processed in memory only |
| **AV scan hook placeholder** | ✅ | See [Placeholders](#placeholders) section |
| **LLM integration (v2.2)** | ✅ | Azure OpenAI GPT-4.1-nano for semantic extraction |
| **No hallucinations** | ✅ | Evidence-based extraction with validation |
| **Name vs title filter** | ✅ | Job titles rejected as person names |
| **Cost control** | ✅ | Text packing to <8k tokens per CV |

## Breaking Changes (v2.0 → v2.1)

1. **New database tables required:**
   - `tenant_quota_config` - Configurable per-tenant quotas
   - `cv_analytics_daily` - Daily analytics aggregates

2. **Schema changes to `cv_analysis_jobs`:**
   - Added: `tenant_id`, `file_hash`, `error_code`, `latency_ms`, `page_count`, `autofill_field_count`, `review_field_count`

3. **API response structure changed:**
   - Error responses now include `code`, `retryable`, and user-friendly German messages
   - `getCvAnalysisJobStatus` returns `errorCode` and `retryable` fields

4. **Rate limiting behavior:**
   - Now enforces daily limits per user (100/day) in addition to rate limits (10/min)
   - Tenant-level quotas can block all users in a tenant

**Migration required:** Run `drizzle/0004_production_hardening.sql`

---

## Overview

This document describes the CV auto-fill feature powered by **Azure AI Document Intelligence**. The system extracts structured data from uploaded CV documents (PDF, DOCX, PNG, JPG) and maps them to candidate form fields.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ CV Upload    │───▶│ Server       │───▶│ CV Mapping Modal     │   │
│  │ Button       │    │ Actions      │    │ (Review & Confirm)   │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Server Actions                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Rate Limit   │───▶│ Quota Check  │───▶│ Dedupe Check         │   │
│  │ Check        │    │ (User+Tenant)│    │ (SHA256 hash)        │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
│         │                                          │                │
│         ▼                                          ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Magic Byte   │───▶│ Create Job   │───▶│ processCvAnalysisJob │   │
│  │ Validation   │    │ (DB)         │    │ (async, 30s timeout) │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Azure Document Intelligence                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ prebuilt-    │───▶│ Extract      │───▶│ Return DocumentRep   │   │
│  │ layout       │    │ Key-Values,  │    │ (25s poller timeout) │   │
│  │ model        │    │ Tables, Text │    │                      │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Environment Variables

Add these to your `.env.local`:

```env
# Azure Document Intelligence Configuration (Required)
AZURE_DI_ENDPOINT=https://documentai-xmb.cognitiveservices.azure.com/
AZURE_DI_KEY=<your-api-key>

# Azure OpenAI Configuration (Optional - for LLM-enhanced extraction)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=<your-openai-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4.1-nano
AZURE_OPENAI_API_VERSION=2024-08-01-preview  # Optional, default: 2024-08-01-preview

# Feature Flags
CV_LLM_ENABLED=true  # Set to true to enable LLM extraction

# Optional: Log level (debug, info, warn, error)
LOG_LEVEL=info
```

**Notes:**
- Use `key1` or `key2` from your Azure DI resource for `AZURE_DI_KEY`
- The LLM extraction is **optional** - set `CV_LLM_ENABLED=false` or omit OpenAI vars to use rule-based extraction only

## Security Features

### 1. Authentication & Authorization

- All CV analysis endpoints require an authenticated session
- Only users with `admin` or `recruiter` roles can analyze CVs
- Server actions verify role on every request

### 2. Rate Limiting & Quotas

| Limit Type | Default | Configurable |
|------------|---------|--------------|
| Per-user per minute | 10 requests | Hardcoded |
| Per-user per day | 100 requests | Hardcoded |
| Per-tenant per day | 500 requests | Via `tenant_quota_config` table |

### 3. File Validation

- **Magic byte validation:** Content verified against expected file signatures
- **Size limit:** 10MB maximum
- **Page limit:** 20 pages maximum
- **Allowed types:** PDF, DOCX, PNG, JPG/JPEG

### 4. Filename Sanitization

```typescript
// Removes path traversal, special characters
"../../../etc/passwd.pdf" → "etc_passwd.pdf"
```

### 5. Idempotency (Deduplication)

- SHA256 hash computed for each file
- If same hash + user processed within 1 hour, cached result returned
- Prevents duplicate processing and saves Azure DI costs

### 6. No File Storage

- Original CV files are **NOT** stored
- Files are processed in memory only
- Only extracted metadata is persisted in `parsed_data` JSON

### 7. PII Redaction in Logs

All logs use the central logger which redacts:
- Email addresses → `[EMAIL]`
- Phone numbers → `[PHONE]`
- Credit card numbers → `[CARD]`
- SSN → `[SSN]`
- Swiss AHV numbers → `[AHV]`
- Name patterns → `[NAME]`
- Address patterns → `[ADDRESS]`, `[STREET]`

### 8. Timeouts

| Timeout | Value | Purpose |
|---------|-------|---------|
| Overall analysis | 30s | Hard limit for entire operation |
| Azure DI poller | 25s | Max wait for Azure response |
| Dedupe cache TTL | 1 hour | How long cached results persist |

## Observability

### Metrics Collected

| Metric | Type | Description |
|--------|------|-------------|
| `cv_analysis_started_total` | Counter | Total analysis jobs started |
| `cv_analysis_success_total` | Counter | Successful completions |
| `cv_analysis_failed_total` | Counter | Failed analyses (by error code) |
| `cv_analysis_timeout_total` | Counter | Timeout failures |
| `cv_analysis_dedupe_hit_total` | Counter | Cache hits |
| `cv_analysis_rate_limited_total` | Counter | Rate limit rejections |
| `cv_analysis_quota_exceeded_total` | Counter | Quota exceeded (by type) |
| `cv_analysis_latency_ms` | Histogram | End-to-end latency |
| `cv_analysis_pages` | Histogram | Pages per document |
| `cv_extraction_autofill_fields` | Counter | Fields auto-filled |
| `cv_extraction_review_fields` | Counter | Fields requiring review |

### Daily Analytics Table

Non-PII aggregates stored in `cv_analytics_daily`:

```sql
SELECT date, success_count, failure_count, timeout_count, 
       total_latency_ms / NULLIF(success_count, 0) as avg_latency_ms
FROM cv_analytics_daily
WHERE tenant_id = '...'
ORDER BY date DESC;
```

### Log Format

```
[2026-01-25T10:30:00.000Z] [INFO] [CV-EXTRACTION] CV analysis completed {"jobId":"xxx","durationMs":2340,"pageCount":3}
```

## Error Handling

All errors return structured responses with user-safe German messages:

```typescript
interface ErrorResponse {
  success: false;
  message: string;     // User-friendly DE message
  code: CVErrorCode;   // Machine-readable code
  retryable: boolean;  // Can user retry?
}
```

### Error Codes

| Code | HTTP | User Message (DE) | Retryable |
|------|------|-------------------|-----------|
| `AUTH_REQUIRED` | 401 | Bitte melden Sie sich an. | No |
| `AUTH_INSUFFICIENT` | 403 | Sie haben keine Berechtigung für diese Aktion. | No |
| `RATE_LIMITED` | 429 | Zu viele Anfragen. Bitte warten Sie einen Moment. | Yes |
| `DAILY_QUOTA_EXCEEDED` | 429 | Tageslimit erreicht. Versuchen Sie es morgen erneut. | No |
| `TENANT_QUOTA_EXCEEDED` | 429 | Das Kontingent für Ihre Organisation wurde erreicht. | No |
| `FILE_TOO_LARGE` | 413 | Die Datei ist zu groß. Maximum: 10 MB. | No |
| `FILE_INVALID_TYPE` | 415 | Nur PDF, PNG, JPG oder DOCX erlaubt. | No |
| `FILE_MAGIC_MISMATCH` | 415 | Die Datei scheint beschädigt oder ungültig zu sein. | No |
| `FILE_TOO_MANY_PAGES` | 413 | Das Dokument hat zu viele Seiten. Maximum: 20. | No |
| `ANALYSIS_TIMEOUT` | 504 | Die Analyse hat zu lange gedauert. Bitte versuchen Sie es erneut. | Yes |
| `ANALYSIS_FAILED` | 500 | Die Analyse ist fehlgeschlagen. Bitte versuchen Sie es erneut. | Yes |
| `AZURE_AUTH_FAILED` | 500 | Ein Systemfehler ist aufgetreten. Bitte kontaktieren Sie den Support. | No |
| `AZURE_RATE_LIMITED` | 503 | Der Dienst ist überlastet. Bitte versuchen Sie es später erneut. | Yes |
| `JOB_NOT_FOUND` | 404 | Die Analyse wurde nicht gefunden. | No |
| `INTERNAL_ERROR` | 500 | Ein unerwarteter Fehler ist aufgetreten. | No |

## Database Schema

### cv_analysis_jobs Table (Updated)

```sql
CREATE TABLE cv_analysis_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  status cv_analysis_status NOT NULL DEFAULT 'pending',
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT,                    -- SHA256 for deduplication
  result JSONB,
  error TEXT,
  error_code TEXT,                   -- Machine-readable error code
  latency_ms INTEGER,                -- End-to-end processing time
  page_count INTEGER,                -- Document page count
  autofill_field_count INTEGER,      -- Fields auto-filled
  review_field_count INTEGER,        -- Fields requiring review
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### tenant_quota_config Table

```sql
CREATE TABLE tenant_quota_config (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  daily_analysis_quota INTEGER NOT NULL DEFAULT 500,
  max_file_size_mb INTEGER DEFAULT 10,
  max_pages INTEGER DEFAULT 20,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### cv_analytics_daily Table

```sql
CREATE TABLE cv_analytics_daily (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  timeout_count INTEGER DEFAULT 0,
  dedupe_hit_count INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  total_autofill_fields INTEGER DEFAULT 0,
  total_review_fields INTEGER DEFAULT 0,
  created_at TIMESTAMP
);

CREATE INDEX cv_analytics_daily_tenant_date_idx ON cv_analytics_daily(tenant_id, date);
```

## API Reference

### Server Actions

#### `createCvAnalysisJob`

Creates a new CV analysis job with full validation and quota checks.

```typescript
async function createCvAnalysisJob(
  base64: string,        // Base64-encoded file content
  fileName: string,      // Original filename (will be sanitized)
  fileExtension: string, // File extension (pdf, docx, png, jpg)
  fileSize: number       // File size in bytes
): Promise<ActionResult<{ jobId: string; cached?: boolean }>>
```

**Returns on success:**
- `cached: true` if result came from deduplication cache

**Error codes returned:**
- `AUTH_REQUIRED`, `AUTH_INSUFFICIENT`
- `RATE_LIMITED`, `DAILY_QUOTA_EXCEEDED`, `TENANT_QUOTA_EXCEEDED`
- `FILE_TOO_LARGE`, `FILE_INVALID_TYPE`, `FILE_MAGIC_MISMATCH`

#### `getCvAnalysisJobStatus`

Gets the status and result of an analysis job.

```typescript
async function getCvAnalysisJobStatus(
  jobId: string
): Promise<ActionResult<JobStatusResult>>

interface JobStatusResult {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: CandidateAutoFillDraftV2;
  error?: string;
  errorCode?: string;     // Machine-readable code
  retryable?: boolean;    // Can user retry?
  createdAt: Date;
  completedAt?: Date | null;
}
```

## Placeholders

### AV Scan Hook

```typescript
// TODO: Implement antivirus scan hook
// Location: src/lib/file-validation.ts
// 
// async function scanForMalware(bytes: Uint8Array): Promise<{ safe: boolean; threat?: string }> {
//   // Integrate with ClamAV, VirusTotal, or cloud provider's malware scanning
//   // Call before Azure DI processing
//   return { safe: true };
// }
//
// Integration point in cv-analysis.ts:
// const scanResult = await scanForMalware(fileBytes);
// if (!scanResult.safe) {
//   throw new CVError("FILE_MALWARE_DETECTED", { threat: scanResult.threat });
// }
```

## Migration from v2.0

1. Run the migration:
   ```bash
   # Using psql
   psql $DATABASE_URL -f drizzle/0004_production_hardening.sql
   
   # Or using npm
   npm run db:push
   ```

2. Configure tenant quotas (optional):
   ```sql
   INSERT INTO tenant_quota_config (tenant_id, daily_analysis_quota)
   VALUES ('your-tenant-uuid', 1000);
   ```

## LLM-Enhanced Extraction (v2.2)

### How It Works

When `CV_LLM_ENABLED=true` and Azure OpenAI is configured:

1. **Azure DI** processes the document → produces `DocumentRep` with OCR, layout, polygons
2. **Packing module** compresses content to ~8k tokens (header lines, contact info, sections)
3. **Azure OpenAI GPT-4.1-nano** extracts structured data with evidence references
4. **Validation** filters out job titles as names, normalizes phone/email, checks evidence
5. **Merge** combines LLM results with deterministic email/phone extraction (deterministic takes precedence)
6. **Scoring** assigns confidence scores: ≥0.90 autofill, 0.70-0.89 review, <0.70 skip

### Cost Control

Target: **≤ CHF 0.10 per CV**

Achieved via text packing:
- Header lines: max 40 lines from first page
- Contact lines: max 30 lines containing email/phone/URL
- Key-value pairs: max 40 relevant KVPs
- Sections: max 250 lines total across experience/education/skills/languages
- Hard cap: 8,000 tokens input

### No Hallucinations Guarantee

- Every extracted value **must** reference a `lineId` from the packed input
- Values without evidence are filtered or flagged for review
- Job titles (e.g., "System Engineer") are never accepted as names
- If uncertain, LLM outputs `null` and adds field to `needs_review_fields`

### Fallback Behavior

If LLM fails (timeout, auth error, invalid response):
1. Deterministic email/phone extraction is preserved
2. All other fields are marked as `needs_review`
3. User can manually complete the form

### Testing

Run LLM extraction tests:
```bash
npm test -- src/lib/__tests__/llm-extraction.test.ts
```

Tests cover:
- Name vs job title misclassification prevention
- Experience extraction from section input
- Schema validation and evidence requirements

## Limitations

1. **Scanned PDFs:** While Azure DI handles OCR, very low-quality scans may produce poor results
2. **Non-standard CV formats:** Highly creative CV layouts may not extract well
3. **Languages:** Optimized for German (DE) and English (EN) documents
4. **Complex tables:** Nested or merged cells may not extract perfectly
5. **Handwritten content:** Not supported
6. **Rate limits:** Per-user limits may affect power users during bulk uploads
7. **LLM costs:** ~CHF 0.05-0.10 per CV with GPT-4.1-nano

## Support

For issues with CV extraction:

1. Check Azure DI service status
2. Verify environment variables are set
3. Check `errorCode` in job status for specific failure reason
4. Review daily analytics for patterns
5. Check rate limits haven't been exceeded (error code `RATE_LIMITED` or `DAILY_QUOTA_EXCEEDED`)
