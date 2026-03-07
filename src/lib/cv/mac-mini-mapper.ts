import { WORLD_LANGUAGES } from "@/lib/constants";
import type {
  CandidateAutoFillDraftV2,
  ExtractedFieldWithEvidence,
  FieldEvidence,
} from "@/lib/azure-di/types";

// --- Mac Mini CVData types (matches FastAPI Pydantic schema) ---

export interface MacMiniExperience {
  zeitraum: string;
  rolle: string;
  projekt_id?: string | null;
  aufgaben: string[];
  erfolge: string[];
  herausforderungen_und_learnings: string[];
  tools: string[];
}

export interface MacMiniEducation {
  abschluss: string;
  institution: string;
  zeitraum?: string | null;
}

export interface MacMiniLanguage {
  sprache: string;
  niveau?: string | null;
}

export interface MacMiniCVData {
  vorname: string;
  nachname: string;
  email?: string | null;
  telefon?: string | null;
  adresse?: string | null;
  plz?: string | null;
  ort?: string | null;
  kanton?: string | null;
  linkedin?: string | null;
  geburtsdatum?: string | null;
  nationalitaet?: string | null;
  kernkompetenzen: string[];
  sprachen: MacMiniLanguage[];
  erfahrungen: MacMiniExperience[];
  ausbildungen: MacMiniEducation[];
  weiterbildungen: string[];
  gewuenschte_rolle?: string | null;
  verfuegbar_ab?: string | null;
  kuendigungsfrist?: string | null;
  arbeitspensum?: string | null;
  gewuenschter_lohn?: string | null;
  unklare_inhalte?: string | null;
  sonstiger_text?: string[] | null;
}

// --- Helpers ---

const PLACEHOLDER_EVIDENCE: FieldEvidence = {
  page: 1,
  exactText: "",
  confidence: 0.9,
};

function mkField(
  targetField: string,
  value: unknown,
  confidence: "high" | "medium" | "low" = "high"
): ExtractedFieldWithEvidence {
  return {
    targetField,
    extractedValue: value,
    confidence,
    evidence: PLACEHOLDER_EVIDENCE,
  };
}

// Normalize language name to match WORLD_LANGUAGES list
const LANGUAGE_ALIASES: Record<string, string> = {
  german: "Deutsch",
  deutsch: "Deutsch",
  english: "Englisch",
  englisch: "Englisch",
  french: "Französisch",
  französisch: "Französisch",
  franzosisch: "Französisch",
  italian: "Italienisch",
  italienisch: "Italienisch",
  spanish: "Spanisch",
  spanisch: "Spanisch",
  portuguese: "Portugiesisch",
  portugiesisch: "Portugiesisch",
  dutch: "Niederländisch",
  niederländisch: "Niederländisch",
  niederlandisch: "Niederländisch",
  russian: "Russisch",
  russisch: "Russisch",
  polish: "Polnisch",
  polnisch: "Polnisch",
  turkish: "Türkisch",
  türkisch: "Türkisch",
  turkisch: "Türkisch",
  arabic: "Arabisch",
  arabisch: "Arabisch",
  chinese: "Chinesisch (Mandarin)",
  chinesisch: "Chinesisch (Mandarin)",
  mandarin: "Chinesisch (Mandarin)",
  japanese: "Japanisch",
  japanisch: "Japanisch",
  korean: "Koreanisch",
  koreanisch: "Koreanisch",
  hindi: "Hindi",
  serbian: "Serbisch",
  serbisch: "Serbisch",
  croatian: "Kroatisch",
  kroatisch: "Kroatisch",
  albanian: "Albanisch",
  albanisch: "Albanisch",
  greek: "Griechisch",
  griechisch: "Griechisch",
  swedish: "Schwedisch",
  schwedisch: "Schwedisch",
  czech: "Tschechisch",
  tschechisch: "Tschechisch",
  hungarian: "Ungarisch",
  ungarisch: "Ungarisch",
  romanian: "Rumänisch",
  rumänisch: "Rumänisch",
  rumanisch: "Rumänisch",
  bulgarian: "Bulgarisch",
  bulgarisch: "Bulgarisch",
  ukrainian: "Ukrainisch",
  ukrainisch: "Ukrainisch",
  hebrew: "Hebräisch",
  hebräisch: "Hebräisch",
  hebraisch: "Hebräisch",
  persian: "Persisch",
  persisch: "Persisch",
  farsi: "Persisch",
  danish: "Dänisch",
  dänisch: "Dänisch",
  danisch: "Dänisch",
  norwegian: "Norwegisch",
  norwegisch: "Norwegisch",
  finnish: "Finnisch",
  finnisch: "Finnisch",
  bengali: "Bengali",
  urdu: "Urdu",
  indonesian: "Indonesisch",
  indonesisch: "Indonesisch",
  vietnamese: "Vietnamesisch",
  vietnamesisch: "Vietnamesisch",
  thai: "Thai",
  tamil: "Tamil",
  swahili: "Swahili",
  malay: "Malaiisch",
  malaiisch: "Malaiisch",
};

