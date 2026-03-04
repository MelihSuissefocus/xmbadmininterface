/**
 * Maps Mac Mini LLM CV extraction response to our internal candidate data structures
 */

import type { MacMiniCvResponse } from "./types";
import type {
  FilledField,
  ExperienceEntry,
  EducationEntry,
} from "@/lib/cv-autofill/types";

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
