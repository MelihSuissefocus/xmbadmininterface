import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { JobsList } from "./jobs-list";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));

  const allSkills = new Set<string>();
  const allLocations = new Set<string>();

  allJobs.forEach((job) => {
    (job.requiredSkills as string[] | null)?.forEach((s) => allSkills.add(s));
    (job.niceToHaveSkills as string[] | null)?.forEach((s) => allSkills.add(s));
    if (job.location) allLocations.add(job.location);
  });

  return (
    <JobsList
      jobs={allJobs}
      availableSkills={Array.from(allSkills).sort()}
      availableLocations={Array.from(allLocations).sort()}
    />
  );
}

