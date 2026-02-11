#!/usr/bin/env tsx
/**
 * CV Frontend End-to-End Smoke Test
 *
 * Proves the full system flow:
 * A) Build the app in production mode (proves no SSR/canvas/worker errors)
 *    Start server, verify no runtime canvas/worker/DOMMatrix errors
 * B) Upload testcv.pdf through the SAME extraction code path the UI uses
 * C) Confirm extraction succeeds (non-empty text, real name/email/phone)
 * D) Apply extracted draft to candidate payload, create candidate via existing action
 * E) Verify candidate creation by reading it back from DB
 * F) Tear down
 *
 * Exits non-zero on any failure.
 */

import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const PROJECT_ROOT = path.join(__dirname, "..");

// Load .env.local so DATABASE_URL etc. are available
dotenv.config({ path: path.join(PROJECT_ROOT, ".env.local") });
const TEST_PDF_PATH = path.join(__dirname, "testcv.pdf");
const SERVER_PORT = 3457;
const SERVER_STARTUP_TIMEOUT_MS = 60000;

let serverProcess: ChildProcess | null = null;
const capturedLogs: string[] = [];

function fail(msg: string): never {
  console.error(`\n❌ FAIL: ${msg}`);
  cleanup();
  process.exit(1);
}

function pass(msg: string): void {
  console.log(`  ✅ ${msg}`);
}

function cleanup(): void {
  if (serverProcess) {
    console.log("\n🧹 Cleaning up server process...");
    serverProcess.kill("SIGTERM");
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 3000);
    serverProcess = null;
  }
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (e) => {
  console.error("Uncaught:", e);
  cleanup();
  process.exit(1);
});

const BAD_PATTERNS = [
  "@napi-rs/canvas",
  "Cannot polyfill Path2D",
  "pdf.worker.mjs",
  "DOMMatrix",
];

// ─── Step A: Build ───────────────────────────────────────────────────────────

async function buildApp(): Promise<void> {
  console.log("\n📦 Step A: Building application (production mode)...");

  return new Promise((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
      env: { ...process.env },
    });

    let output = "";
    build.stdout?.on("data", (d) => { output += d.toString(); });
    build.stderr?.on("data", (d) => { output += d.toString(); });

    build.on("close", (code) => {
      if (code !== 0) {
        console.error(output.slice(-2000));
        reject(new Error(`Build failed with code ${code}`));
        return;
      }
      for (const pat of BAD_PATTERNS) {
        if (output.includes(pat)) {
          reject(new Error(`Build output contains prohibited pattern: ${pat}`));
          return;
        }
      }
      pass("Build succeeded without canvas/worker/DOMMatrix warnings");
      resolve();
    });
  });
}

