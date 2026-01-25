/**
 * Field Mapper Utility
 * Maps extracted CV data to candidate form fields
 */

import { LANGUAGE_LEVELS, MONTHS, CANTON_MAPPING, WORLD_LANGUAGES } from "@/lib/constants";
import type {
  ExperienceEntry,
  LanguageEntry,
  SuggestedTarget,
  ConfidenceLevel,
} from "./types";

export interface MappingResult {
  targetField: string | null;
  confidence: ConfidenceLevel;
  reason: string;
}

/**
 * Maps a label/value pair to a candidate form field
 */
export function mapToFormField(label: string, value: string): MappingResult {
  const normalizedLabel = label.toLowerCase().trim();

  // Direct mappings with high confidence
  const directMappings: Record<string, string> = {
    "vorname": "firstName",
    "first name": "firstName",
    "name": "firstName",
    "nachname": "lastName",
    "last name": "lastName",
    "surname": "lastName",
    "familienname": "lastName",
    "email": "email",
    "e-mail": "email",
    "telefon": "phone",
    "phone": "phone",
    "tel": "phone",
    "mobile": "phone",
    "handy": "phone",
    "strasse": "street",
    "street": "street",
    "adresse": "street",
    "address": "street",
    "plz": "postalCode",
    "postal code": "postalCode",
    "postleitzahl": "postalCode",
    "ort": "city",
    "city": "city",
    "stadt": "city",
    "kanton": "canton",
    "canton": "canton",
    "linkedin": "linkedinUrl",
    "linkedin url": "linkedinUrl",
    "linkedin profil": "linkedinUrl",
  };

  if (directMappings[normalizedLabel]) {
    return {
      targetField: directMappings[normalizedLabel],
      confidence: "high",
      reason: "Direct label match",
    };
  }

  // Partial/fuzzy mappings
  if (normalizedLabel.includes("name") && !normalizedLabel.includes("firma") && !normalizedLabel.includes("company")) {
    return {
      targetField: "firstName",
      confidence: "medium",
      reason: "Label contains 'name'",
    };
  }

  if (normalizedLabel.includes("mail")) {
    return {
      targetField: "email",
      confidence: "high",
      reason: "Label contains 'mail'",
    };
  }

  // No clear mapping
  return {
    targetField: null,
    confidence: "low",
    reason: "No matching field found",
  };
}

/**
 * Normalizes language level input to standard format
 */
