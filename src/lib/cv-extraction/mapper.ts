/**
 * Maps Mac Mini LLM CV extraction response to our internal candidate data structures
 */

import type { MacMiniCvResponse } from "./types";
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
      extractedValue: data.sprachen.map((lang) => ({
        language: lang,
        level: "",
      })),
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

      return {
        role: erf.rolle,
        company: erf.projekt_id || "",
        description: descriptionParts.join("\n"),
        startMonth: "",
        startYear: "",
        endMonth: "",
        endYear: "",
        current: false,
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
      extractedValue: data.sprachen.map((lang) => ({
        language: lang,
        level: "",
      })),
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

      return {
        role: erf.rolle,
        company: erf.projekt_id || "",
        description: descParts.join("\n"),
        startMonth: "",
        startYear: "",
        endMonth: "",
        endYear: "",
        current: false,
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

  const unmappedItems: CandidateAutoFillDraftV2["unmappedItems"] = [];

  if (data.weiterbildungen.length > 0) {
    for (const wb of data.weiterbildungen) {
      unmappedItems.push({
        extractedLabel: "Weiterbildung",
        extractedValue: wb,
        category: "education",
        evidence: { ...stubEvidence, exactText: wb },
      });
    }
  }

  if (data.unklare_inhalte) {
    unmappedItems.push({
      extractedLabel: "Unklare Inhalte",
      extractedValue: data.unklare_inhalte,
      category: "other",
      evidence: { ...stubEvidence, exactText: data.unklare_inhalte },
    });
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
