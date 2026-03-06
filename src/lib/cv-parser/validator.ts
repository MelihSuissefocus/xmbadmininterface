/**
 * CV Parser Validator
 * Validates and sanitizes ParsedCvData before it gets mapped to the form.
 */

import type { ParsedCvData } from "./types";

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_REGEX = /linkedin\.com\/(in|pub|profile)\//i;

/**
 * Validate and sanitize parsed CV data.
 * Returns cleaned data plus a list of issues found.
 */
export function validateParsedCv(data: ParsedCvData): {
  data: ParsedCvData;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const cleaned = { ...data };

  // Email validation
  if (cleaned.email && !EMAIL_REGEX.test(cleaned.email)) {
    issues.push({ field: "email", message: `Ungültiges E-Mail-Format: "${cleaned.email}"`, severity: "warning" });
    cleaned.email = "";
  }

  // LinkedIn URL validation
  if (cleaned.linkedin_url && !LINKEDIN_REGEX.test(cleaned.linkedin_url)) {
    // Allow if it at least contains linkedin
    if (!cleaned.linkedin_url.toLowerCase().includes("linkedin")) {
      issues.push({ field: "linkedin_url", message: `Keine gültige LinkedIn-URL: "${cleaned.linkedin_url}"`, severity: "warning" });
      cleaned.linkedin_url = "";
    }
  }

  // Phone basic check
  if (cleaned.phone) {
    const digits = cleaned.phone.replace(/\D/g, "");
    if (digits.length < 7) {
      issues.push({ field: "phone", message: `Telefonnummer zu kurz: "${cleaned.phone}"`, severity: "warning" });
      cleaned.phone = "";
    }
  }

  // No duplicate skills
  cleaned.skills = [...new Set(cleaned.skills)];

  // No empty objects in arrays
  cleaned.languages = cleaned.languages.filter(l => l.language.trim().length > 0);
  cleaned.certifications = cleaned.certifications.filter(c => c.name.trim().length > 0);
  cleaned.education = cleaned.education.filter(e => e.degree.trim().length > 0 || e.institution.trim().length > 0);
  cleaned.work_experience = cleaned.work_experience.filter(w => w.role.trim().length > 0 || w.company.trim().length > 0);
  cleaned.highlights = cleaned.highlights.filter(h => h.trim().length > 0);

  // Validate work experience dates
  for (const exp of cleaned.work_experience) {
    if (exp.startYear && exp.endYear && !exp.current) {
      const start = parseInt(exp.startYear, 10);
      const end = parseInt(exp.endYear, 10);
      if (end < start) {
        issues.push({
          field: "work_experience",
          message: `Enddatum vor Startdatum bei "${exp.role}" (${exp.startYear}-${exp.endYear})`,
          severity: "warning",
        });
      }
    }
    // current=true should not have end dates
    if (exp.current && exp.endYear) {
      exp.endMonth = "";
      exp.endYear = "";
    }
  }

  // Validate education dates
  for (const edu of cleaned.education) {
    if (edu.startYear && edu.endYear) {
      const start = parseInt(edu.startYear, 10);
      const end = parseInt(edu.endYear, 10);
      if (end < start) {
        issues.push({
          field: "education",
          message: `Enddatum vor Startdatum bei "${edu.degree}" (${edu.startYear}-${edu.endYear})`,
          severity: "warning",
        });
      }
    }
  }

  // Month validation (1-12)
  for (const exp of cleaned.work_experience) {
    exp.startMonth = validateMonth(exp.startMonth);
    exp.endMonth = validateMonth(exp.endMonth);
  }
  for (const edu of cleaned.education) {
    edu.startMonth = validateMonth(edu.startMonth);
    edu.endMonth = validateMonth(edu.endMonth);
  }

  // Year plausibility
  const currentYear = new Date().getFullYear();
  for (const exp of cleaned.work_experience) {
    exp.startYear = validateYear(exp.startYear, currentYear);
    exp.endYear = validateYear(exp.endYear, currentYear);
  }
  for (const edu of cleaned.education) {
    edu.startYear = validateYear(edu.startYear, currentYear);
    edu.endYear = validateYear(edu.endYear, currentYear);
  }

  // Deduplicate work experience entries
  cleaned.work_experience = deduplicateWorkExperience(cleaned.work_experience);

  // Deduplicate education entries
  cleaned.education = deduplicateEducation(cleaned.education);

  // Status default
  if (!cleaned.status) {
    cleaned.status = "Neu";
  }

  // Internal notes must be empty (no hallucination)
  cleaned.internal_notes = "";

  return { data: cleaned, issues };
}

function validateMonth(m: string): string {
  if (!m) return "";
  const num = parseInt(m, 10);
  if (isNaN(num) || num < 1 || num > 12) return "";
  return String(num).padStart(2, "0");
}

function validateYear(y: string, currentYear: number): string {
  if (!y) return "";
  const num = parseInt(y, 10);
  if (isNaN(num) || num < 1950 || num > currentYear + 5) return "";
  return String(num);
}

function deduplicateWorkExperience(entries: ParsedCvData["work_experience"]): ParsedCvData["work_experience"] {
  const seen = new Set<string>();
  return entries.filter(e => {
    const key = `${e.role.toLowerCase()}|${e.company.toLowerCase()}|${e.startYear}|${e.endYear}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateEducation(entries: ParsedCvData["education"]): ParsedCvData["education"] {
  const seen = new Set<string>();
  return entries.filter(e => {
    const key = `${e.degree.toLowerCase()}|${e.institution.toLowerCase()}|${e.startYear}|${e.endYear}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
