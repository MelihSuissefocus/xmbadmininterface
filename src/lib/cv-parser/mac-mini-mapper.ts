/**
 * Mac Mini Mapper
 * Maps the Mac Mini LLM API response (MacMiniCvResponse) → ParsedCvData.
 *
 * The Mac Mini API returns a limited schema. This mapper:
 * 1. Parses dates from the "zeitraum" field of each experience entry
 * 2. Normalizes and deduplicates skills (kernkompetenzen + tools from experiences)
 * 3. Parses language entries to extract name + level
 * 4. Parses certifications from weiterbildungen strings
 * 5. Cleans name fields (removes academic titles)
 * 6. Detects subcontractor status from role/company text
 * 7. Calculates years of experience from parsed work entries
 */

import type { MacMiniCvResponse } from "@/lib/cv-extraction/types";
import type { ParsedCvData } from "./types";
import { createEmptyParsedCv } from "./types";
import {
  parsePeriod,
  normalizeAndDeduplicateSkills,
  parseLanguageEntry,
  cleanNameFromTitles,
  detectSubcontractor,
  calculateYearsOfExperience,
  parseCertificate,
  filterHighlights,
} from "./normalizers";

/**
 * Map the Mac Mini API response to our canonical ParsedCvData format.
 */
export function mapMacMiniResponseToParsedCv(data: MacMiniCvResponse): ParsedCvData {
  const result = createEmptyParsedCv();

  // ── Names ──────────────────────────────────────────────────────────
  if (data.vorname) {
    result.first_name = cleanNameFromTitles(data.vorname);
  }
  if (data.nachname) {
    result.last_name = cleanNameFromTitles(data.nachname);
  }

  // ── Skills (kernkompetenzen + tools from all experiences) ──────────
  const allSkills: string[] = [...(data.kernkompetenzen || [])];
  for (const erf of data.erfahrungen || []) {
    if (erf.tools && erf.tools.length > 0) {
      allSkills.push(...erf.tools);
    }
  }
  result.skills = normalizeAndDeduplicateSkills(allSkills);

  // ── Languages ──────────────────────────────────────────────────────
  for (const lang of data.sprachen || []) {
    const parsed = parseLanguageEntry(lang);
    if (parsed.language) {
      result.languages.push(parsed);
    }
  }

  // ── Certifications (from weiterbildungen) ──────────────────────────
  for (const wb of data.weiterbildungen || []) {
    const cert = parseCertificate(wb);
    if (cert.name) {
      result.certifications.push(cert);
    }
  }

  // ── Education (from ausbildungen) ──────────────────────────────────
  for (const aus of data.ausbildungen || []) {
    result.education.push({
      degree: aus.abschluss || "",
      institution: aus.institution || "",
      startMonth: "",
      startYear: "",
      endMonth: "",
      endYear: "",
    });
  }

  // ── Work Experience (from erfahrungen with date parsing) ───────────
  const textForSubcontractorCheck: string[] = [];

  for (const erf of data.erfahrungen || []) {
    const period = parsePeriod(erf.zeitraum);

    // Build description from structured data
    const descParts: string[] = [];
    if (erf.aufgaben && erf.aufgaben.length > 0) {
      descParts.push(...erf.aufgaben.map(a => `• ${a}`));
    }
    if (erf.erfolge && erf.erfolge.length > 0) {
      descParts.push("");
      descParts.push("Erfolge:");
      descParts.push(...erf.erfolge.map(e => `• ${e}`));
    }

    const role = erf.rolle || "";
    const company = erf.projekt_id || "";

    textForSubcontractorCheck.push(role, company);

    result.work_experience.push({
      role,
      company,
      startMonth: period.start.month ? String(period.start.month).padStart(2, "0") : "",
      startYear: period.start.year ? String(period.start.year) : "",
      endMonth: period.end.month ? String(period.end.month).padStart(2, "0") : "",
      endYear: period.end.year ? String(period.end.year) : "",
      current: period.current,
      description: descParts.join("\n"),
    });
  }

  // ── Subcontractor detection ────────────────────────────────────────
  result.is_subcontractor = detectSubcontractor(textForSubcontractorCheck);

  // ── Years of experience (calculated from work entries) ─────────────
  result.years_experience = calculateYearsOfExperience(
    result.work_experience.map(w => ({
      startMonth: w.startMonth,
      startYear: w.startYear,
      endMonth: w.endMonth,
      endYear: w.endYear,
      current: w.current,
    }))
  );

  // ── Highlights (from erfolge across all experiences) ───────────────
  const allErfolge: string[] = [];
  for (const erf of data.erfahrungen || []) {
    if (erf.erfolge && erf.erfolge.length > 0) {
      allErfolge.push(...erf.erfolge);
    }
  }
  result.highlights = filterHighlights(allErfolge);

  // ── Target position (from first/most recent role) ──────────────────
  if (result.work_experience.length > 0) {
    const mostRecent = result.work_experience[0];
    if (mostRecent.role) {
      result.target_position = mostRecent.role;
    }
  }

  // ── Status default ─────────────────────────────────────────────────
  result.status = "Neu";

  return result;
}
