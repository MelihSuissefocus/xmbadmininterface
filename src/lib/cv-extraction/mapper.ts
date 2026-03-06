/**
 * Maps Mac Mini LLM CV extraction response to our internal candidate data structures.
 *
 * IMPROVED: Now uses the cv-parser module for proper normalization:
 * - Date parsing from "zeitraum" fields
 * - Skill normalization & deduplication
 * - Language level parsing
 * - Certificate parsing from weiterbildungen
 * - Years of experience calculation
 * - Subcontractor detection
 * - Highlight extraction
 * - Name cleaning (academic titles)
 */

import type { MacMiniCvResponse } from "./types";
import type {
  FilledField,
  ExperienceEntry,
  EducationEntry,
} from "@/lib/cv-autofill/types";
import type {
  CandidateAutoFillDraftV2,
} from "@/lib/azure-di/types";
import {
  mapMacMiniResponseToParsedCv,
  validateParsedCv,
  parsedCvToDraftV2,
} from "@/lib/cv-parser";

/**
 * Maps the Mac Mini API response to FilledField[] compatible with the existing
 * CV auto-fill / mapping modal flow.
 */
export function mapMacMiniResponseToFilledFields(
  data: MacMiniCvResponse
): FilledField[] {
  const parsed = mapMacMiniResponseToParsedCv(data);
  const { data: validated } = validateParsedCv(parsed);
  const fields: FilledField[] = [];

  if (validated.first_name) {
    fields.push({
      targetField: "firstName",
      extractedValue: validated.first_name,
      confidence: "high",
      source: { text: validated.first_name },
    });
  }

  if (validated.last_name) {
    fields.push({
      targetField: "lastName",
      extractedValue: validated.last_name,
      confidence: "high",
      source: { text: validated.last_name },
    });
  }

  if (validated.skills.length > 0) {
    fields.push({
      targetField: "skills",
      extractedValue: validated.skills,
      confidence: "high",
      source: { text: `${validated.skills.length} Skills (normalisiert)` },
    });
  }

  if (validated.languages.length > 0) {
    fields.push({
      targetField: "languages",
      extractedValue: validated.languages,
      confidence: "medium",
      source: { text: `${validated.languages.length} Sprachen` },
    });
  }

  if (validated.work_experience.length > 0) {
    const experiences: ExperienceEntry[] = validated.work_experience.map((exp) => ({
      role: exp.role,
      company: exp.company,
      description: exp.description,
      startMonth: exp.startMonth,
      startYear: exp.startYear,
      endMonth: exp.endMonth,
      endYear: exp.endYear,
      current: exp.current,
    }));

    fields.push({
      targetField: "experience",
      extractedValue: experiences,
      confidence: "high",
      source: { text: `${validated.work_experience.length} Berufsstationen` },
    });
  }

  if (validated.education.length > 0) {
    const education: EducationEntry[] = validated.education.map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      startMonth: edu.startMonth,
      startYear: edu.startYear,
      endMonth: edu.endMonth,
      endYear: edu.endYear,
    }));

    fields.push({
      targetField: "education",
      extractedValue: education,
      confidence: "high",
      source: { text: `${validated.education.length} Ausbildungen` },
    });
  }

  if (validated.certifications.length > 0) {
    fields.push({
      targetField: "certificates",
      extractedValue: validated.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
        date: c.year,
      })),
      confidence: "medium",
      source: { text: `${validated.certifications.length} Zertifikate` },
    });
  }

  if (validated.target_position) {
    fields.push({
      targetField: "targetRole",
      extractedValue: validated.target_position,
      confidence: "medium",
      source: { text: validated.target_position },
    });
  }

  if (validated.years_experience !== null && validated.years_experience > 0) {
    fields.push({
      targetField: "yearsOfExperience",
      extractedValue: validated.years_experience,
      confidence: "medium",
      source: { text: `${validated.years_experience} Jahre (berechnet)` },
    });
  }

  if (validated.highlights.length > 0) {
    fields.push({
      targetField: "highlights",
      extractedValue: validated.highlights,
      confidence: "medium",
      source: { text: `${validated.highlights.length} Highlights` },
    });
  }

  return fields;
}

/**
 * Maps Mac Mini LLM response → CandidateAutoFillDraftV2
 * Used by the local API extraction path in cv-analysis.
 *
 * IMPROVED: Now uses the cv-parser pipeline for complete normalization.
 */
export function mapMacMiniResponseToDraftV2(
  data: MacMiniCvResponse,
  fileName: string,
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx",
  fileSize: number,
  processingTimeMs: number
): CandidateAutoFillDraftV2 {
  // 1. Map to canonical parsed format
  const parsed = mapMacMiniResponseToParsedCv(data);

  // 2. Validate and sanitize
  const { data: validated } = validateParsedCv(parsed);

  // 3. Convert to DraftV2 for the mapping modal
  return parsedCvToDraftV2(validated, {
    fileName,
    fileType,
    fileSize,
    processingTimeMs,
  });
}
