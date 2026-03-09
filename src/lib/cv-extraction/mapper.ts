/**
 * Maps Mac Mini LLM CV extraction response to our internal candidate data structures
 */

import type { MacMiniCvResponse, MacMiniCvSprache } from "./types";
import type {
  FilledField,
  ExperienceEntry,
  EducationEntry,
} from "@/lib/cv-autofill/types";
import type {
  CandidateAutoFillDraftV2,
  ExtractedFieldWithEvidence,
  FieldEvidence,
} from "@/lib/azure-di/types";
import { CV_EXTRACTION_VERSION } from "@/lib/azure-di/types";
import { WORLD_LANGUAGES, LANGUAGE_LEVELS } from "@/lib/constants";

/**
 * Parses a language string like "Deutsch Muttersprache" or "Englisch C1"
 * into { language, level } by matching against known languages and levels.
 */
function parseLanguageString(raw: string): { language: string; level: string } {
  const trimmed = raw.trim();

  // Try to match a known language name (longest match first to handle "Chinesisch (Mandarin)" etc.)
  const sortedLangs = [...WORLD_LANGUAGES].sort((a, b) => b.length - a.length);
  for (const lang of sortedLangs) {
    if (trimmed.toLowerCase().startsWith(lang.toLowerCase())) {
      const rest = trimmed.slice(lang.length).trim();
      // Remove leading separators like "-", "–", ":", ","
      const cleaned = rest.replace(/^[-–:,]\s*/, "").trim();
      const level = matchLevel(cleaned);
      return { language: lang, level };
    }
  }

  // Fallback: split on common separators and try to find a level in the last part
  const parts = trimmed.split(/[-–:,]\s*|\s+/);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim();
    const level = matchLevel(lastPart);
    if (level) {
      return {
        language: parts.slice(0, -1).join(" ").trim(),
        level,
      };
    }
  }

  return { language: trimmed, level: "" };
}

/**
 * Matches a string against known CEFR levels and "Muttersprache".
 */
function matchLevel(text: string): string {
  if (!text) return "";
  const lower = text.toLowerCase();

  // Check for "Muttersprache" variants
  if (lower.includes("muttersprache") || lower.includes("native") || lower.includes("muttersprachlich")) {
    return "Muttersprache";
  }

  // Check CEFR levels (A1, A2, B1, B2, C1, C2)
  for (const lvl of LANGUAGE_LEVELS) {
    if (lower === lvl.value.toLowerCase() || lower.startsWith(lvl.value.toLowerCase())) {
      return lvl.value;
    }
  }

  // Check level label descriptions (e.g. "Fortgeschritten", "Anfänger", "Grundkenntnisse")
  const labelMap: Record<string, string> = {
    "anfänger": "A1",
    "grundkenntnisse": "A2",
    "grundlagen": "A2",
    "mittelstufe": "B1",
    "gute mittelstufe": "B2",
    "fortgeschritten": "C1",
    "fliessend": "C2",
    "fließend": "C2",
    "verhandlungssicher": "C2",
    "beginner": "A1",
    "elementary": "A2",
    "intermediate": "B1",
    "upper intermediate": "B2",
    "advanced": "C1",
    "fluent": "C2",
    "proficient": "C2",
  };
  for (const [keyword, level] of Object.entries(labelMap)) {
    if (lower.includes(keyword)) return level;
  }

  return "";
}

/**
 * Parses a date range string like "01/2020 - 12/2022" or "2020 - heute"
 * into start/end month/year and a current flag.
 */
function parseZeitraum(zeitraum: string): {
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  current: boolean;
} {
  const result = { startMonth: "", startYear: "", endMonth: "", endYear: "", current: false };
  if (!zeitraum) return result;

  const trimmed = zeitraum.trim();

  // Check if end date indicates "current"
  const currentTerms = ["heute", "aktuell", "present", "current", "laufend", "bis heute", "ongoing"];
  const isCurrent = currentTerms.some((term) => trimmed.toLowerCase().includes(term));
  if (isCurrent) result.current = true;

  // Split on common range separators
  const parts = trimmed.split(/\s*[-–—]\s*|\s+bis\s+/i);

  if (parts.length >= 1) {
    const start = parseDatePart(parts[0].trim());
    result.startMonth = start.month;
    result.startYear = start.year;
  }

  if (parts.length >= 2 && !isCurrent) {
    const end = parseDatePart(parts[1].trim());
    result.endMonth = end.month;
    result.endYear = end.year;
  }

  return result;
}

