#!/usr/bin/env tsx
/**
 * Test Real Upload via Server Actions
 * Tests the actual upload flow that the UI uses
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function testRealUpload() {
  console.log('🧪 Testing Real CV Upload Flow\n');

  const testPdfPath = path.join(__dirname, 'testcv.pdf');
  if (!fs.existsSync(testPdfPath)) {
    throw new Error(`Test file not found: ${testPdfPath}`);
  }

  const fileBuffer = fs.readFileSync(testPdfPath);
  console.log(`📄 Test file: ${testPdfPath}`);
  console.log(`📦 File size: ${fileBuffer.length} bytes\n`);

  try {
    // Step 1: Upload via uploadCV action
    console.log('1️⃣ Uploading PDF via uploadCV action...');
    const { uploadCV } = await import('../src/actions/cv-upload');

    const formData = new FormData();
    const file = new File([fileBuffer], 'testcv.pdf', { type: 'application/pdf' });
    formData.append('file', file);

    const uploadResult = await uploadCV(formData);

    if (!uploadResult.success) {
      throw new Error(`Upload failed: ${uploadResult.error}`);
    }

    console.log('  ✓ Upload successful');
    console.log(`  - File: ${uploadResult.fileName}`);
    console.log(`  - Type: ${uploadResult.fileType}`);
    console.log(`  - Size: ${uploadResult.fileSize} bytes\n`);

    // Step 2: Extract via extractFromCV action
    console.log('2️⃣ Extracting data via extractFromCV action...');
    const { extractFromCV } = await import('../src/actions/cv-extraction');

    const draft = await extractFromCV(
      uploadResult.base64!,
      uploadResult.fileName!,
      uploadResult.fileType!,
      uploadResult.fileSize!
    );

    console.log('  ✓ Extraction successful');
    console.log(`  - Filled fields: ${draft.filledFields.length}`);
    console.log(`  - Processing time: ${draft.metadata.processingTimeMs}ms\n`);

    // Verify extracted data
    console.log('3️⃣ Verifying extracted data...');
    const email = draft.filledFields.find(f => f.targetField === 'email');
    if (!email) {
      throw new Error('Email not extracted!');
    }
    console.log(`  ✓ Email: ${email.extractedValue}`);

    const firstName = draft.filledFields.find(f => f.targetField === 'firstName');
    const lastName = draft.filledFields.find(f => f.targetField === 'lastName');
    console.log(`  ✓ Name: ${firstName?.extractedValue || 'N/A'} ${lastName?.extractedValue || 'N/A'}`);

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testRealUpload();
