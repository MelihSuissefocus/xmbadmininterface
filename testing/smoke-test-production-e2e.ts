#!/usr/bin/env tsx
/**
 * PRODUCTION End-to-End Smoke Test for CV Upload/Extraction
 *
 * This test MUST run in production mode to reproduce SSR issues:
 * - Builds the app (npm run build)
 * - Starts production server (npm start)
 * - Tests via HTTP (same as real frontend)
 * - Verifies NO SSR/canvas/worker errors
 *
 * CRITICAL: This tests the ACTUAL frontend flow, not just server actions!
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const PROJECT_ROOT = path.join(__dirname, '..');
const TEST_PDF_PATH = path.join(__dirname, 'testcv.pdf');
const SERVER_PORT = 3456; // Use non-standard port to avoid conflicts
const BASE_URL = `http://localhost:${SERVER_PORT}`;

interface CandidateAutoFillDraft {
  filledFields: Array<{
    targetField: string;
    extractedValue: unknown;
    confidence: string;
    source: { text: string };
  }>;
  ambiguousFields: unknown[];
  unmappedItems: unknown[];
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    extractionMethod: string;
    processingTimeMs: number;
    timestamp: string;
  };
}

let serverProcess: ChildProcess | null = null;
const capturedLogs: string[] = [];

/**
 * Step 1: Build the application
 */
async function buildApp(): Promise<void> {
  console.log('\n📦 Step 1: Building application (production mode)');
  console.log('  Command: npm run build');

  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });

    buildProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Build failed with code ${code}`));
      } else {
        console.log('  ✓ Build completed successfully');
        resolve();
      }
    });

    buildProcess.on('error', (error) => {
      reject(new Error(`Build process error: ${error.message}`));
    });
  });
}

/**
 * Step 2: Start production server
 */
async function startProductionServer(): Promise<void> {
  console.log('\n🚀 Step 2: Starting production server');
  console.log(`  Port: ${SERVER_PORT}`);

  return new Promise((resolve, reject) => {
    serverProcess = spawn('npm', ['start', '--', '-p', String(SERVER_PORT)], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PORT: String(SERVER_PORT) },
    });

    let hasStarted = false;
    const startTimeout = setTimeout(() => {
      if (!hasStarted) {
        reject(new Error('Server startup timeout (30s)'));
      }
    }, 30000);

    // Capture stdout
    serverProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      capturedLogs.push(text);

      // Check for server ready indicators
      if (
        text.includes('Ready') ||
        text.includes('started server on') ||
        text.includes(`http://localhost:${SERVER_PORT}`)
      ) {
        if (!hasStarted) {
          hasStarted = true;
          clearTimeout(startTimeout);
          console.log('  ✓ Server started successfully');
          // Wait a bit more for full initialization
          setTimeout(resolve, 2000);
        }
      }
    });

    // Capture stderr (Next.js logs warnings/errors here)
    serverProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      capturedLogs.push(text);

      // Also check stderr for ready message (Next.js might use stderr)
      if (
        text.includes('Ready') ||
        text.includes('started server on') ||
        text.includes(`http://localhost:${SERVER_PORT}`)
      ) {
        if (!hasStarted) {
          hasStarted = true;
          clearTimeout(startTimeout);
          console.log('  ✓ Server started successfully');
          setTimeout(resolve, 2000);
        }
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(startTimeout);
      reject(new Error(`Server process error: ${error.message}`));
    });

    serverProcess.on('close', (code) => {
      if (!hasStarted) {
        clearTimeout(startTimeout);
        reject(new Error(`Server exited early with code ${code}`));
      }
    });
  });
}

/**
 * Step 3: Upload PDF via HTTP API
 */