export function normalizeLanguageLevel(input: string): string {
  const normalized = input.toLowerCase().trim();

  // Direct CEFR levels
  if (/^[abc][12]$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  // Common variations
  const levelMappings: Record<string, string> = {
    "native": "Muttersprache",
    "muttersprache": "Muttersprache",
    "mother tongue": "Muttersprache",
    "muttersprachlich": "Muttersprache",
    "fluent": "C2",
    "fliessend": "C2",
    "fließend": "C2",
    "advanced": "C1",
    "fortgeschritten": "C1",
    "upper intermediate": "B2",
    "intermediate": "B1",
    "mittelstufe": "B1",
    "elementary": "A2",
    "grundkenntnisse": "A2",
    "beginner": "A1",
    "anfänger": "A1",
  };

  if (levelMappings[normalized]) {
    return levelMappings[normalized];
  }

  // Extract CEFR level from text like "Fluent (C1)" or "C1 Level"
  const cefrMatch = input.match(/[ABC][12]/i);
  if (cefrMatch) {
    return cefrMatch[0].toUpperCase();
  }

  // Default to B1 if unclear
  return "B1";
}

/**
 * Normalizes month input to MM format (01-12)
 */
export function normalizeMonth(input: string): string {
  const normalized = input.toLowerCase().trim();

  // Already in MM format
  if (/^(0[1-9]|1[0-2])$/.test(normalized)) {
    return normalized;
  }

  // Month number without leading zero
  if (/^[1-9]$/.test(normalized)) {
    return normalized.padStart(2, '0');
  }

  // German month names
  const germanMonths: Record<string, string> = {
    "januar": "01", "jan": "01",
    "februar": "02", "feb": "02",
    "märz": "03", "mar": "03", "mär": "03",
    "april": "04", "apr": "04",
    "mai": "05", "may": "05",
    "juni": "06", "jun": "06",
    "juli": "07", "jul": "07",
    "august": "08", "aug": "08",
    "september": "09", "sep": "09", "sept": "09",
    "oktober": "10", "okt": "10", "oct": "10",
    "november": "11", "nov": "11",
    "dezember": "12", "dez": "12", "dec": "12",
  };

  // English month names
  const englishMonths: Record<string, string> = {
    "january": "01",
    "february": "02",
    "march": "03",
    "april": "04",
    "may": "05",
    "june": "06",
    "july": "07",
    "august": "08",
    "september": "09",
    "october": "10",
    "november": "11",
    "december": "12",
  };

  if (germanMonths[normalized]) {
    return germanMonths[normalized];
  }

  if (englishMonths[normalized]) {
    return englishMonths[normalized];
  }

  // Default to 01 if unclear
  return "01";
}

/**
 * Calculates years of experience from experience entries
 */
export function calculateYearsOfExperience(experiences: ExperienceEntry[]): number {
  let totalMonths = 0;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  for (const exp of experiences) {
    if (!exp.startYear) continue;

    const startYear = parseInt(exp.startYear);
    const startMonth = exp.startMonth ? parseInt(exp.startMonth) : 1;

    let endYear: number;
    let endMonth: number;

    if (exp.current) {
      endYear = currentYear;
      endMonth = currentMonth;
    } else if (exp.endYear) {
      endYear = parseInt(exp.endYear);
      endMonth = exp.endMonth ? parseInt(exp.endMonth) : 12;
    } else {
      continue;
    }

    const months = (endYear - startYear) * 12 + (endMonth - startMonth);
    totalMonths += Math.max(0, months);
  }

  return Math.round(totalMonths / 12);
}

/**
 * Matches an input skill to system skills
 */
export function matchSkillToSystem(input: string, systemSkills: string[]): string | null {
  const normalized = input.toLowerCase().trim();

  // Exact match (case-insensitive)
  const exactMatch = systemSkills.find(
    (skill) => skill.toLowerCase() === normalized
  );

  if (exactMatch) {
    return exactMatch;
  }

  // Partial match
  const partialMatch = systemSkills.find(
    (skill) => skill.toLowerCase().includes(normalized) || normalized.includes(skill.toLowerCase())
  );

  if (partialMatch) {
    return partialMatch;
  }

  return null;
}

/**
 * Normalizes language name to match WORLD_LANGUAGES
 */
export function normalizeLanguageName(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Exact match
  const exactMatch = WORLD_LANGUAGES.find(
    (lang) => lang.toLowerCase() === normalized
  );

  if (exactMatch) {
    return exactMatch;
  }

  // Common variations
  const languageVariations: Record<string, string> = {
    "german": "Deutsch",
    "deutsch": "Deutsch",
    "english": "Englisch",
    "englisch": "Englisch",
    "french": "Französisch",
    "französisch": "Französisch",
    "italian": "Italienisch",
    "italienisch": "Italienisch",
    "spanish": "Spanisch",
    "spanisch": "Spanisch",
    "portuguese": "Portugiesisch",
    "portugiesisch": "Portugiesisch",
    "russian": "Russisch",
    "russisch": "Russisch",
    "chinese": "Chinesisch (Mandarin)",
    "mandarin": "Chinesisch (Mandarin)",
    "arabic": "Arabisch",
    "arabisch": "Arabisch",
  };

  if (languageVariations[normalized]) {
    return languageVariations[normalized];
  }

  // Partial match
  const partialMatch = WORLD_LANGUAGES.find(
    (lang) => lang.toLowerCase().includes(normalized) || normalized.includes(lang.toLowerCase())
  );

  if (partialMatch) {
    return partialMatch;
  }

  return null;
}

/**
 * Normalizes canton name to standard abbreviation
 */
export function normalizeCanton(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Direct lookup in CANTON_MAPPING
  if (CANTON_MAPPING[normalized]) {
    return CANTON_MAPPING[normalized];
  }

  // Uppercase abbreviation (AG, ZH, etc.)
  const uppercased = input.toUpperCase().trim();
  if (CANTON_MAPPING[uppercased]) {
    return CANTON_MAPPING[uppercased];
  }

  return null;
}

/**
 * Generates suggested targets for an unmapped field
 */
export function generateSuggestedTargets(
  label: string | null,
  value: string,
  category?: string
): SuggestedTarget[] {
  const suggestions: SuggestedTarget[] = [];

  // If we have a label, try mapping
  if (label) {
    const mapping = mapToFormField(label, value);
    if (mapping.targetField) {
      suggestions.push({
        targetField: mapping.targetField,
        confidence: mapping.confidence,
        reason: mapping.reason,
      });
    }
  }

  // Category-based suggestions
  if (category === "contact") {
    suggestions.push({
      targetField: "phone",
      confidence: "medium",
      reason: "Contact information",
    });
    suggestions.push({
      targetField: "email",
      confidence: "low",
      reason: "Alternative contact field",
    });
  }

  if (category === "skill") {
    suggestions.push({
      targetField: "skills",
      confidence: "high",
      reason: "Skill category",
    });
  }

  // Fallback: notes field
  if (suggestions.length === 0) {
    suggestions.push({
      targetField: "notes",
      confidence: "low",
      reason: "Fallback option",
    });
  }

  return suggestions;
}