/**
 * Parses a single date part like "01/2020", "01.2020", "Januar 2020", or "2020".
 */
function parseDatePart(text: string): { month: string; year: string } {
  // "MM/YYYY" or "MM.YYYY"
  const mmYyyy = text.match(/^(\d{1,2})[./](\d{4})$/);
  if (mmYyyy) {
    return { month: mmYyyy[1].padStart(2, "0"), year: mmYyyy[2] };
  }

  // "YYYY-MM" (ISO-ish)
  const yyyyMm = text.match(/^(\d{4})[.-](\d{1,2})$/);
  if (yyyyMm) {
    return { month: yyyyMm[2].padStart(2, "0"), year: yyyyMm[1] };
  }

  // Just a year "YYYY"
  const justYear = text.match(/^(\d{4})$/);
  if (justYear) {
    return { month: "", year: justYear[1] };
  }

  // "Month YYYY" in German (e.g. "Januar 2020", "Feb. 2020")
  const monthNames: Record<string, string> = {
    januar: "01", jan: "01", februar: "02", feb: "02", märz: "03", mar: "03",
    april: "04", apr: "04", mai: "05", juni: "06", jun: "06",
    juli: "07", jul: "07", august: "08", aug: "08", september: "09", sep: "09",
    oktober: "10", okt: "10", november: "11", nov: "11", dezember: "12", dez: "12",
    // English
    january: "01", february: "02", march: "03", may: "05", june: "06",
    july: "07", october: "10", december: "12",
  };
  const monthYear = text.match(/^([A-Za-zäöü]+)\.?\s+(\d{4})$/);
  if (monthYear) {
    const monthNum = monthNames[monthYear[1].toLowerCase()];
    if (monthNum) {
      return { month: monthNum, year: monthYear[2] };
    }
  }

  // "seit MM/YYYY" or "ab MM/YYYY"
  const seitMatch = text.match(/(?:seit|ab|from)\s+(\d{1,2})[./](\d{4})/i);
  if (seitMatch) {
    return { month: seitMatch[1].padStart(2, "0"), year: seitMatch[2] };
  }

  return { month: "", year: "" };
}

/**
 * Normalizes a language entry from the Mac Mini API.
 * Handles both string format ("Deutsch Muttersprache") and object format ({sprache, niveau}).
 */
function normalizeLanguageEntry(entry: string | MacMiniCvSprache): { language: string; level: string } {
  if (typeof entry === "string") {
    return parseLanguageString(entry);
  }
  // Object format from v3 API: { sprache: "Deutsch", niveau: "Muttersprache" }
  const level = entry.niveau ? matchLevel(entry.niveau) || entry.niveau : "";
  return { language: entry.sprache, level };
}

/**
 * Helper to push a simple scalar field into filled fields array.
 */
function pushScalarField(
  fields: ExtractedFieldWithEvidence[],
  targetField: string,
  value: string | null | undefined,
  evidence: FieldEvidence,
): void {
  if (value) {
    fields.push({
      targetField,
      extractedValue: value,
      confidence: "medium",
      evidence: { ...evidence, exactText: value },
    });
  }
}

/**
 * Maps the Mac Mini API response to FilledField[] compatible with the existing
 * CV auto-fill / mapping modal flow.
 */
