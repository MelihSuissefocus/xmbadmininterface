import { db } from "@/db";
import { candidates } from "@/db/schema";
import { desc } from "drizzle-orm";
import { CandidatesList } from "./candidates-list";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const allCandidates = await db
    .select()
    .from(candidates)
    .orderBy(desc(candidates.createdAt));

  const allSkills = new Set<string>();
  const allCertificates = new Set<string>();

  allCandidates.forEach((c) => {
    (c.skills as { category: string; details: string }[] | null)?.forEach((s) => allSkills.add(s.details));
    (c.certificates as { name: string }[] | null)?.forEach((cert) =>
      allCertificates.add(cert.name)
    );
  });

  return (
    <CandidatesList
      candidates={allCandidates}
      availableSkills={Array.from(allSkills).sort()}
      availableCertificates={Array.from(allCertificates).sort()}
    />
  );
}
