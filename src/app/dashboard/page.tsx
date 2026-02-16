import { db } from "@/db";
import { jobs, candidates } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Briefcase, Users, FileCheck, Building2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [publishedJobs, allCandidates, jobStats] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "published"))
      .orderBy(desc(jobs.publishedAt)),
    db.select().from(candidates).orderBy(desc(candidates.createdAt)),
    db
      .select({
        type: jobs.type,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .where(eq(jobs.status, "published"))
      .groupBy(jobs.type),
  ]);

  const permanentCount = jobStats.find((s) => s.type === "permanent")?.count ?? 0;
  const contractCount = jobStats.find((s) => s.type === "contract")?.count ?? 0;

  return { publishedJobs, allCandidates, permanentCount, contractCount };
}

const statusColors = {
  new: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewed: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  placed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const statusLabels = {
  new: "Neu",
  reviewed: "In Prüfung",
  rejected: "Abgelehnt",
  placed: "Platziert",
};

export default async function DashboardPage() {
  const { publishedJobs, allCandidates, permanentCount, contractCount } =
    await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Übersicht aller Stellen und Kandidaten
        </p>
      </div>

      {/* Stats Row - visible on all screens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">Stellen</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{publishedJobs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">aktiv</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground">Kandidaten</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{allCandidates.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">total</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">Festanstellung</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{permanentCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Stellen</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-medium text-muted-foreground">Contracting</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{contractCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Stellen</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Veröffentlichte Stellen */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4 lg:p-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Veröffentlichte Stellen
                </h2>
                <p className="text-xs text-muted-foreground">{publishedJobs.length} aktiv</p>
              </div>
            </div>
            <Link
              href="/dashboard/jobs"
              className="text-xs font-medium text-accent hover:underline flex-shrink-0"
            >
              Alle →
            </Link>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {publishedJobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Keine Stellen veröffentlicht</p>
            ) : (
              <div className="divide-y divide-border">
                {publishedJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="flex items-center justify-between p-3 lg:p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-medium text-sm text-foreground truncate">
                        {job.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {job.location} {job.workload && `· ${job.workload}`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${
                        job.type === "permanent"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                      }`}
                    >
                      {job.type === "permanent" ? "Fest" : "Contract"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alle Kandidaten */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4 lg:p-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Kandidaten
                </h2>
                <p className="text-xs text-muted-foreground">{allCandidates.length} total</p>
              </div>
            </div>
            <Link
              href="/dashboard/candidates"
              className="text-xs font-medium text-accent hover:underline flex-shrink-0"
            >
              Alle →
            </Link>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {allCandidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Keine Kandidaten vorhanden</p>
            ) : (
              <div className="divide-y divide-border">
                {allCandidates.map((candidate) => {
                  const skills = (candidate.skills as string[]) ?? [];

                  return (
                    <Link
                      key={candidate.id}
                      href={`/dashboard/candidates/${candidate.id}`}
                      className="flex items-center gap-3 p-3 lg:p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-accent">
                        {candidate.firstName[0]}{candidate.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm text-foreground truncate">
                            {candidate.firstName} {candidate.lastName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${
                              statusColors[candidate.status]
                            }`}
                          >
                            {statusLabels[candidate.status]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {candidate.targetRole || (skills.length > 0 ? skills.slice(0, 2).join(", ") : candidate.email)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border px-4 py-3">
            {(["new", "reviewed", "placed"] as const).map((status) => {
              const count = allCandidates.filter((c) => c.status === status).length;
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      status === "new"
                        ? "bg-blue-500"
                        : status === "reviewed"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{count}</span>{" "}
                    {statusLabels[status]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
