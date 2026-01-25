/**
 * Test CV Extraction
 * Verifies that extraction logic works with different text inputs
 */

import {
  extractPersonalInfo,
  extractExperiences,
  extractEducation,
  extractLanguages,
} from "../src/lib/cv-autofill/extractors/data-extractor";

async function testExtraction() {
  console.log("🧪 Testing CV Data Extraction Logic\n");

  // Test 1: Mock CV text for "Anna Schmidt"
  const mockCV1 = `
LEBENSLAUF

Anna Schmidt
Software Engineer

Kontakt
Email: anna.schmidt@example.com
Telefon: +41 79 123 45 67
LinkedIn: https://linkedin.com/in/anna-schmidt

Berufserfahrung
01/2020 - heute
Senior Software Engineer - Tech Company AG
Entwicklung von Web-Applikationen mit React und Node.js

06/2018 - 12/2019
Junior Developer - Startup GmbH
Frontend-Entwicklung mit JavaScript

Ausbildung
09/2014 - 06/2018
Bachelor of Science in Informatik - ETH Zürich

Sprachen
Deutsch: Muttersprache
Englisch: C2
Französisch: B1
`;

  // Test 2: Mock CV text for "Peter Müller"
  const mockCV2 = `
CURRICULUM VITAE

Peter Müller
Data Scientist

Contact Information
Email: peter.mueller@example.ch
Phone: +41 44 987 65 43
LinkedIn: https://linkedin.com/in/peter-mueller

Professional Experience
03/2021 - Present
Lead Data Scientist - Analytics Corp
Machine learning model development and deployment

01/2019 - 02/2021
Data Analyst - Research Institute
Statistical analysis and data visualization

Education
09/2015 - 12/2018
Master of Science in Data Science - University of Zurich

Languages
German: Native
English: C1
Italian: B2
`;

  console.log("📝 Test 1: Extract from Anna Schmidt CV\n");
  const info1 = extractPersonalInfo(mockCV1);
  const exp1 = extractExperiences(mockCV1);
  const edu1 = extractEducation(mockCV1);
  const lang1 = extractLanguages(mockCV1);

  console.log("Extracted Fields:");
  console.log("- Name:", info1.firstName || "NOT FOUND");
  console.log("- Last Name:", info1.lastName || "NOT FOUND");
  console.log("- Email:", info1.email || "NOT FOUND");
  console.log("- Phone:", info1.phone || "NOT FOUND");
  console.log("- Experience Count:", exp1.length);
  console.log("- Education Count:", edu1.length);
  console.log("- Languages Count:", lang1.length);

  console.log("\n📝 Test 2: Extract from Peter Müller CV\n");
  const info2 = extractPersonalInfo(mockCV2);
  const exp2 = extractExperiences(mockCV2);
  const edu2 = extractEducation(mockCV2);
  const lang2 = extractLanguages(mockCV2);

  console.log("Extracted Fields:");
  console.log("- Name:", info2.firstName || "NOT FOUND");
  console.log("- Last Name:", info2.lastName || "NOT FOUND");
  console.log("- Email:", info2.email || "NOT FOUND");
  console.log("- Phone:", info2.phone || "NOT FOUND");
  console.log("- Experience Count:", exp2.length);
  console.log("- Education Count:", edu2.length);
  console.log("- Languages Count:", lang2.length);

  // Verify outputs are different
  console.log("\n✅ Verification:");

  if (info1.firstName === info2.firstName) {
    console.error("❌ FAILED: Both CVs extracted the same first name!");
    console.error(`   CV1: ${info1.firstName}`);
    console.error(`   CV2: ${info2.firstName}`);
    process.exit(1);
  }

  if (info1.email === info2.email) {
    console.error("❌ FAILED: Both CVs extracted the same email!");
    console.error(`   CV1: ${info1.email}`);
    console.error(`   CV2: ${info2.email}`);
    process.exit(1);
  }

  if (exp1.length === 0 || exp2.length === 0) {
    console.error("❌ FAILED: No experience extracted from one or both CVs");
    console.error(`   CV1 experiences: ${exp1.length}`);
    console.error(`   CV2 experiences: ${exp2.length}`);
    process.exit(1);
  }

  if (lang1.length === 0 || lang2.length === 0) {
    console.error("❌ FAILED: No languages extracted from one or both CVs");
    console.error(`   CV1 languages: ${lang1.length}`);
    console.error(`   CV2 languages: ${lang2.length}`);
    process.exit(1);
  }

  console.log("✓ SUCCESS: Different CVs produce different outputs");
  console.log(`  CV1: ${info1.firstName} ${info1.lastName} (${info1.email})`);
  console.log(`  CV2: ${info2.firstName} ${info2.lastName} (${info2.email})`);
  console.log(`  CV1: ${exp1.length} experiences, ${lang1.length} languages`);
  console.log(`  CV2: ${exp2.length} experiences, ${lang2.length} languages`);

  console.log("\n🎉 CV Extraction verification PASSED!");
}

testExtraction().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
