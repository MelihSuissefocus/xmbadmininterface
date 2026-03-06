/**
 * LLM Mapper
 * Maps the LlmExtractionResponse (from Azure OpenAI) → ParsedCvData.
 *
 * Applies all normalizers to the LLM extraction output:
 * 1. Date parsing for experience and education entries
 * 2. Skill normalization and deduplication
 * 3. Language name + level normalization
 * 4. Name cleaning (academic titles)
 * 5. Address parsing
 * 6. Phone normalization
 * 7. Subcontractor detection
 * 8. Years of experience calculation
 * 9. Highlight extraction from descriptions
 */

import type { LlmExtractionResponse } from "@/lib/llm-schema";
import type { ParsedCvData } from "./types";
import { createEmptyParsedCv } from "./types";
import {
  parseDate,
  normalizeAndDeduplicateSkills,
  normalizeLanguageLevel,
  normalizeLanguageName,
  cleanNameFromTitles,
  normalizePhone,
  detectSubcontractor,
  calculateYearsOfExperience,
  filterHighlights,
  normalizeAvailableFrom,
} from "./normalizers";
import { CANTON_MAPPING } from "@/lib/constants";

/**
 * Map LLM extraction response to canonical ParsedCvData.
 */
export function mapLlmResponseToParsedCv(data: LlmExtractionResponse): ParsedCvData {
  const result = createEmptyParsedCv();

  // ── Names ──────────────────────────────────────────────────────────
  if (data.person.firstName) {
    result.first_name = cleanNameFromTitles(data.person.firstName);
  }
  if (data.person.lastName) {
    result.last_name = cleanNameFromTitles(data.person.lastName);
  }

  // ── Contact ────────────────────────────────────────────────────────
  if (data.contact.email) {
    result.email = data.contact.email.trim().toLowerCase();
  }

  if (data.contact.phone) {
    result.phone = normalizePhone(data.contact.phone);
  }

  if (data.contact.linkedinUrl) {
    const url = data.contact.linkedinUrl.trim();
    if (url.toLowerCase().includes("linkedin")) {
      result.linkedin_url = url.startsWith("http") ? url : `https://${url}`;
    }
  }

  // ── Address ────────────────────────────────────────────────────────
  if (data.contact.address) {
    const addr = data.contact.address;
    if (addr.street) result.street = addr.street.trim();
    if (addr.postalCode) result.postal_code = addr.postalCode.trim();
    if (addr.city) result.city = addr.city.trim();
    if (addr.canton) {
      const normalized = normalizeCanton(addr.canton);
      if (normalized) result.canton = normalized;
    }
  }

  // ── Skills ─────────────────────────────────────────────────────────
  const allSkills: string[] = data.skills.map(s => s.name);
  // Also collect technologies from experience entries
  for (const exp of data.experience) {
    const tech = (exp as Record<string, unknown>).technologies as string[] | undefined;
    if (tech && tech.length > 0) {
      allSkills.push(...tech);
    }
  }
  result.skills = normalizeAndDeduplicateSkills(allSkills);

  // ── Languages ──────────────────────────────────────────────────────
  for (const lang of data.languages) {
    const name = normalizeLanguageName(lang.name);
    const level = normalizeLanguageLevel(lang.level || "");
    if (name) {
      result.languages.push({ language: name, level });
    }
  }

  // ── Education ──────────────────────────────────────────────────────
  for (const edu of data.education) {
    const start = parseDate(edu.startDate || "");
    const end = parseDate(edu.endDate || "");
    result.education.push({
      degree: edu.degree || "",
      institution: edu.institution || "",
      startMonth: start.month ? String(start.month).padStart(2, "0") : "",
      startYear: start.year ? String(start.year) : "",
      endMonth: end.month ? String(end.month).padStart(2, "0") : "",
      endYear: end.year ? String(end.year) : "",
    });
  }

  // ── Work Experience ────────────────────────────────────────────────
  const textForSubcontractorCheck: string[] = [];

  for (const exp of data.experience) {
    const start = parseDate(exp.startDate || "");
    const endRaw = (exp.endDate || "").toLowerCase().trim();
    const isCurrent = ["present", "heute", "aktuell", "current", "laufend"].includes(endRaw);
    const end = isCurrent ? { month: null, year: null } : parseDate(exp.endDate || "");

    const responsibilities = (exp as Record<string, unknown>).responsibilities as string[] | undefined;
    let description = exp.description || "";
    if (responsibilities && responsibilities.length > 0) {
      description = responsibilities.map(r => `• ${r}`).join("\n");
    }

    const role = exp.title || "";
    const company = exp.company || "";
    textForSubcontractorCheck.push(role, company, description);

    result.work_experience.push({
      role,
      company,
      startMonth: start.month ? String(start.month).padStart(2, "0") : "",
      startYear: start.year ? String(start.year) : "",
      endMonth: end.month ? String(end.month).padStart(2, "0") : "",
      endYear: end.year ? String(end.year) : "",
      current: isCurrent,
      description,
    });
  }

  // ── Subcontractor detection ────────────────────────────────────────
  result.is_subcontractor = detectSubcontractor(textForSubcontractorCheck);

  // ── Years of experience ────────────────────────────────────────────
  result.years_experience = calculateYearsOfExperience(
    result.work_experience.map(w => ({
      startMonth: w.startMonth,
      startYear: w.startYear,
      endMonth: w.endMonth,
      endYear: w.endYear,
      current: w.current,
    }))
  );

  // ── Highlights ─────────────────────────────────────────────────────
  const candidateHighlights: string[] = [];
  for (const exp of data.experience) {
    const responsibilities = (exp as Record<string, unknown>).responsibilities as string[] | undefined;
    if (responsibilities) {
      // Pick the most concrete-sounding ones
      for (const r of responsibilities) {
        if (r.length > 30 && /\d|%|projekt|implementiert|eingeführt|verantwort|managed|developed|led|implemented|designed/i.test(r)) {
          candidateHighlights.push(r);
        }
      }
    }
  }
  result.highlights = filterHighlights(candidateHighlights).slice(0, 5);

  // ── Target position ────────────────────────────────────────────────
  if (result.work_experience.length > 0 && result.work_experience[0].role) {
    result.target_position = result.work_experience[0].role;
  }

  // ── Unmapped segments processing ───────────────────────────────────
  if (data.unmapped_segments) {
    for (const segment of data.unmapped_segments) {
      processUnmappedSegment(result, segment);
    }
  }

  // ── Status default ─────────────────────────────────────────────────
  result.status = "Neu";

  return result;
}