function normalizeLanguageName(raw: string): string | null {
  const trimmed = raw.trim();
  // 1. Exact match in WORLD_LANGUAGES
  if (WORLD_LANGUAGES.includes(trimmed)) return trimmed;
  // 2. Check alias map (case-insensitive)
  const alias = LANGUAGE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  // 3. Fuzzy: strip parenthetical like "Deutsch (Muttersprache)" → "Deutsch"
  const withoutParens = trimmed.replace(/\s*\(.*\)/, "").trim();
  if (WORLD_LANGUAGES.includes(withoutParens)) return withoutParens;
  const aliasClean = LANGUAGE_ALIASES[withoutParens.toLowerCase()];
  if (aliasClean) return aliasClean;
  return null;
}

// Map CEFR-like level strings to valid form values
const LEVEL_MAP: Record<string, string> = {
  a1: "A1",
  a2: "A2",
  b1: "B1",
  b2: "B2",
  c1: "C1",
  c2: "C2",
  muttersprache: "Muttersprache",
  muttersprachlich: "Muttersprache",
  native: "Muttersprache",
  nativ: "Muttersprache",
  "native speaker": "Muttersprache",
  grundkenntnisse: "A2",
  anfänger: "A1",
  anfaenger: "A1",
  mittelstufe: "B1",
  "gute mittelstufe": "B2",
  fortgeschritten: "C1",
  "sehr gut": "C1",
  verhandlungssicher: "C2",
  fliessend: "C2",
  fließend: "C2",
  fluent: "C2",
  gut: "B2",
  "in wort und schrift": "C1",
  beginner: "A1",
  intermediate: "B1",
  advanced: "C1",
  proficient: "C2",
};

function normalizeLevel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[-–_]/g, " ");
  // Direct CEFR match: "B2", "C1"
  const cefrMatch = cleaned.match(/^([abc][12])$/i);
  if (cefrMatch) return cefrMatch[1].toUpperCase();
  // Contains CEFR: "B2 - Gute Mittelstufe"
  const cefrInText = cleaned.match(/([abc][12])/i);
  if (cefrInText) return cefrInText[1].toUpperCase();
  // Map known descriptions
  return LEVEL_MAP[cleaned] ?? null;
}

/**
 * Parse a German date range string like "01/2020 - 12/2023" or "2020 - heute"
 * into structured start/end date objects.
 */
function parseZeitraum(zeitraum: string): {
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  current?: boolean;
} {
  const result: ReturnType<typeof parseZeitraum> = {};

  const normalized = zeitraum
    .replace(/–/g, "-")
    .replace(/bis/gi, "-")
    .trim();

  const parts = normalized.split(/\s*-\s*/);
  if (parts.length < 2) return result;

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  // Parse start: "01/2020", "01.2020", "2020"
  const startMatch = startPart.match(/^(\d{1,2})[./](\d{4})$/);
  if (startMatch) {
    result.startMonth = startMatch[1].padStart(2, "0");
    result.startYear = startMatch[2];
  } else {
    const yearOnly = startPart.match(/^(\d{4})$/);
    if (yearOnly) {
      result.startYear = yearOnly[1];
    }
  }

  // Parse end: "12/2023", "heute", "aktuell", "present"
  const isCurrentKeywords = /^(heute|aktuell|present|current|laufend|ongoing)$/i;
  if (isCurrentKeywords.test(endPart)) {
    result.current = true;
  } else {
    const endMatch = endPart.match(/^(\d{1,2})[./](\d{4})$/);
    if (endMatch) {
      result.endMonth = endMatch[1].padStart(2, "0");
      result.endYear = endMatch[2];
    } else {
      const yearOnly = endPart.match(/^(\d{4})$/);
      if (yearOnly) {
        result.endYear = yearOnly[1];
      }
    }
  }

  return result;
}