export function mapMacMiniResponseToFilledFields(
  data: MacMiniCvResponse
): FilledField[] {
  const fields: FilledField[] = [];

  if (data.vorname) {
    fields.push({
      targetField: "firstName",
      extractedValue: data.vorname,
      confidence: "high",
      source: { text: data.vorname },
    });
  }

  if (data.nachname) {
    fields.push({
      targetField: "lastName",
      extractedValue: data.nachname,
      confidence: "high",
      source: { text: data.nachname },
    });
  }

  if (data.kernkompetenzen.length > 0) {
    fields.push({
      targetField: "skills",
      extractedValue: data.kernkompetenzen,
      confidence: "high",
      source: { text: `${data.kernkompetenzen.length} Kernkompetenzen` },
    });
  }

  if (data.sprachen.length > 0) {
    fields.push({
      targetField: "languages",
      extractedValue: data.sprachen.map((lang) => normalizeLanguageEntry(lang)),
      confidence: "medium",
      source: { text: `${data.sprachen.length} Sprachen` },
    });
  }

  if (data.erfahrungen.length > 0) {
    const experiences: ExperienceEntry[] = data.erfahrungen.map((erf) => {
      const descriptionParts: string[] = [];
      if (erf.aufgaben.length > 0) {
        descriptionParts.push("Aufgaben: " + erf.aufgaben.join("; "));
      }
      if (erf.erfolge.length > 0) {
        descriptionParts.push("Erfolge: " + erf.erfolge.join("; "));
      }
      if (erf.herausforderungen_und_learnings.length > 0) {
        descriptionParts.push(
          "Learnings: " + erf.herausforderungen_und_learnings.join("; ")
        );
      }
      if (erf.tools.length > 0) {
        descriptionParts.push("Tools: " + erf.tools.join(", "));
      }

      const dates = parseZeitraum(erf.zeitraum);
      return {
        role: erf.rolle,
        company: erf.projekt_id || "",
        description: descriptionParts.join("\n"),
        startMonth: dates.startMonth,
        startYear: dates.startYear,
        endMonth: dates.endMonth,
        endYear: dates.endYear,
        current: dates.current,
      };
    });

    fields.push({
      targetField: "experience",
      extractedValue: experiences,
      confidence: "high",
      source: { text: `${data.erfahrungen.length} Erfahrungen` },
    });
  }

  if (data.ausbildungen.length > 0) {
    const education: EducationEntry[] = data.ausbildungen.map((aus) => ({
      degree: aus.abschluss,
      institution: aus.institution,
      startMonth: "",
      startYear: "",
      endMonth: "",
      endYear: "",
    }));

    fields.push({
      targetField: "education",
      extractedValue: education,
      confidence: "high",
      source: { text: `${data.ausbildungen.length} Ausbildungen` },
    });
  }

  if (data.weiterbildungen.length > 0) {
    fields.push({
      targetField: "certificates",
      extractedValue: data.weiterbildungen.map((wb) => ({
        name: wb,
        issuer: "",
        date: "",
      })),
      confidence: "medium",
      source: { text: `${data.weiterbildungen.length} Weiterbildungen` },
    });
  }

  if (data.erfahrungen.length > 0) {
    const allTools = data.erfahrungen.flatMap((e) => e.tools);
    const uniqueTools = [...new Set(allTools)];
    if (uniqueTools.length > 0) {
      const existingSkills = fields.find((f) => f.targetField === "skills");
      if (existingSkills && Array.isArray(existingSkills.extractedValue)) {
        const merged = [
          ...new Set([
            ...(existingSkills.extractedValue as string[]),
            ...uniqueTools,
          ]),
        ];
        existingSkills.extractedValue = merged;
        existingSkills.source = {
          text: `${merged.length} Skills (Kompetenzen + Tools)`,
        };
      }
    }
  }

  return fields;
}

/**
 * Maps Mac Mini LLM response → CandidateAutoFillDraftV2
 * Used by the local API extraction path in cv-analysis.
 * No evidence data available from local API, so we use a stub.
 */
