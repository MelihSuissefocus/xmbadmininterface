"use server";

import { db } from "@/db";
import { candidates } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { CvContentData } from "@/lib/cv-generator/schema";

/**
 * Gibt eine Kurzliste aller Kandidaten zurück (id + Name).
 */
export async function getCandidateList() {
  const rows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
    })
    .from(candidates)
    .orderBy(candidates.lastName);

  return rows;
}

/**
 * Lädt einen einzelnen Kandidaten und konvertiert ihn in CvContentData.
 */
export async function loadCandidateForCv(
  candidateId: string
): Promise<CvContentData | null> {
  const [row] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!row) return null;

  return {
    personal: {
      firstName: row.firstName,
      lastName: row.lastName,
      photoUrl: null,
      birthDate: row.birthdate ?? null,
      nationality: null,
      city: row.city ?? null,
      canton: row.canton ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      linkedinUrl: row.linkedinUrl ?? null,
      targetRole: row.targetRole ?? null,
    },
    experience: (row.experience ?? []).map((e) => ({
      role: e.role,
      company: e.company,
      startDate:
        e.startYear && e.startMonth
          ? `${e.startYear}-${e.startMonth.padStart(2, "0")}`
          : null,
      endDate: e.current
        ? "present"
        : e.endYear && e.endMonth
          ? `${e.endYear}-${e.endMonth.padStart(2, "0")}`
          : null,
      description: e.description ?? null,
      technologies: [],
    })),
    education: (row.education ?? []).map((e) => ({
      degree: e.degree,
      institution: e.institution,
      startDate:
        e.startYear && e.startMonth
          ? `${e.startYear}-${e.startMonth.padStart(2, "0")}`
          : null,
      endDate:
        e.endYear && e.endMonth
          ? `${e.endYear}-${e.endMonth.padStart(2, "0")}`
          : null,
    })),
    skills: row.skills ?? [],
    languages: (row.languages ?? []).map((l) => ({
      language: l.language,
      level: l.level as "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Muttersprache",
    })),
    certificates: (row.certificates ?? []).map((c) => ({
      name: c.name,
      issuer: c.issuer ?? null,
      date: c.date ?? null,
    })),
    highlights: row.highlights ?? [],
  };
}