async function uploadPDFViaHTTP(): Promise<CandidateAutoFillDraft> {
  console.log('\n📤 Step 3: Upload PDF via HTTP API');
  console.log(`  Endpoint: POST ${BASE_URL}/api/cv-extract`);

  if (!fs.existsSync(TEST_PDF_PATH)) {
    throw new Error(`Test file not found: ${TEST_PDF_PATH}`);
  }

  const fileBuffer = fs.readFileSync(TEST_PDF_PATH);
  console.log(`  File: testcv.pdf (${fileBuffer.length} bytes)`);

  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    const fileName = 'testcv.pdf';

    // Build multipart/form-data body
    const formData: Buffer[] = [];
    formData.push(Buffer.from(`--${boundary}\r\n`));
    formData.push(
      Buffer.from(
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`
      )
    );
    formData.push(Buffer.from('Content-Type: application/pdf\r\n\r\n'));
    formData.push(fileBuffer);
    formData.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(formData);

    const options = {
      hostname: 'localhost',
      port: SERVER_PORT,
      path: '/api/cv-extract',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 30000, // 30 second timeout
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);

          if (res.statusCode !== 200) {
            console.error('  ✗ HTTP error:', res.statusCode);
            console.error('  Response:', result);
            reject(
              new Error(`HTTP ${res.statusCode}: ${result.error || 'Unknown error'}`)
            );
            return;
          }

          if (!result.success || !result.draft) {
            console.error('  ✗ API returned error:', result.error);
            reject(new Error(result.error || 'Extraction failed'));
            return;
          }

          console.log(`  ✓ Extraction successful`);
          console.log(`  ✓ Extracted ${result.draft.filledFields.length} fields`);
          resolve(result.draft);
        } catch (error) {
          console.error('  ✗ Failed to parse response:', responseData);
          reject(new Error(`Invalid JSON response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('  ✗ Request error:', error.message);
      reject(new Error(`HTTP request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP request timeout (30s)'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Step 4: Verify extraction results
 */
function verifyExtraction(draft: CandidateAutoFillDraft): void {
  console.log('\n✅ Step 4: Verify extraction results');

  // Check for critical errors in server logs
  const criticalErrors = capturedLogs.filter(
    (log) =>
      log.includes("Cannot load '@napi-rs/canvas'") ||
      log.includes('Cannot polyfill Path2D') ||
      log.includes('Setting up fake worker failed') ||
      log.includes('missing pdf.worker.mjs') ||
      (log.includes('Failed to extract text from PDF') &&
        !log.includes('Warning: Setting up fake worker'))
  );

  if (criticalErrors.length > 0) {
    console.error('  ✗ CRITICAL ERRORS FOUND IN SERVER LOGS:');
    criticalErrors.forEach((err) => console.error('    ', err.trim()));
    throw new Error('Critical SSR/canvas/worker errors detected!');
  }

  console.log('  ✓ No critical SSR/canvas/worker errors in logs');

  // Verify extraction content
  if (draft.filledFields.length === 0) {
    throw new Error('No fields extracted from PDF!');
  }

  console.log(`  ✓ ${draft.filledFields.length} fields extracted`);

  // Check for email (required field)
  const emailField = draft.filledFields.find(
    (f) => f.targetField === 'email'
  );
  if (!emailField || !emailField.extractedValue) {
    console.error('  ✗ Email not extracted!');
    console.error('  Extracted fields:', draft.filledFields.map((f) => f.targetField));
    throw new Error('Email not extracted from PDF!');
  }

  console.log(`  ✓ Email extracted: ${emailField.extractedValue}`);

  // Check for name fields
  const firstNameField = draft.filledFields.find(
    (f) => f.targetField === 'firstName'
  );
  const lastNameField = draft.filledFields.find(
    (f) => f.targetField === 'lastName'
  );

  if (firstNameField) {
    console.log(`  ✓ First name extracted: ${firstNameField.extractedValue}`);
  }
  if (lastNameField) {
    console.log(`  ✓ Last name extracted: ${lastNameField.extractedValue}`);
  }

  console.log(`  ✓ Extraction method: ${draft.metadata.extractionMethod}`);
  console.log(`  ✓ Processing time: ${draft.metadata.processingTimeMs}ms`);
}

/**
 * Step 5: Create candidate via existing system
 */
async function createCandidate(
  draft: CandidateAutoFillDraft
): Promise<string> {
  console.log('\n💾 Step 5: Create candidate via system flow');

  // Load environment
  const dotenv = await import('dotenv');
  const envPath = path.join(PROJECT_ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  // Import DB directly
  const { db } = await import('../src/db');
  const { candidates } = await import('../src/db/schema');

  // Build candidate data from draft
  const candidateData: Record<string, string> = {
    targetRole: 'System Engineer (Production E2E Test)',
    notes: 'Created via production E2E test - safe to delete',
  };

  // Apply extracted fields
  for (const field of draft.filledFields) {
    if (
      field.targetField === 'firstName' &&
      typeof field.extractedValue === 'string'
    ) {
      candidateData['firstName'] = field.extractedValue;
    } else if (
      field.targetField === 'lastName' &&
      typeof field.extractedValue === 'string'
    ) {
      candidateData['lastName'] = field.extractedValue;
    } else if (
      field.targetField === 'email' &&
      typeof field.extractedValue === 'string'
    ) {
      candidateData['email'] = field.extractedValue;
    } else if (
      field.targetField === 'phone' &&
      typeof field.extractedValue === 'string'
    ) {
      candidateData['phone'] = field.extractedValue;
    }
  }

  // Ensure required fields
  if (!candidateData['firstName']) candidateData['firstName'] = 'PRODUCTION';
  if (!candidateData['lastName']) candidateData['lastName'] = 'E2ETEST';
  if (!candidateData['email'])
    candidateData['email'] = `prod-test-${Date.now()}@e2etest.com`;

  console.log(
    `  Creating: ${candidateData.firstName} ${candidateData.lastName}`
  );

  try {
    const [candidate] = await db
      .insert(candidates)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(candidateData as any)
      .returning();

    if (!candidate || !candidate.id) {
      throw new Error('Candidate creation failed: no ID returned');
    }

    console.log(`  ✓ Candidate created: ${candidate.id}`);
    return candidate.id;
  } catch (error) {
    console.error('  ✗ Creation failed:', error);
    throw new Error(`Candidate creation failed: ${error}`);
  }
}

/**
 * Step 6: Verify candidate in database
 */
async function verifyCandidate(candidateId: string): Promise<void> {
  console.log('\n✅ Step 6: Verify candidate in database');

  const { getCandidateById } = await import('../src/actions/candidates');

  const candidate = await getCandidateById(candidateId);

  if (!candidate) {
    throw new Error(`Candidate ${candidateId} not found!`);
  }

  console.log(`  ✓ Verified: ${candidate.firstName} ${candidate.lastName}`);
  console.log(`  ✓ Email: ${candidate.email}`);
}

/**
 * Cleanup: Stop server and delete test candidate
 */
async function cleanup(candidateId?: string): Promise<void> {
  console.log('\n🧹 Cleanup');

  // Delete test candidate
  if (candidateId) {
    try {
      const { db } = await import('../src/db');
      const { candidates } = await import('../src/db/schema');
      const { eq } = await import('drizzle-orm');

      await db.delete(candidates).where(eq(candidates.id, candidateId));
      console.log(`  ✓ Deleted test candidate: ${candidateId}`);
    } catch (error) {
      console.warn(`  ⚠ Could not delete candidate: ${error}`);
    }
  }

  // Stop server
  if (serverProcess) {
    console.log('  Stopping server...');
    serverProcess.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('  ⚠ Server did not stop gracefully, forcing...');
        serverProcess?.kill('SIGKILL');
        resolve();
      }, 5000);

      serverProcess?.on('close', () => {
        clearTimeout(timeout);
        console.log('  ✓ Server stopped');
        resolve();
      });
    });

    serverProcess = null;
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('🚀 CV Upload/Extraction - PRODUCTION E2E Smoke Test');
  console.log('═'.repeat(70));
  console.log('This test runs in REAL production mode to detect SSR issues!');
  console.log('═'.repeat(70));

  let candidateId: string | undefined;

  try {
    // Step 1: Build
    await buildApp();

    // Step 2: Start server
    await startProductionServer();

    // Step 3: Upload PDF
    const draft = await uploadPDFViaHTTP();

    // Step 4: Verify extraction
    verifyExtraction(draft);

    // Step 5: Create candidate
    candidateId = await createCandidate(draft);

    // Step 6: Verify candidate
    await verifyCandidate(candidateId);

    console.log('\n' + '═'.repeat(70));
    console.log('🎉 ALL PRODUCTION E2E TESTS PASSED!');
    console.log('═'.repeat(70));
    console.log('✓ Build successful');
    console.log('✓ Production server started');
    console.log('✓ PDF uploaded via HTTP');
    console.log('✓ Extraction successful (no SSR errors)');
    console.log('✓ Candidate created');
    console.log('✓ Candidate verified');
    console.log('═'.repeat(70));

    await cleanup(candidateId);

    console.log('\nCV_FRONTEND_END2END_FIXED');
    process.exit(0);
  } catch (error) {
    console.error('\n' + '═'.repeat(70));
    console.error('❌ PRODUCTION E2E TEST FAILED');
    console.error('═'.repeat(70));
    console.error(error);
    console.error('═'.repeat(70));

    await cleanup(candidateId);

    process.exit(1);
  }
}

// Handle interrupt
process.on('SIGINT', async () => {
  console.log('\n\nTest interrupted by user');
  await cleanup();
  process.exit(1);
});

// Run test
main();
