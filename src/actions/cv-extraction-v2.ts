"use server";

import type {
  CandidateAutoFillDraft,
  FilledField,
  AmbiguousField,
  UnmappedItem,
} from "@/lib/cv-autofill/types";
import {
  extractTextFromPDF,
  detectIfScanned,
  validatePageCount,
} from "@/lib/cv-autofill/parsers/pdf-parser";
import { extractTextFromDOCX } from "@/lib/cv-autofill/parsers/docx-parser";
import { extractTextFromImage } from "@/lib/cv-autofill/parsers/ocr-parser";
import { getAllSkills } from "./skills";
import { CV_AUTOFILL_CONFIG } from "@/lib/constants";
import { packCvForLlm, type PackedCvInput } from "@/lib/cv-pack";
import {
  getExtractionEngine,
  type ExtractionResult,
  type ExtractedData,
  type UnmappedSegment,
} from "@/lib/extraction-engine";
import { cvLogger } from "@/lib/logger";

export async function extractFromCVWithCognition(
  base64: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<CandidateAutoFillDraft & { thoughtProcess?: string }> {
  const startTime = Date.now();

  try {
    const buffer = Buffer.from(base64, "base64");

    let extractedText = "";
    let pageCount = 0;
    let extractionMethod: "text" | "ocr" = "text";

    if (fileType === "pdf") {
      const pdfResult = await extractTextFromPDF(buffer);
      extractedText = pdfResult.text;
      pageCount = pdfResult.pageCount;

      if (!validatePageCount(pageCount, CV_AUTOFILL_CONFIG.MAX_PAGE_COUNT)) {
        throw new Error(`Zu viele Seiten. Maximum: ${CV_AUTOFILL_CONFIG.MAX_PAGE_COUNT}`);
      }

      if (detectIfScanned(extractedText)) {
        cvLogger.info("PDF appears scanned, attempting OCR", {
          action: "extractFromCVWithCognition",
        });
        try {
          const ocrResult = await extractTextFromImage(
            buffer,
            CV_AUTOFILL_CONFIG.OCR_TIMEOUT_MS
          );
          extractedText = ocrResult.text;
          extractionMethod = "ocr";
        } catch (ocrError) {
          cvLogger.error("OCR fallback failed", {
            action: "extractFromCVWithCognition",
            error: ocrError instanceof Error ? ocrError.message : String(ocrError),
          });
        }
      }
    } else if (fileType === "docx") {
      const docxResult = await extractTextFromDOCX(buffer);
      extractedText = docxResult.text;
      pageCount = docxResult.pageCount;
    } else if (["png", "jpg", "jpeg"].includes(fileType)) {
      const ocrResult = await extractTextFromImage(
        buffer,
        CV_AUTOFILL_CONFIG.OCR_TIMEOUT_MS
      );
      extractedText = ocrResult.text;
      pageCount = ocrResult.pageCount;
      extractionMethod = "ocr";
    } else {
      throw new Error("Nicht unterstützter Dateityp");
    }

    if (!extractedText || extractedText.trim().length < 10) {
      return createEmptyDraft(
        fileName,
        fileType,
        fileSize,
        pageCount,
        extractionMethod,
        startTime
      );
    }

    const packedInput = packCvForLlm(extractedText, pageCount);
    const engine = getExtractionEngine();

    if (!engine.isEnabled() || !engine.isConfigured()) {
      cvLogger.warn("Extraction engine not enabled/configured", {
        action: "extractFromCVWithCognition",
        enabled: engine.isEnabled(),
        configured: engine.isConfigured(),
      });
      return createEmptyDraft(
        fileName,
        fileType,
        fileSize,
        pageCount,
        extractionMethod,
        startTime
      );
    }

    const result = await engine.extract(packedInput);

    if (!result.success || !result.extractedData) {
      cvLogger.warn("Extraction failed", {
        action: "extractFromCVWithCognition",
        error: result.error,
        errorCode: result.errorCode,
      });
      return createEmptyDraft(
        fileName,
        fileType,
        fileSize,
        pageCount,
        extractionMethod,
        startTime
      );
    }

    const systemSkills = await getAllSkills();
    const skillNames = systemSkills.map((s) => s.name);

    const draft = convertToDraft(
      result,
      skillNames,
      fileName,
      fileType,
      fileSize,
      pageCount,
      extractionMethod,
      startTime
    );

    cvLogger.info("Cognitive extraction completed", {
      action: "extractFromCVWithCognition",
      filledFields: draft.filledFields.length,
      ambiguousFields: draft.ambiguousFields.length,
      unmappedItems: draft.unmappedItems.length,
      implicitMappings: result.implicitMappingsApplied,
      latencyMs: result.latencyMs,
      retryCount: result.retryCount,
    });

    return {
      ...draft,
      thoughtProcess: result.thoughtProcess,
    };
  } catch (error) {
    cvLogger.error("CV extraction error", {
      action: "extractFromCVWithCognition",
      error: error instanceof Error ? error.message : String(error),
    });
    return createEmptyDraft(fileName, fileType, fileSize, 0, "text", startTime);
  }
}

function convertToDraft(
  result: ExtractionResult,
  systemSkillNames: string[],
  fileName: string,
  fileType: string,
  fileSize: number,
  pageCount: number,
  extractionMethod: "text" | "ocr",
  startTime: number
): CandidateAutoFillDraft {
  const data = result.extractedData!;
  const filledFields: FilledField[] = [];
  const ambiguousFields: AmbiguousField[] = [];
  const unmappedItems: UnmappedItem[] = [];

  if (data.person.firstName) {
    const confidence = result.flaggedFields.includes("firstName") ? "low" : "high";
    filledFields.push({
      targetField: "firstName",
      extractedValue: data.person.firstName,
      confidence,
      source: {
        text: data.person.evidence[0]?.text || data.person.firstName,
        page: data.person.evidence[0]?.page,
      },
    });
  }

  if (data.person.lastName) {
    const confidence = result.flaggedFields.includes("lastName") ? "low" : "high";
    filledFields.push({
      targetField: "lastName",
      extractedValue: data.person.lastName,
      confidence,
      source: {
        text: data.person.evidence[0]?.text || data.person.lastName,
        page: data.person.evidence[0]?.page,
      },
    });
  }

  if (data.contact.email) {
    filledFields.push({
      targetField: "email",
      extractedValue: data.contact.email,
      confidence: result.flaggedFields.includes("email") ? "low" : "high",
      source: { text: data.contact.email },
    });
  }

  if (data.contact.phone) {
    filledFields.push({
      targetField: "phone",
      extractedValue: data.contact.phone,
      confidence: result.flaggedFields.includes("phone") ? "medium" : "high",
      source: { text: data.contact.phone },
    });
  }

  if (data.contact.linkedinUrl) {
    filledFields.push({
      targetField: "linkedinUrl",
      extractedValue: data.contact.linkedinUrl,
      confidence: "high",
      source: { text: data.contact.linkedinUrl },
    });
  }

  if (data.contact.address) {
    const addr = data.contact.address;
    if (addr.city) {
      filledFields.push({
        targetField: "city",
        extractedValue: addr.city,
        confidence: "medium",
        source: { text: addr.city },
      });
    }
    if (addr.postalCode) {
      filledFields.push({
        targetField: "postalCode",
        extractedValue: addr.postalCode,
        confidence: "medium",
        source: { text: addr.postalCode },
      });
    }
    if (addr.street) {
      filledFields.push({
        targetField: "street",
        extractedValue: addr.street,
        confidence: "medium",
        source: { text: addr.street },
      });
    }
    if (addr.canton) {
      filledFields.push({
        targetField: "canton",
        extractedValue: addr.canton,
        confidence: "medium",
        source: { text: addr.canton },
      });
    }
  }

  if (data.nationality) {
    const wasImplicit = result.implicitMappingsApplied.some(
      (m) => m.includes("nationality") || m.includes("ethnicity")
    );
    filledFields.push({
      targetField: "nationality",
      extractedValue: data.nationality,
      confidence: wasImplicit ? "medium" : "high",
      source: { text: data.nationality },
    });
  }

  if (data.birthdate) {
    filledFields.push({
      targetField: "birthdate",
      extractedValue: data.birthdate,
      confidence: "medium",
      source: { text: data.birthdate },
    });
  }

  if (data.languages.length > 0) {
    const languages = data.languages.map((l) => ({
      language: l.name,
      level: normalizeLanguageLevel(l.level),
    }));
    filledFields.push({
      targetField: "languages",
      extractedValue: languages,
      confidence: "high",
      source: { text: "Languages section" },
    });
  }

  if (data.skills.length > 0) {
    const matchedSkills = data.skills
      .map((s) => s.name)
      .filter((name) =>
        systemSkillNames.some((sn) => sn.toLowerCase() === name.toLowerCase())
      );

    if (matchedSkills.length > 0) {
      filledFields.push({
        targetField: "skills",
        extractedValue: matchedSkills,
        confidence: "medium",
        source: { text: "Skills section" },
      });
    }
  }

  if (data.experience.length > 0) {
    const experiences = data.experience.map((exp) => ({
      role: exp.title || "",
      company: exp.company || "",
      startMonth: extractMonth(exp.startDate),
      startYear: extractYear(exp.startDate),
      endMonth: extractMonth(exp.endDate),
      endYear: extractYear(exp.endDate),
      current:
        exp.endDate?.toLowerCase().includes("present") ||
        exp.endDate?.toLowerCase().includes("heute"),
      description: exp.description || "",
    }));
    filledFields.push({
      targetField: "experience",
      extractedValue: experiences,
      confidence: "high",
      source: { text: "Experience section" },
    });
  }

  if (data.education.length > 0) {
    const education = data.education.map((edu) => ({
      degree: edu.degree || "",
      institution: edu.institution || "",
      startMonth: extractMonth(edu.startDate),
      startYear: extractYear(edu.startDate),
      endMonth: extractMonth(edu.endDate),
      endYear: extractYear(edu.endDate),
    }));
    filledFields.push({
      targetField: "education",
      extractedValue: education,
      confidence: "high",
      source: { text: "Education section" },
    });
  }

  for (const segment of result.unmappedSegments) {
    unmappedItems.push(convertUnmappedSegment(segment));
  }

  return {
    filledFields,
    ambiguousFields,
    unmappedItems,
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

function convertUnmappedSegment(segment: UnmappedSegment): UnmappedItem {
  const categoryMap: Record<string, UnmappedItem["category"]> = {
    date: "date",
    skill: "skill",
    credential: "education",
    personal: "contact",
    other: "other",
  };

  return {
    extractedLabel: null,
    extractedValue: segment.original_text,
    category: categoryMap[segment.detected_type] || "other",
    suggestedTargets: segment.suggested_field
      ? [
          {
            targetField: segment.suggested_field,
            confidence: segment.confidence >= 0.7 ? "high" : segment.confidence >= 0.4 ? "medium" : "low",
            reason: segment.reason,
          },
        ]
      : [],
    source: {
      text: segment.original_text.substring(0, 100),
      position: segment.line_reference || undefined,
    },
  };
}

function createEmptyDraft(
  fileName: string,
  fileType: string,
  fileSize: number,
  pageCount: number,
  extractionMethod: "text" | "ocr",
  startTime: number
): CandidateAutoFillDraft {
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

function normalizeLanguageLevel(level: string | null | undefined): string {
  if (!level) return "B1";

  const normalized = level.toUpperCase().trim();

  if (
    normalized.includes("MUTTER") ||
    normalized.includes("NATIVE") ||
    normalized.includes("FIRST")
  ) {
    return "Muttersprache";
  }

  const cefMatch = normalized.match(/[ABC][12]/);
  if (cefMatch) {
    return cefMatch[0];
  }

  if (
    normalized.includes("FLUENT") ||
    normalized.includes("FLIESSEND") ||
    normalized.includes("VERHANDLUNGSSICHER")
  ) {
    return "C1";
  }
  if (normalized.includes("GOOD") || normalized.includes("GUT")) {
    return "B2";
  }
  if (normalized.includes("BASIC") || normalized.includes("GRUND")) {
    return "A2";
  }

  return "B1";
}

function extractMonth(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  const monthMatch = dateStr.match(/(\d{1,2})[\/\-\.]/);
  if (monthMatch) {
    return monthMatch[1].padStart(2, "0");
  }

  const monthNames: Record<string, string> = {
    jan: "01", januar: "01", january: "01",
    feb: "02", februar: "02", february: "02",
    mar: "03", märz: "03", march: "03",
    apr: "04", april: "04",
    mai: "05", may: "05",
    jun: "06", juni: "06", june: "06",
    jul: "07", juli: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", september: "09",
    oct: "10", okt: "10", oktober: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", dez: "12", dezember: "12", december: "12",
  };

  const lower = dateStr.toLowerCase();
  for (const [key, val] of Object.entries(monthNames)) {
    if (lower.includes(key)) return val;
  }

  return "";
}

function extractYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  if (
    dateStr.toLowerCase().includes("present") ||
    dateStr.toLowerCase().includes("heute")
  ) {
    return new Date().getFullYear().toString();
  }

  const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return yearMatch[0];
  }

  return "";
}
