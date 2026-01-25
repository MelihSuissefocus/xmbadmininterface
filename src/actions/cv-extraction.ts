"use server";

/**
 * CV Extraction Action - PRODUCTION Implementation
 * Extracts structured data from CV files using real parsers
 */

import type { CandidateAutoFillDraft, FilledField, AmbiguousField, UnmappedItem } from "@/lib/cv-autofill/types";
import {
  extractPersonalInfo,
  extractExperiences,
  extractEducation,
  extractLanguages,
  extractSkills,
  extractCertificates,
} from "@/lib/cv-autofill/extractors/data-extractor";
import { extractTextFromPDF, detectIfScanned, validatePageCount } from "@/lib/cv-autofill/parsers/pdf-parser";
import { extractTextFromDOCX } from "@/lib/cv-autofill/parsers/docx-parser";
import { extractTextFromImage } from "@/lib/cv-autofill/parsers/ocr-parser";
import { getAllSkills } from "./skills";
import { CV_AUTOFILL_CONFIG } from "@/lib/constants";
import { generateSuggestedTargets } from "@/lib/cv-autofill/field-mapper";

export async function extractFromCV(
  buffer: Buffer,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<CandidateAutoFillDraft> {
  const startTime = Date.now();

  try {
    let extractedText = "";
    let pageCount = 0;
    let extractionMethod: "text" | "ocr" = "text";

    // Extract text based on file type
    if (fileType === "pdf") {
      const pdfResult = await extractTextFromPDF(buffer);
      extractedText = pdfResult.text;
      pageCount = pdfResult.pageCount;

      // Validate page count
      if (!validatePageCount(pageCount, CV_AUTOFILL_CONFIG.MAX_PAGE_COUNT)) {
        throw new Error(`Zu viele Seiten. Maximum: ${CV_AUTOFILL_CONFIG.MAX_PAGE_COUNT}`);
      }

      // Check if OCR is needed (scanned PDF)
      if (detectIfScanned(extractedText)) {
        console.log("PDF appears to be scanned, attempting OCR...");
        try {
          // For scanned PDFs, fall back to OCR on first 2 pages
          const ocrResult = await extractTextFromImage(buffer, CV_AUTOFILL_CONFIG.OCR_TIMEOUT_MS);
          extractedText = ocrResult.text;
          extractionMethod = "ocr";
        } catch (ocrError) {
          console.error("OCR fallback failed:", ocrError);
          // Continue with whatever text we have
        }
      }
    } else if (fileType === "docx") {
      const docxResult = await extractTextFromDOCX(buffer);
      extractedText = docxResult.text;
      pageCount = docxResult.pageCount;
    } else if (fileType === "png" || fileType === "jpg" || fileType === "jpeg") {
      const ocrResult = await extractTextFromImage(buffer, CV_AUTOFILL_CONFIG.OCR_TIMEOUT_MS);
      extractedText = ocrResult.text;
      pageCount = ocrResult.pageCount;
      extractionMethod = "ocr";
    } else {
      throw new Error("Nicht unterstützter Dateityp");
    }

    // Check if we got any text
    if (!extractedText || extractedText.trim().length < 10) {
      return {
        filledFields: [],
        ambiguousFields: [],
        unmappedItems: [],
        metadata: {
          fileName,
          fileType: fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx",
          fileSize,
          pageCount,
          extractionMethod,
          processingTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Extract structured data from text
    const personalInfo = extractPersonalInfo(extractedText);
    const experiences = extractExperiences(extractedText);
    const education = extractEducation(extractedText);
    const languages = extractLanguages(extractedText);
    const certificates = extractCertificates(extractedText);

    // Get system skills to match against
    const systemSkills = await getAllSkills();
    const skillNames = systemSkills.map(s => s.name);
    const extractedSkills = extractSkills(extractedText, skillNames);

    // Build filled fields
    const filledFields: FilledField[] = [];
    const ambiguousFields: AmbiguousField[] = [];
    const unmappedItems: UnmappedItem[] = [];

    // Add basic personal info with high confidence
    if (personalInfo.firstName) {
      filledFields.push({
        targetField: "firstName",
        extractedValue: personalInfo.firstName,
        confidence: "high",
        source: { text: personalInfo.firstName.substring(0, 50) },
      });
    }

    if (personalInfo.lastName) {
      filledFields.push({
        targetField: "lastName",
        extractedValue: personalInfo.lastName,
        confidence: "high",
        source: { text: personalInfo.lastName.substring(0, 50) },
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

    if (personalInfo.street) {
      filledFields.push({
        targetField: "street",
        extractedValue: personalInfo.street,
        confidence: "medium",
        source: { text: personalInfo.street.substring(0, 50) },
      });
    }

    if (personalInfo.canton) {
      filledFields.push({
        targetField: "canton",
        extractedValue: personalInfo.canton,
        confidence: "medium",
        source: { text: personalInfo.canton },
      });
    }

    if (personalInfo.targetRole) {
      filledFields.push({
        targetField: "targetRole",
        extractedValue: personalInfo.targetRole,
        confidence: "medium",
        source: { text: personalInfo.targetRole.substring(0, 50) },
      });
    }

    // Add array fields
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

    // Look for potentially ambiguous fields in the text
    // Common patterns that might be misinterpreted
    const ambiguousPatterns = [
      { label: "Ethnicity", pattern: /ethnicity\s*:?\s*([^\n]+)/i },
      { label: "Nationality", pattern: /nationality\s*:?\s*([^\n]+)/i },
      { label: "Staatsangehörigkeit", pattern: /staatsangehörigkeit\s*:?\s*([^\n]+)/i },
      { label: "Herkunft", pattern: /herkunft\s*:?\s*([^\n]+)/i },
      { label: "Citizenship", pattern: /citizenship\s*:?\s*([^\n]+)/i },
    ];

    for (const pattern of ambiguousPatterns) {
      const match = extractedText.match(pattern.pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        // Only add if not already mapped
        const alreadyMapped = filledFields.some(f =>
          f.extractedValue === value ||
          (typeof f.extractedValue === 'string' && f.extractedValue.includes(value))
        );

        if (!alreadyMapped) {
          ambiguousFields.push({
            extractedLabel: pattern.label,
            extractedValue: value,
            suggestedTargets: generateSuggestedTargets(pattern.label, value, "contact"),
            source: { text: match[0].substring(0, 50) },
          });
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    const draft: CandidateAutoFillDraft = {
      filledFields,
      ambiguousFields,
      unmappedItems,
      metadata: {
        fileName,
        fileType: fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx",
        fileSize,
        pageCount,
        extractionMethod,
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