export function mapMacMiniResponseToDraftV2(
  data: MacMiniCvResponse,
  fileName: string,
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx",
  fileSize: number,
  processingTimeMs: number
): CandidateAutoFillDraftV2 {
  const stubEvidence: FieldEvidence = {
    page: 1,
    exactText: "",
    confidence: 0,
  };

  const filledFields: ExtractedFieldWithEvidence[] = [];

  if (data.vorname) {
    filledFields.push({
      targetField: "firstName",
      extractedValue: data.vorname,
      confidence: "medium",
      evidence: { ...stubEvidence, exactText: data.vorname },
    });
  }

  if (data.nachname) {
    filledFields.push({
      targetField: "lastName",
      extractedValue: data.nachname,
      confidence: "medium",
      evidence: { ...stubEvidence, exactText: data.nachname },
    });
  }

  // v3 API contact fields
  pushScalarField(filledFields, "email", data.email, stubEvidence);
  pushScalarField(filledFields, "phone", data.telefon, stubEvidence);
  pushScalarField(filledFields, "street", data.adresse, stubEvidence);
  pushScalarField(filledFields, "postalCode", data.plz, stubEvidence);
  pushScalarField(filledFields, "city", data.ort, stubEvidence);
  pushScalarField(filledFields, "canton", data.kanton, stubEvidence);
  pushScalarField(filledFields, "linkedinUrl", data.linkedin, stubEvidence);
  pushScalarField(filledFields, "birthdate", data.geburtsdatum, stubEvidence);
  pushScalarField(filledFields, "nationality", data.nationalitaet, stubEvidence);
  pushScalarField(filledFields, "targetRole", data.gewuenschte_rolle, stubEvidence);
  pushScalarField(filledFields, "availableFrom", data.verfuegbar_ab, stubEvidence);
  pushScalarField(filledFields, "noticePeriod", data.kuendigungsfrist, stubEvidence);
  pushScalarField(filledFields, "workloadPreference", data.arbeitspensum, stubEvidence);

  if (data.kernkompetenzen.length > 0) {
    // Merge tools from experiences into skills
    const allTools = data.erfahrungen.flatMap((e) => e.tools);
    const merged = [...new Set([...data.kernkompetenzen, ...allTools])];

    filledFields.push({
      targetField: "skills",
      extractedValue: merged,
      confidence: "medium",
      evidence: { ...stubEvidence, exactText: `${merged.length} Skills` },
    });
  }

  if (data.sprachen.length > 0) {
    filledFields.push({
      targetField: "languages",
      extractedValue: data.sprachen.map((lang) => normalizeLanguageEntry(lang)),
      confidence: "medium",
      evidence: { ...stubEvidence, exactText: `${data.sprachen.length} Sprachen` },
    });
  }

  if (data.erfahrungen.length > 0) {
    const experiences = data.erfahrungen.map((erf) => {
      const descParts: string[] = [];
      if (erf.aufgaben.length > 0) descParts.push("Aufgaben: " + erf.aufgaben.join("; "));
      if (erf.erfolge.length > 0) descParts.push("Erfolge: " + erf.erfolge.join("; "));
      if (erf.herausforderungen_und_learnings.length > 0)
        descParts.push("Learnings: " + erf.herausforderungen_und_learnings.join("; "));
      if (erf.tools.length > 0) descParts.push("Tools: " + erf.tools.join(", "));

      const dates = parseZeitraum(erf.zeitraum);
      return {
        role: erf.rolle,
        company: erf.projekt_id || "",
        description: descParts.join("\n"),
        startMonth: dates.startMonth,
        startYear: dates.startYear,
        endMonth: dates.endMonth,
        endYear: dates.endYear,
        current: dates.current,
      };
    });

    filledFields.push({
      targetField: "experience",
      extractedValue: experiences,
      confidence: "medium",
      evidence: { ...stubEvidence, exactText: `${data.erfahrungen.length} Erfahrungen` },
    });
  }

  if (data.ausbildungen.length > 0) {
    const education = data.ausbildungen.map((aus) => ({
      degree: aus.abschluss,
      institution: aus.institution,
      startMonth: "",
      startYear: "",
      endMonth: "",
      endYear: "",
    }));

    filledFields.push({
      targetField: "education",
      extractedValue: education,
      confidence: "medium",
      evidence: { ...stubEvidence, exactText: `${data.ausbildungen.length} Ausbildungen` },
    });
  }

  if (data.weiterbildungen.length > 0) {
    filledFields.push({
      targetField: "certificates",
      extractedValue: data.weiterbildungen.map((wb) => ({
        name: wb,
        issuer: "",
        date: "",
      })),
      confidence: "medium",
      evidence: { ...stubEvidence, exactText: `${data.weiterbildungen.length} Weiterbildungen` },
    });
  }

  const unmappedItems: CandidateAutoFillDraftV2["unmappedItems"] = [];

  if (data.unklare_inhalte) {
    unmappedItems.push({
      extractedLabel: "Unklare Inhalte",
      extractedValue: data.unklare_inhalte,
      category: "other",
      evidence: { ...stubEvidence, exactText: data.unklare_inhalte },
    });
  }

  if (data.sonstiger_text && data.sonstiger_text.length > 0) {
    for (const text of data.sonstiger_text) {
      unmappedItems.push({
        extractedLabel: "Sonstiger Text",
        extractedValue: text,
        category: "other",
        evidence: { ...stubEvidence, exactText: text },
      });
    }
  }

  return {
    filledFields,
    ambiguousFields: [],
    unmappedItems,
    metadata: {
      fileName,
      fileType,
      fileSize,
      pageCount: 0,
      processingTimeMs,
      timestamp: new Date().toISOString(),
    },
    extractionVersion: CV_EXTRACTION_VERSION,
    provider: "azure-document-intelligence", // kept for type compat
  };
}