// --- Main Mapper ---

export function mapMacMiniToAutoFillDraft(
  data: MacMiniCVData,
  jobMeta: { fileName: string; fileType: string; fileSize: number; jobId: string }
): CandidateAutoFillDraftV2 {
  const filledFields: ExtractedFieldWithEvidence[] = [];
  const ambiguousFields: CandidateAutoFillDraftV2["ambiguousFields"] = [];
  const unmappedItems: CandidateAutoFillDraftV2["unmappedItems"] = [];

  // --- Simple text fields ---
  if (data.vorname) filledFields.push(mkField("firstName", data.vorname));
  if (data.nachname) filledFields.push(mkField("lastName", data.nachname));
  if (data.email) filledFields.push(mkField("email", data.email));
  if (data.telefon) filledFields.push(mkField("phone", data.telefon));
  if (data.adresse) filledFields.push(mkField("street", data.adresse));
  if (data.plz) filledFields.push(mkField("postalCode", data.plz));
  if (data.ort) filledFields.push(mkField("city", data.ort));
  if (data.kanton) filledFields.push(mkField("canton", data.kanton, "medium"));
  if (data.linkedin) filledFields.push(mkField("linkedinUrl", data.linkedin));
  if (data.gewuenschte_rolle) filledFields.push(mkField("targetRole", data.gewuenschte_rolle, "medium"));
  if (data.verfuegbar_ab) filledFields.push(mkField("availableFrom", data.verfuegbar_ab, "medium"));
  if (data.kuendigungsfrist) filledFields.push(mkField("noticePeriod", data.kuendigungsfrist, "medium"));
  if (data.arbeitspensum) filledFields.push(mkField("workloadPreference", data.arbeitspensum, "medium"));

  // Geburtsdatum → ambiguous (user should confirm where it goes)
  if (data.geburtsdatum) {
    ambiguousFields.push({
      extractedLabel: "Geburtsdatum",
      extractedValue: data.geburtsdatum,
      suggestedTargets: [
        { targetField: "birthdate", confidence: "high", reason: "Geburtsdatum aus CV" },
        { targetField: "notes", confidence: "low", reason: "Als Notiz speichern" },
      ],
      evidence: PLACEHOLDER_EVIDENCE,
    });
  }

  // Nationalität → ambiguous
  if (data.nationalitaet) {
    ambiguousFields.push({
      extractedLabel: "Nationalität",
      extractedValue: data.nationalitaet,
      suggestedTargets: [
        { targetField: "nationality", confidence: "high", reason: "Nationalität aus CV" },
        { targetField: "notes", confidence: "low", reason: "Als Notiz speichern" },
      ],
      evidence: PLACEHOLDER_EVIDENCE,
    });
  }

  // Gewünschter Lohn → ambiguous (could be salary or hourly rate)
  if (data.gewuenschter_lohn) {
    ambiguousFields.push({
      extractedLabel: "Gewünschter Lohn",
      extractedValue: data.gewuenschter_lohn,
      suggestedTargets: [
        { targetField: "expectedSalary", confidence: "medium", reason: "Als Jahresgehalt" },
        { targetField: "desiredHourlyRate", confidence: "medium", reason: "Als Stundensatz" },
        { targetField: "notes", confidence: "low", reason: "Als Notiz speichern" },
      ],
      evidence: PLACEHOLDER_EVIDENCE,
    });
  }

  // --- Skills ---
  const allTools = data.erfahrungen.flatMap((e) => e.tools);
  const allSkills = [...new Set([...data.kernkompetenzen, ...allTools])];
  if (allSkills.length > 0) {
    filledFields.push(mkField("skills", allSkills));
  }

  // --- Languages (with proper normalization) ---
  if (data.sprachen.length > 0) {
    const mappedLanguages: { language: string; level: string }[] = [];
    const unmappedLanguages: string[] = [];

    for (const lang of data.sprachen) {
      const rawName = typeof lang === "string" ? lang : lang.sprache;
      const rawLevel = typeof lang === "string" ? null : lang.niveau;

      const normalizedName = normalizeLanguageName(rawName);
      const normalizedLevel = normalizeLevel(rawLevel);

      if (normalizedName) {
        mappedLanguages.push({
          language: normalizedName,
          level: normalizedLevel || "B2",
        });
      } else {
        // Language name couldn't be matched → put in ambiguous so user can handle it
        const displayLevel = normalizedLevel ? ` (${normalizedLevel})` : "";
        ambiguousFields.push({
          extractedLabel: `Sprache: ${rawName}`,
          extractedValue: `${rawName}${displayLevel}`,
          suggestedTargets: [
            { targetField: "notes", confidence: "medium", reason: "Sprache konnte nicht automatisch zugeordnet werden" },
          ],
          evidence: PLACEHOLDER_EVIDENCE,
        });
        unmappedLanguages.push(rawName);
      }
    }

    if (mappedLanguages.length > 0) {
      filledFields.push(mkField("languages", mappedLanguages, "medium"));
    }
  }

  // --- Experience ---
  if (data.erfahrungen.length > 0) {
    const experience = data.erfahrungen.map((exp) => {
      const dates = parseZeitraum(exp.zeitraum);
      const descriptionParts: string[] = [];

      if (exp.aufgaben.length > 0) {
        descriptionParts.push("Aufgaben: " + exp.aufgaben.join("; "));
      }
      if (exp.erfolge.length > 0) {
        descriptionParts.push("Erfolge: " + exp.erfolge.join("; "));
      }
      if (exp.herausforderungen_und_learnings.length > 0) {
        descriptionParts.push("Learnings: " + exp.herausforderungen_und_learnings.join("; "));
      }
      if (exp.tools.length > 0) {
        descriptionParts.push("Tools: " + exp.tools.join(", "));
      }

      return {
        role: exp.rolle,
        company: exp.projekt_id || "",
        startMonth: dates.startMonth,
        startYear: dates.startYear,
        endMonth: dates.endMonth,
        endYear: dates.endYear,
        current: dates.current,
        description: descriptionParts.join("\n") || undefined,
      };
    });
    filledFields.push(mkField("experience", experience));
  }

  // --- Education ---
  if (data.ausbildungen.length > 0) {
    const education = data.ausbildungen.map((edu) => {
      const dates = edu.zeitraum ? parseZeitraum(edu.zeitraum) : {};
      return {
        degree: edu.abschluss,
        institution: edu.institution,
        startMonth: dates.startMonth,
        startYear: dates.startYear,
        endMonth: dates.endMonth,
        endYear: dates.endYear,
      };
    });
    filledFields.push(mkField("education", education));
  }

  // --- Certificates ---
  if (data.weiterbildungen.length > 0) {
    const certificates = data.weiterbildungen.map((w) => ({
      name: w,
      issuer: "",
      date: "",
    }));
    filledFields.push(mkField("certificates", certificates, "medium"));
  }

  // --- Unmapped items: catch-all for everything else ---
  if (data.unklare_inhalte) {
    unmappedItems.push({
      extractedLabel: "Unklare Inhalte",
      extractedValue: data.unklare_inhalte,
      category: "other",
      evidence: PLACEHOLDER_EVIDENCE,
    });
  }

  // sonstiger_text: Every fragment that the LLM couldn't categorize
  if (data.sonstiger_text && data.sonstiger_text.length > 0) {
    for (const text of data.sonstiger_text) {
      if (text.trim()) {
        unmappedItems.push({
          extractedLabel: "Zusätzlicher Text",
          extractedValue: text.trim(),
          category: "text",
          evidence: PLACEHOLDER_EVIDENCE,
        });
      }
    }
  }

  const validFileType = ["pdf", "png", "jpg", "jpeg", "docx"].includes(jobMeta.fileType)
    ? (jobMeta.fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx")
    : "pdf";

  return {
    filledFields,
    ambiguousFields,
    unmappedItems,
    metadata: {
      fileName: jobMeta.fileName,
      fileType: validFileType,
      fileSize: jobMeta.fileSize,
      pageCount: 0,
      processingTimeMs: 0,
      timestamp: new Date().toISOString(),
    },
    extractionVersion: "mac-mini-2.0.0",
    provider: "azure-document-intelligence", // Keep compatible with existing type
  };
}