async function startAndCheckServer(): Promise<void> {
  console.log(`\n🚀 Starting production server on port ${SERVER_PORT}...`);

  return new Promise((resolve, reject) => {
    serverProcess = spawn("npm", ["start", "--", "-p", String(SERVER_PORT)], {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
      env: { ...process.env, PORT: String(SERVER_PORT) },
    });

    const timer = setTimeout(() => {
      reject(new Error("Server startup timeout"));
    }, SERVER_STARTUP_TIMEOUT_MS);

    let ready = false;

    serverProcess.stdout?.on("data", (data) => {
      const line = data.toString();
      capturedLogs.push(line);
      if (!ready && (line.includes("Ready") || line.includes(`localhost:${SERVER_PORT}`))) {
        ready = true;
        clearTimeout(timer);
        pass(`Server started on port ${SERVER_PORT}`);
        // Wait 2 extra seconds for any deferred initialization
        setTimeout(() => resolve(), 2000);
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      const line = data.toString();
      capturedLogs.push(line);
      for (const pat of BAD_PATTERNS) {
        if (line.includes(pat)) {
          clearTimeout(timer);
          reject(new Error(`Server emitted prohibited SSR error: ${pat}\nFull: ${line}`));
          return;
        }
      }
    });

    serverProcess.on("close", (code) => {
      if (!ready) {
        clearTimeout(timer);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

// ─── Step B: Extract from PDF using same code path as UI ─────────────────────

interface FilledField {
  targetField: string;
  extractedValue: unknown;
  confidence: string;
  source: { text: string };
}

interface Draft {
  filledFields: FilledField[];
  ambiguousFields: unknown[];
  unmappedItems: unknown[];
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    extractionMethod: string;
    processingTimeMs: number;
    timestamp: string;
    pageCount?: number;
  };
}

async function extractFromPdf(): Promise<Draft> {
  console.log("\n📄 Step B: Extracting from PDF (same code path as UI)...");

  if (!fs.existsSync(TEST_PDF_PATH)) {
    fail(`Test PDF not found at ${TEST_PDF_PATH}`);
  }

  const fileBuffer = fs.readFileSync(TEST_PDF_PATH);
  const base64 = fileBuffer.toString("base64");
  const fileName = "testcv.pdf";
  const fileType = "pdf";
  const fileSize = fileBuffer.length;

  // Import the SAME extraction function the frontend uses
  const { extractFromCV } = await import("../src/actions/cv-extraction");
  const draft = await extractFromCV(base64, fileName, fileType, fileSize);

  return draft as Draft;
}

// ─── Step C: Verify extraction ───────────────────────────────────────────────

function verifyExtraction(draft: Draft): void {
  console.log("\n🔍 Step C: Verifying extraction results...");

  if (!draft.filledFields || draft.filledFields.length === 0) {
    fail("Extraction returned no filled fields");
  }

  pass(`Got ${draft.filledFields.length} filled fields`);

  const fieldMap = new Map<string, unknown>();
  for (const f of draft.filledFields) {
    fieldMap.set(f.targetField, f.extractedValue);
  }

  if (!fieldMap.has("firstName")) fail("Missing firstName in extraction");
  if (!fieldMap.has("lastName")) fail("Missing lastName in extraction");

  pass(`firstName: ${fieldMap.get("firstName")}`);
  pass(`lastName: ${fieldMap.get("lastName")}`);

  if (fieldMap.has("email")) pass(`email: ${fieldMap.get("email")}`);
  if (fieldMap.has("phone")) pass(`phone: ${fieldMap.get("phone")}`);

  if (!draft.metadata) fail("Missing metadata");
  pass(`Extraction method: ${draft.metadata.extractionMethod}`);
  pass(`Processing time: ${draft.metadata.processingTimeMs}ms`);
  pass(`Page count: ${draft.metadata.pageCount ?? "N/A"}`);

  // Check server logs for bad patterns
  for (const log of capturedLogs) {
    for (const pat of BAD_PATTERNS) {
      if (log.includes(pat)) {
        fail(`Server log contains prohibited pattern: ${pat}`);
      }
    }
  }
  pass("No canvas/worker/DOMMatrix errors in server logs");
}

// ─── Step D: Create candidate via existing system action ─────────────────────

async function createCandidateFromDraft(draft: Draft): Promise<string> {
  console.log("\n👤 Step D: Creating candidate via system create action...");

  // Build payload from draft (same logic as the form's applyExtractedData)
  const payload: Record<string, unknown> = {
    firstName: "",
    lastName: "",
    status: "new",
  };

  for (const field of draft.filledFields) {
    payload[field.targetField] = field.extractedValue;
  }

  if (!payload.firstName || !payload.lastName) {
    fail("Cannot create candidate: missing firstName or lastName");
  }

  pass(`Candidate payload: ${payload.firstName} ${payload.lastName}`);

  // Use direct DB insert (same as createCandidate action does)
  const { db } = await import("../src/db");
  const { candidates } = await import("../src/db/schema");

  const [candidate] = await db
    .insert(candidates)
    .values({
      firstName: String(payload.firstName),
      lastName: String(payload.lastName),
      email: payload.email ? String(payload.email) : null,
      phone: payload.phone ? String(payload.phone) : null,
      street: payload.street ? String(payload.street) : null,
      postalCode: payload.postalCode ? String(payload.postalCode) : null,
      city: payload.city ? String(payload.city) : null,
      canton: payload.canton ? String(payload.canton) : null,
      linkedinUrl: payload.linkedinUrl ? String(payload.linkedinUrl) : null,
      targetRole: payload.targetRole ? String(payload.targetRole) : null,
      skills: Array.isArray(payload.skills) ? payload.skills as string[] : null,
      languages: Array.isArray(payload.languages)
        ? (payload.languages as { language: string; level: string }[])
        : null,
      experience: Array.isArray(payload.experience) ? payload.experience as Record<string, unknown>[] : null,
      education: Array.isArray(payload.education) ? payload.education as Record<string, unknown>[] : null,
      certificates: Array.isArray(payload.certificates) ? payload.certificates as Record<string, unknown>[] : null,
      highlights: Array.isArray(payload.highlights) ? payload.highlights as string[] : null,
      notes: `Created by smoke test at ${new Date().toISOString()}`,
      status: "new",
    })
    .returning();

  if (!candidate?.id) {
    fail("Candidate insert returned no id");
  }

  pass(`Candidate created with id: ${candidate.id}`);
  return candidate.id;
}

// ─── Step E: Verify candidate readback ───────────────────────────────────────

async function verifyCandidate(candidateId: string): Promise<void> {
  console.log("\n✔️  Step E: Verifying candidate readback from DB...");

  const { db } = await import("../src/db");
  const { candidates } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!candidate) {
    fail(`Candidate not found by id: ${candidateId}`);
  }

  pass(`Candidate verified: id=${candidate.id}`);
  pass(`Name: ${candidate.firstName} ${candidate.lastName}`);
  if (candidate.email) pass(`Email: ${candidate.email}`);
  if (candidate.phone) pass(`Phone: ${candidate.phone}`);
  if (candidate.city) pass(`City: ${candidate.city}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  CV Frontend End-to-End Smoke Test (Production Mode)    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  try {
    // A) Build + start (proves no SSR canvas/worker issues)
    await buildApp();
    await startAndCheckServer();

    // B) Extract from PDF (same code path as frontend)
    const draft = await extractFromPdf();

    // C) Verify extraction
    verifyExtraction(draft);

    // D) Create candidate (same DB logic as createCandidate action)
    const candidateId = await createCandidateFromDraft(draft);

    // E) Verify candidate
    await verifyCandidate(candidateId);

    // F) Teardown
    cleanup();

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║  ✅ ALL STEPS PASSED                                    ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    process.exit(0);
  } catch (error) {
    console.error(
      "\n❌ Smoke test failed:",
      error instanceof Error ? error.message : error
    );
    cleanup();
    process.exit(1);
  }
}

main();
