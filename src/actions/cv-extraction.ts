"use server";

/**
 * CV Extraction Action
 * Extracts structured data from CV files
 */

import type { CandidateAutoFillDraft, FilledField } from "@/lib/cv-autofill/types";
import {
  extractPersonalInfo,
  extractExperiences,
  extractEducation,
  extractLanguages,
  extractSkills,
  extractCertificates,
} from "@/lib/cv-autofill/extractors/data-extractor";
import { getAllSkills } from "./skills";

export async function extractFromCV(
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<CandidateAutoFillDraft> {
  const startTime = Date.now();

  try {
    // TODO: For now, we return a mock extraction
    // In a real implementation, this would:
    // 1. Download the file from fileUrl
    // 2. Extract text using PDF/DOCX parsers
    // 3. Run data extraction on the text

    // For demonstration, create a simple mock extraction
    const mockText = `
Max Mustermann
max.mustermann@example.com
+41 79 123 45 67

Berufserfahrung:
01/2020 - heute
Senior Software Engineer - Google Zürich
Entwicklung von Cloud-Infrastruktur

01/2018 - 12/2019
Software Engineer - Microsoft
Backend development

Ausbildung:
2014 - 2018
BSc Computer Science - ETH Zürich

Sprachen:
Deutsch: Muttersprache
Englisch: C1
Französisch: B1

Skills:
JavaScript, TypeScript, React, Node.js, Python
    `.trim();

    const personalInfo = extractPersonalInfo(mockText);
    const experiences = extractExperiences(mockText);
    const education = extractEducation(mockText);
    const languages = extractLanguages(mockText);
    const certificates = extractCertificates(mockText);

    // Get system skills to match against
    const systemSkills = await getAllSkills();
    const skillNames = systemSkills.map(s => s.name);
    const extractedSkills = extractSkills(mockText, skillNames);

    // Build filled fields
    const filledFields: FilledField[] = [];

    if (personalInfo.firstName) {
      filledFields.push({
        targetField: "firstName",
        extractedValue: personalInfo.firstName,
        confidence: "high",
        source: { text: personalInfo.firstName },
      });
    }

    if (personalInfo.lastName) {
      filledFields.push({
        targetField: "lastName",
        extractedValue: personalInfo.lastName,
        confidence: "high",
        source: { text: personalInfo.lastName },
      });
    }

    if (personalInfo.email) {
      filledFields.push({
        targetField: "email",
        extractedValue: personalInfo.email,
        confidence: "high",
        source: { text: personalInfo.email },
      });
    }

    if (personalInfo.phone) {
      filledFields.push({
        targetField: "phone",
        extractedValue: personalInfo.phone,
        confidence: "high",
        source: { text: personalInfo.phone },
      });
    }

    if (personalInfo.linkedinUrl) {
      filledFields.push({
        targetField: "linkedinUrl",
        extractedValue: personalInfo.linkedinUrl,
        confidence: "high",
        source: { text: personalInfo.linkedinUrl },
      });
    }

    if (personalInfo.city) {
      filledFields.push({
        targetField: "city",
        extractedValue: personalInfo.city,
        confidence: "medium",
        source: { text: personalInfo.city },
      });
    }

    if (personalInfo.postalCode) {
      filledFields.push({
        targetField: "postalCode",
        extractedValue: personalInfo.postalCode,
        confidence: "medium",
        source: { text: personalInfo.postalCode },
      });
    }

    if (experiences.length > 0) {
      filledFields.push({
        targetField: "experience",
        extractedValue: experiences,
        confidence: "high",
        source: { text: "Experience section" },
      });
    }

    if (education.length > 0) {
      filledFields.push({
        targetField: "education",
        extractedValue: education,
        confidence: "high",
        source: { text: "Education section" },
      });
    }

    if (languages.length > 0) {
      filledFields.push({
        targetField: "languages",
        extractedValue: languages,
        confidence: "high",
        source: { text: "Languages section" },
      });
    }

    if (extractedSkills.length > 0) {
      filledFields.push({
        targetField: "skills",
        extractedValue: extractedSkills,
        confidence: "medium",
        source: { text: "Skills section" },
      });
    }

    if (certificates.length > 0) {
      filledFields.push({
        targetField: "certificates",
        extractedValue: certificates,
        confidence: "medium",
        source: { text: "Certificates section" },
      });
    }

    const processingTimeMs = Date.now() - startTime;

    const draft: CandidateAutoFillDraft = {
      filledFields,
      ambiguousFields: [],
      unmappedItems: [],
      metadata: {
        fileName,
        fileType: fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx",
        fileSize,
        extractionMethod: "text",
        processingTimeMs,
        timestamp: new Date().toISOString(),
      },
    };

    return draft;
  } catch (error) {
    console.error("CV extraction error:", error);

    // Return empty draft on error
    const processingTimeMs = Date.now() - startTime;

    return {
      filledFields: [],
      ambiguousFields: [],
      unmappedItems: [],
      metadata: {
        fileName,
        fileType: fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx",
        fileSize,
        extractionMethod: "text",
        processingTimeMs,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
