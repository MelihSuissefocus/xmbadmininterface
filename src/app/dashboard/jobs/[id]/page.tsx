import { notFound } from "next/navigation";
import Link from "next/link";
import { getJobWithCandidates, getAvailableCandidatesForJob } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Clock,
  Building2,
  Calendar,
  DollarSign,
  Edit,
  User,
  Briefcase,
} from "lucide-react";
import { CandidateAssignment } from "./candidate-assignment";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabels = {
  draft: "Entwurf",
  published: "Veröffentlicht",
  archived: "Archiviert",
};

const typeLabels = {
  permanent: "Festanstellung",
  contract: "Contracting",
};

const typeColors = {
  permanent: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contract: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const data = await getJobWithCandidates(id);

  if (!data) {
    notFound();
  }

  const { job, assignments } = data;
  const availableCandidates = await getAvailableCandidatesForJob(id);

  const requiredSkills = (job.requiredSkills as string[]) ?? [];
  const niceToHaveSkills = (job.niceToHaveSkills as string[]) ?? [];

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">
              {job.title}
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[job.status]}`}>
              {statusLabels[job.status]}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[job.type]}`}>
              {typeLabels[job.type]}
            </span>
          </div>
          {job.clientCompany && (
            <p className="text-sm lg:text-base text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {job.clientCompany}
            </p>
          )}
        </div>
        <Link href={`/dashboard/jobs/${id}/edit`}>
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto">
            <Edit className="h-4 w-4 mr-2" />
            Bearbeiten
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        {/* Left Column - Job Details */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Key Info */}
          <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-3 lg:mb-4">
              Details
            </h2>
            <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-2">
              {job.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Standort</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {job.location} {job.remote && `(${job.remote})`}
                    </p>
                  </div>
                </div>
              )}
              {job.workload && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pensum</p>
                    <p className="text-sm font-medium text-foreground">{job.workload}</p>
                  </div>
                </div>
              )}
              {job.type === "permanent" && (job.salaryMin || job.salaryMax) && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Gehalt</p>
                    <p className="text-sm font-medium text-foreground">
                      {job.salaryMin && job.salaryMax
                        ? `CHF ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
                        : job.salaryMin
                        ? `ab CHF ${job.salaryMin.toLocaleString()}`
                        : `bis CHF ${job.salaryMax?.toLocaleString()}`}
                    </p>
                  </div>
                </div>
              )}
              {job.type === "contract" && job.contractBilling && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Abrechnungsmodell</p>
                    <p className="text-sm font-medium text-foreground">
                      {job.contractBilling === "payroll" && "Nur Payroll"}
                      {job.contractBilling === "company" && "Über Firma"}
                      {job.contractBilling === "hybrid" && "Hybrid (beides)"}
                    </p>
                  </div>
                </div>
              )}
              {job.type === "contract" && job.ratePayroll && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Rate Payroll</p>
                    <p className="text-sm font-medium text-foreground">
                      CHF {job.ratePayroll}/h
                    </p>
                  </div>
                </div>
              )}
              {job.type === "contract" && job.rateCompany && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Rate über Firma</p>
                    <p className="text-sm font-medium text-foreground">
                      CHF {job.rateCompany}/h
                    </p>
                  </div>
                </div>
              )}
              {job.startDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Startdatum</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(job.startDate).toLocaleDateString("de-CH")}
                    </p>
                  </div>
                </div>
              )}
              {job.duration && (
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dauer</p>
                    <p className="text-sm font-medium text-foreground">{job.duration}</p>
                  </div>
                </div>
              )}
              {job.contactPerson && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ansprechpartner</p>
                    <p className="text-sm font-medium text-foreground">{job.contactPerson}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Skills */}
          {(requiredSkills.length > 0 || niceToHaveSkills.length > 0) && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Skills
              </h2>
              {requiredSkills.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Erforderlich</p>
                  <div className="flex flex-wrap gap-1.5">
                    {requiredSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {niceToHaveSkills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Nice-to-Have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {niceToHaveSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Description */}
          {job.description && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Beschreibung
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.description}
              </p>
            </section>
          )}

          {/* Requirements */}
          {job.requirements && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Anforderungen
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.requirements}
              </p>
            </section>
          )}

          {/* Benefits */}
          {job.benefits && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Benefits
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.benefits}
              </p>
            </section>
          )}

          {/* Internal Notes */}
          {job.internalNotes && (
            <section className="rounded-xl border border-accent/30 bg-accent/5 p-4 lg:p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Interne Notizen
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.internalNotes}
              </p>
            </section>
          )}
        </div>

        {/* Right Column - Candidate Assignment */}
        <div className="space-y-4 lg:space-y-6">
          <CandidateAssignment
            jobId={id}
            assignments={assignments}
            availableCandidates={availableCandidates}
          />
        </div>
      </div>
    </div>
  );
}
