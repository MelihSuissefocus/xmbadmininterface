import { getAllCandidates } from "@/actions/candidates";
import { CvGeneratorClient } from "./cv-generator-client";

export const dynamic = "force-dynamic";

export default async function CvGeneratorPage() {
  const candidates = await getAllCandidates();

  const items = candidates.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    targetRole: c.targetRole ?? null,
    city: c.city ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-foreground">
          CV Generator
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Branded CV als PDF generieren
        </p>
      </div>
      <CvGeneratorClient candidates={items} />
    </div>
  );
}
