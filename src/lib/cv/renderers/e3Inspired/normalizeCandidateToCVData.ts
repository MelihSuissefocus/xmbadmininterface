import type { Candidate } from "@/db/schema";
import type { CVData, CVVariant } from "./types";

/**
 * Maps "customer" | "internal" from the API to the renderer's CVVariant.
 * "customer" → "external" (no contact info), "internal" → "internal".
 */
function toRendererVariant(variant: "customer" | "internal"): CVVariant {
  return variant === "customer" ? "external" : "internal";
}

/** Formats "01" + "2022" → "01/2022", handling empty/missing parts. */
function fmtMonthYear(month?: string | null, year?: string | null): string {
  if (!year) return "";
  if (!month) return year;
  return `${month}/${year}`;
}

/** Builds a period label like "01/2020 – 06/2023" or "seit 01/2020". */
function periodLabel(
  startMonth?: string | null,
  startYear?: string | null,
  endMonth?: string | null,
  endYear?: string | null,
  current?: boolean,
): string {
  const start = fmtMonthYear(startMonth, startYear);
  if (!start) return "";
  if (current) return `seit ${start}`;
  const end = fmtMonthYear(endMonth, endYear);
  if (!end) return start;
  return `${start} – ${end}`;
}

/**
 * Normalizes a DB Candidate row into the CVData rendering model.
 */
export function normalizeCandidateToCVData(
  candidate: Candidate,
  variant: "customer" | "internal",
): CVData {
  return {
    variant: toRendererVariant(variant),
    personal: {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      targetRole: candidate.targetRole,
      email: candidate.email,
      phone: candidate.phone,
      city: candidate.city,
    },
    languages: (candidate.languages ?? []).map((l) => ({
      language: l.language,
      level: l.level,
    })),
    skills: candidate.skills ?? [],
    highlights: candidate.highlights ?? [],
    education: (candidate.education ?? []).map((e) => ({
      periodLabel: periodLabel(e.startMonth, e.startYear, e.endMonth, e.endYear),
      title: e.degree,
      institution: e.institution,
    })),
    certificates: (candidate.certificates ?? []).map((c) => ({
      name: c.name,
      issuer: c.issuer || null,
      date: c.date || null,
    })),
    experience: (candidate.experience ?? []).map((exp) => ({
      periodLabel: periodLabel(
        exp.startMonth,
        exp.startYear,
        exp.endMonth,
        exp.endYear,
        exp.current,
      ),
      titleLine: [exp.role, exp.company].filter(Boolean).join(" – "),
      descriptionLines: exp.description
        ? exp.description.split("\n").filter((line) => line.trim().length > 0)
        : [],
    })),
  };
}
