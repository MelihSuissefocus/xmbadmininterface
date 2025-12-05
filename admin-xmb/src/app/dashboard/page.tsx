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
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewed: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  placed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Übersicht aller Stellen und Kandidaten
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Veröffentlichte Stellen */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Veröffentlichte Stellen
                </h2>
                <p className="text-sm text-slate-500">{publishedJobs.length} aktive Stellen</p>
              </div>
            </div>
            <Link
              href="/dashboard/jobs"
              className="text-sm font-medium text-amber-600 hover:text-amber-500"
            >
              Alle anzeigen →
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto p-4">
            {publishedJobs.length === 0 ? (
              <p className="py-8 text-center text-slate-500">Keine Stellen veröffentlicht</p>
            ) : (
              <div className="space-y-3">
                {publishedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-800"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {job.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        {job.location} • {job.workload}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        job.type === "permanent"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                      }`}
                    >
                      {job.type === "permanent" ? "Festanstellung" : "Contracting"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {permanentCount}
                </span>{" "}
                Festanstellungen
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-violet-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {contractCount}
                </span>{" "}
                Contracting
              </span>
            </div>
          </div>
        </div>

        {/* Alle Kandidaten */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Kandidaten
                </h2>
                <p className="text-sm text-slate-500">{allCandidates.length} Kandidaten total</p>
              </div>
            </div>
            <Link
              href="/dashboard/candidates"
              className="text-sm font-medium text-amber-600 hover:text-amber-500"
            >
              Alle anzeigen →
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto p-4">
            {allCandidates.length === 0 ? (
              <p className="py-8 text-center text-slate-500">Keine Kandidaten vorhanden</p>
            ) : (
              <div className="space-y-3">
                {allCandidates.map((candidate) => {
                  const skills = (candidate.skills as string[]) ?? [];

                  return (
                    <Link
                      key={candidate.id}
                      href={`/dashboard/candidates/${candidate.id}`}
                      className="flex items-center gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-amber-400">
                        {candidate.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {candidate.name}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              statusColors[candidate.status]
                            }`}
                          >
                            {statusLabels[candidate.status]}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {candidate.targetRole || (skills.length > 0 ? skills.slice(0, 3).join(", ") : candidate.email)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-slate-200 p-4 dark:border-slate-800">
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
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">{count}</span>{" "}
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
