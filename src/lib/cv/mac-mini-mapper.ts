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
}

export interface MacMiniCVData {
  vorname: string;
  nachname: string;
  kernkompetenzen: string[];
  sprachen: string[];
  erfahrungen: MacMiniExperience[];
  ausbildungen: MacMiniEducation[];
  weiterbildungen: string[];
  unklare_inhalte?: string | null;
}

// --- Helpers ---

const PLACEHOLDER_EVIDENCE: FieldEvidence = {
  page: 1,
  exactText: "",
  confidence: 0.9,
};

function field(
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

  // Simple text fields
  if (data.vorname) {
    filledFields.push(field("firstName", data.vorname));
  }
  if (data.nachname) {
    filledFields.push(field("lastName", data.nachname));
  }

  // Skills: kernkompetenzen + all tools from experiences
  const allTools = data.erfahrungen.flatMap((e) => e.tools);
  const allSkills = [...new Set([...data.kernkompetenzen, ...allTools])];
  if (allSkills.length > 0) {
    filledFields.push(field("skills", allSkills));
  }

  // Languages (no level info from Mac Mini)
  if (data.sprachen.length > 0) {
    const languages = data.sprachen.map((lang) => ({
      language: lang,
      level: "B2" as const, // Default — user can adjust in mapping modal
    }));
    filledFields.push(field("languages", languages, "medium"));
  }

  // Experience
  if (data.erfahrungen.length > 0) {
    const experience = data.erfahrungen.map((exp) => {
      const dates = parseZeitraum(exp.zeitraum);
      const descriptionParts: string[] = [];

      if (exp.aufgaben.length > 0) {
        descriptionParts.push(exp.aufgaben.join("; "));
      }
      if (exp.erfolge.length > 0) {
        descriptionParts.push("Erfolge: " + exp.erfolge.join("; "));
      }
      if (exp.herausforderungen_und_learnings.length > 0) {
        descriptionParts.push("Learnings: " + exp.herausforderungen_und_learnings.join("; "));
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
    filledFields.push(field("experience", experience));
  }

  // Education
  if (data.ausbildungen.length > 0) {
    const education = data.ausbildungen.map((edu) => ({
      degree: edu.abschluss,
      institution: edu.institution,
    }));
    filledFields.push(field("education", education));
  }

  // Certificates (Weiterbildungen)
  if (data.weiterbildungen.length > 0) {
    const certificates = data.weiterbildungen.map((w) => ({
      name: w,
      issuer: "",
      date: "",
    }));
    filledFields.push(field("certificates", certificates, "medium"));
  }

  // Unmapped items
  const unmappedItems: CandidateAutoFillDraftV2["unmappedItems"] = [];
  if (data.unklare_inhalte) {
    unmappedItems.push({
      extractedLabel: "Unklare Inhalte",
      extractedValue: data.unklare_inhalte,
      category: "other",
      evidence: PLACEHOLDER_EVIDENCE,
    });
  }

  const validFileType = ["pdf", "png", "jpg", "jpeg", "docx"].includes(jobMeta.fileType)
    ? (jobMeta.fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx")
    : "pdf";

  return {
    filledFields,
    ambiguousFields: [],
    unmappedItems,
    metadata: {
      fileName: jobMeta.fileName,
      fileType: validFileType,
      fileSize: jobMeta.fileSize,
      pageCount: 0,
      processingTimeMs: 0,
      timestamp: new Date().toISOString(),
    },
    extractionVersion: "mac-mini-1.0.0",
    provider: "azure-document-intelligence", // Keep compatible with existing type
  };
}
