#!/usr/bin/env tsx
/**
 * Debug Extraction - Show what's extracted from test CV
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function debugExtraction() {
  const testPdfPath = path.join(__dirname, 'testcv.pdf');
  const fileBuffer = fs.readFileSync(testPdfPath);

  // Extract text
  const { extractTextFromPDF } = await import('../src/lib/cv-autofill/parsers/pdf-parser');
  const result = await extractTextFromPDF(fileBuffer);

  console.log('📄 Extracted Text (first 1000 chars):');
  console.log('═'.repeat(80));
  console.log(result.text.substring(0, 1000));
  console.log('═'.repeat(80));

  // Extract structured data
  const {
    extractPersonalInfo,
    extractExperiences,
    extractEducation,
    extractLanguages,
  } = await import('../src/lib/cv-autofill/extractors/data-extractor');

  const personalInfo = extractPersonalInfo(result.text);
  const experiences = extractExperiences(result.text);
  const education = extractEducation(result.text);
  const languages = extractLanguages(result.text);

  console.log('\n📋 Personal Info:');
  console.log(JSON.stringify(personalInfo, null, 2));

  console.log('\n💼 Experiences:');
  console.log(JSON.stringify(experiences, null, 2));

  console.log('\n🎓 Education:');
  console.log(JSON.stringify(education, null, 2));

  console.log('\n🗣️  Languages:');
  console.log(JSON.stringify(languages, null, 2));
}

debugExtraction().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
