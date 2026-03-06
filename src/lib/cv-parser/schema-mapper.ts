/**
 * Schema Mapper
 * Converts ParsedCvData → CandidateAutoFillDraftV2 (the format used by the mapping modal UI)
 * and ParsedCvData → CandidateFormData (direct form filling)
 */

import type { ParsedCvData } from "./types";
import type { CandidateAutoFillDraftV2, ExtractedFieldWithEvidence, FieldEvidence } from "@/lib/azure-di/types";
import type { CandidateFormData } from "@/lib/cv-autofill/types";
import { CV_EXTRACTION_VERSION } from "@/lib/azure-di/types";

const STUB_EVIDENCE: FieldEvidence = {
  page: 1,
  exactText: "",
  confidence: 0.8,
};

function evidence(text: string, confidence = 0.8): FieldEvidence {
  return { page: 1, exactText: text, confidence };
}

/**
 * Convert ParsedCvData → CandidateAutoFillDraftV2 for the mapping modal.
 */
export function parsedCvToDraftV2(
  data: ParsedCvData,
  metadata: {
    fileName: string;
    fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx";
    fileSize: number;
    processingTimeMs: number;
    pageCount?: number;
  }
): CandidateAutoFillDraftV2 {
  const filledFields: ExtractedFieldWithEvidence[] = [];

  // Personal data
  if (data.first_name) {
    filledFields.push({
      targetField: "firstName",
      extractedValue: data.first_name,
      confidence: "high",
      evidence: evidence(data.first_name, 0.9),
    });
  }

  if (data.last_name) {
    filledFields.push({
      targetField: "lastName",
      extractedValue: data.last_name,
      confidence: "high",
      evidence: evidence(data.last_name, 0.9),
    });
  }

  if (data.email) {
    filledFields.push({
      targetField: "email",
      extractedValue: data.email,
      confidence: "high",
      evidence: evidence(data.email, 0.95),
    });
  }

  if (data.phone) {
    filledFields.push({
      targetField: "phone",
      extractedValue: data.phone,
      confidence: "high",
      evidence: evidence(data.phone, 0.9),
    });
  }

  if (data.linkedin_url) {
    filledFields.push({
      targetField: "linkedinUrl",
      extractedValue: data.linkedin_url,
      confidence: "high",
      evidence: evidence(data.linkedin_url, 0.95),
    });
  }

  if (data.target_position) {
    filledFields.push({
      targetField: "targetRole",
      extractedValue: data.target_position,
      confidence: "medium",
      evidence: evidence(data.target_position, 0.7),
    });
  }

  if (data.street) {
    filledFields.push({
      targetField: "street",
      extractedValue: data.street,
      confidence: "medium",
      evidence: evidence(data.street, 0.8),
    });
  }

  if (data.postal_code) {
    filledFields.push({
      targetField: "postalCode",
      extractedValue: data.postal_code,
      confidence: "medium",
      evidence: evidence(data.postal_code, 0.85),
    });
  }

  if (data.city) {
    filledFields.push({
      targetField: "city",
      extractedValue: data.city,
      confidence: "medium",
      evidence: evidence(data.city, 0.85),
    });
  }

  if (data.canton) {
    filledFields.push({
      targetField: "canton",
      extractedValue: data.canton,
      confidence: "medium",
      evidence: evidence(data.canton, 0.7),
    });
  }

  // Professional info
  if (data.years_experience !== null && data.years_experience > 0) {
    filledFields.push({
      targetField: "yearsOfExperience",
      extractedValue: data.years_experience,
      confidence: "medium",
      evidence: evidence(`${data.years_experience} Jahre berechnet`, 0.7),
    });
  }

  if (data.current_salary_chf !== null) {
    filledFields.push({
      targetField: "currentSalary",
      extractedValue: data.current_salary_chf,
      confidence: "medium",
      evidence: evidence(`${data.current_salary_chf} CHF`, 0.7),
    });
  }

  if (data.expected_salary_chf !== null) {
    filledFields.push({
      targetField: "expectedSalary",
      extractedValue: data.expected_salary_chf,
      confidence: "medium",
      evidence: evidence(`${data.expected_salary_chf} CHF`, 0.7),
    });
  }

  if (data.desired_hourly_rate_chf !== null) {
    filledFields.push({
      targetField: "desiredHourlyRate",
      extractedValue: data.desired_hourly_rate_chf,
      confidence: "medium",
      evidence: evidence(`${data.desired_hourly_rate_chf} CHF/h`, 0.7),
    });
  }

  if (data.notice_period) {
    filledFields.push({
      targetField: "noticePeriod",
      extractedValue: data.notice_period,
      confidence: "medium",
      evidence: evidence(data.notice_period, 0.7),
    });
  }

  if (data.available_from) {
    filledFields.push({
      targetField: "availableFrom",
      extractedValue: data.available_from,
      confidence: "medium",
      evidence: evidence(data.available_from, 0.7),
    });
  }

  // Skills
  if (data.skills.length > 0) {
    filledFields.push({
      targetField: "skills",
      extractedValue: data.skills,
      confidence: "high",
      evidence: evidence(`${data.skills.length} Skills`, 0.85),
    });
  }

  // Languages
  if (data.languages.length > 0) {
    filledFields.push({
      targetField: "languages",
      extractedValue: data.languages,
      confidence: "medium",
      evidence: evidence(`${data.languages.length} Sprachen`, 0.8),
    });
  }

  // Certifications
  if (data.certifications.length > 0) {
    filledFields.push({
      targetField: "certificates",
      extractedValue: data.certifications.map(c => ({
        name: c.name,
        issuer: c.issuer,
        date: c.year,
      })),
      confidence: "medium",
      evidence: evidence(`${data.certifications.length} Zertifikate`, 0.75),
    });
  }

  // Education
  if (data.education.length > 0) {
    filledFields.push({
      targetField: "education",
      extractedValue: data.education,
      confidence: "high",
      evidence: evidence(`${data.education.length} Ausbildungen`, 0.85),
    });
  }

  // Work experience
  if (data.work_experience.length > 0) {
    filledFields.push({
      targetField: "experience",
      extractedValue: data.work_experience,
      confidence: "high",
      evidence: evidence(`${data.work_experience.length} Berufsstationen`, 0.85),
    });
  }

  // Highlights
  if (data.highlights.length > 0) {
    filledFields.push({
      targetField: "highlights",
      extractedValue: data.highlights,
      confidence: "medium",
      evidence: evidence(`${data.highlights.length} Highlights`, 0.7),
    });
  }

  return {
    filledFields,
    ambiguousFields: [],
    unmappedItems: [],
    metadata: {
      fileName: metadata.fileName,
      fileType: metadata.fileType,
      fileSize: metadata.fileSize,
      pageCount: metadata.pageCount ?? 0,
      processingTimeMs: metadata.processingTimeMs,
      timestamp: new Date().toISOString(),
    },
    extractionVersion: CV_EXTRACTION_VERSION + "+improved",
    provider: "azure-document-intelligence",
  };
}

