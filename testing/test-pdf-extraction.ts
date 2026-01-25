#!/usr/bin/env tsx
/**
 * Test PDF Extraction with Real Test File
 * Verifies that PDF extraction works end-to-end
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✓ Loaded environment from .env.local\n');
} else {
  console.warn('⚠️  .env.local not found, using process environment\n');
}

async function testPDFExtraction() {
  console.log('🧪 Testing PDF Extraction with Real Test File\n');

  const testPdfPath = path.join(__dirname, 'testcv.pdf');

  // Check if test file exists
  if (!fs.existsSync(testPdfPath)) {
    console.error(`❌ Test file not found: ${testPdfPath}`);
    process.exit(1);
  }

  console.log(`📄 Test file: ${testPdfPath}`);
  const fileBuffer = fs.readFileSync(testPdfPath);
  console.log(`📦 File size: ${fileBuffer.length} bytes\n`);

  try {
    // Import the extraction function
    const { extractTextFromPDF } = await import('../src/lib/cv-autofill/parsers/pdf-parser');

    console.log('🔍 Extracting text from PDF...');
    const result = await extractTextFromPDF(fileBuffer);

    console.log('\n✅ Extraction Result:');
    console.log(`- Method: ${result.method}`);
    console.log(`- Page Count: ${result.pageCount}`);
    console.log(`- Text Length: ${result.text.length} characters`);
    console.log(`- First 200 chars: ${result.text.substring(0, 200).replace(/\n/g, ' ')}`);

    // Verify extraction
    if (!result.text || result.text.trim().length === 0) {
      console.error('\n❌ FAILED: Extracted text is empty!');
      process.exit(1);
    }

    if (result.text.length < 50) {
      console.error('\n❌ FAILED: Extracted text is too short (likely failed extraction)');
      process.exit(1);
    }

    console.log('\n✅ PDF extraction successful!');

    // Now test full extraction pipeline
    console.log('\n🔍 Testing full extraction pipeline...');
    const { extractFromCV } = await import('../src/actions/cv-extraction');

    const draft = await extractFromCV(
      fileBuffer,
      'testcv.pdf',
      'pdf',
      fileBuffer.length
    );

    console.log('\n✅ Full Extraction Draft:');
    console.log(`- Filled Fields: ${draft.filledFields.length}`);
    console.log(`- Ambiguous Fields: ${draft.ambiguousFields.length}`);
    console.log(`- Unmapped Items: ${draft.unmappedItems.length}`);
    console.log(`- Processing Time: ${draft.metadata.processingTimeMs}ms`);

    // Show extracted fields
    console.log('\n📋 Extracted Fields:');
    draft.filledFields.forEach(field => {
      const value = typeof field.extractedValue === 'string'
        ? field.extractedValue
        : Array.isArray(field.extractedValue)
          ? `[${field.extractedValue.length} items]`
          : JSON.stringify(field.extractedValue);
      console.log(`  - ${field.targetField}: ${value} (confidence: ${field.confidence})`);
    });

    if (draft.filledFields.length === 0) {
      console.error('\n❌ FAILED: No fields extracted from CV!');
      process.exit(1);
    }

    console.log('\n🎉 All tests PASSED!');

  } catch (error) {
    console.error('\n❌ FAILED with error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testPDFExtraction().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