/**
 * Process unmapped segments from LLM output and try to assign them.
 */
function processUnmappedSegment(
  result: ParsedCvData,
  segment: {
    original_text: string;
    detected_type: string;
    suggested_field: string | null;
    confidence: number;
  }
): void {
  const text = segment.original_text.trim();
  if (!text) return;

  // Only process high-confidence suggestions
  if (segment.confidence < 0.5) return;

  switch (segment.suggested_field) {
    case "email":
      if (!result.email && text.includes("@")) {
        result.email = text;
      }
      break;
    case "phone":
      if (!result.phone) {
        result.phone = normalizePhone(text);
      }
      break;
    case "notice_period":
    case "noticePeriod":
      if (!result.notice_period) {
        result.notice_period = text;
      }
      break;
    case "available_from":
    case "availableFrom":
      if (!result.available_from) {
        result.available_from = normalizeAvailableFrom(text);
      }
      break;
    case "target_position":
    case "targetRole":
      if (!result.target_position) {
        result.target_position = text;
      }
      break;
    // Skills from unmapped
    case "skill":
      if (segment.detected_type === "skill") {
        const existing = new Set(result.skills.map(s => s.toLowerCase()));
        if (!existing.has(text.toLowerCase())) {
          result.skills.push(text);
        }
      }
      break;
  }
}

/**
 * Normalize canton string to standard Swiss abbreviation.
 */
function normalizeCanton(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const mapped = CANTON_MAPPING[lower] || CANTON_MAPPING[raw.toUpperCase()];
  return mapped || "";
}