/**
 * Convert ParsedCvData → CandidateFormData (for direct form filling without modal).
 */
export function parsedCvToFormData(data: ParsedCvData): Partial<CandidateFormData> {
  const result: Partial<CandidateFormData> = {};

  if (data.first_name) result.firstName = data.first_name;
  if (data.last_name) result.lastName = data.last_name;
  if (data.email) result.email = data.email;
  if (data.phone) result.phone = data.phone;
  if (data.linkedin_url) result.linkedinUrl = data.linkedin_url;
  if (data.target_position) result.targetRole = data.target_position;
  if (data.street) result.street = data.street;
  if (data.postal_code) result.postalCode = data.postal_code;
  if (data.city) result.city = data.city;
  if (data.canton) result.canton = data.canton;

  if (data.years_experience !== null) result.yearsOfExperience = data.years_experience;
  if (data.current_salary_chf !== null) result.currentSalary = data.current_salary_chf;
  if (data.expected_salary_chf !== null) result.expectedSalary = data.expected_salary_chf;
  if (data.desired_hourly_rate_chf !== null) result.desiredHourlyRate = data.desired_hourly_rate_chf;
  result.isSubcontractor = data.is_subcontractor;
  if (data.notice_period) result.noticePeriod = data.notice_period;
  if (data.available_from) result.availableFrom = data.available_from;

  if (data.skills.length > 0) result.skills = data.skills;

  if (data.languages.length > 0) {
    result.languages = data.languages.map(l => ({
      language: l.language,
      level: (l.level || "B2") as "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Muttersprache",
    }));
  }

  if (data.certifications.length > 0) {
    result.certificates = data.certifications.map(c => ({
      name: c.name,
      issuer: c.issuer,
      date: c.year,
    }));
  }

  if (data.education.length > 0) result.education = data.education;

  if (data.work_experience.length > 0) {
    result.experience = data.work_experience.map(e => ({
      role: e.role,
      company: e.company,
      startMonth: e.startMonth,
      startYear: e.startYear,
      endMonth: e.endMonth,
      endYear: e.endYear,
      current: e.current,
      description: e.description,
    }));
  }

  if (data.highlights.length > 0) result.highlights = data.highlights;

  return result;
}
