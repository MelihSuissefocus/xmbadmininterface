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
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
  permanent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contract: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {job.title}
            </h1>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[job.status]}`}>
              {statusLabels[job.status]}
            </span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${typeColors[job.type]}`}>
              {typeLabels[job.type]}
            </span>
          </div>
          {job.clientCompany && (
            <p className="text-lg text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {job.clientCompany}
            </p>
          )}
        </div>
        <Link href={`/dashboard/jobs/${id}/edit`}>
          <Button className="bg-amber-500 hover:bg-amber-400 text-black">
            <Edit className="h-4 w-4 mr-2" />
            Bearbeiten
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Job Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Info */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Details
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {job.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Standort</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {job.location} {job.remote && `(${job.remote})`}
                    </p>
                  </div>
                </div>
              )}
              {job.workload && (
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Pensum</p>
                    <p className="font-medium text-slate-900 dark:text-white">{job.workload}</p>
                  </div>
                </div>
              )}
              {job.type === "permanent" && (job.salaryMin || job.salaryMax) && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Gehalt</p>
                    <p className="font-medium text-slate-900 dark:text-white">
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
                  <DollarSign className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Abrechnungsmodell</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {job.contractBilling === "payroll" && "Nur Payroll"}
                      {job.contractBilling === "company" && "Über Firma"}
                      {job.contractBilling === "hybrid" && "Hybrid (beides)"}
                    </p>
                  </div>
                </div>
              )}
              {job.type === "contract" && job.ratePayroll && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Rate Payroll</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      CHF {job.ratePayroll}/h
                    </p>
                  </div>
                </div>
              )}
              {job.type === "contract" && job.rateCompany && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Rate über Firma</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      CHF {job.rateCompany}/h
                    </p>
                  </div>
                </div>
              )}
              {job.startDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Startdatum</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {new Date(job.startDate).toLocaleDateString("de-CH")}
                    </p>
                  </div>
                </div>
              )}
              {job.duration && (
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Dauer</p>
                    <p className="font-medium text-slate-900 dark:text-white">{job.duration}</p>
                  </div>
                </div>
              )}
              {job.contactPerson && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Ansprechpartner</p>
                    <p className="font-medium text-slate-900 dark:text-white">{job.contactPerson}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Skills */}
          {(requiredSkills.length > 0 || niceToHaveSkills.length > 0) && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Skills
              </h2>
              {requiredSkills.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-500 mb-2">Erforderlich</p>
                  <div className="flex flex-wrap gap-2">
                    {requiredSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {niceToHaveSkills.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-2">Nice-to-Have</p>
                  <div className="flex flex-wrap gap-2">
                    {niceToHaveSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-400"
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
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Beschreibung
              </h2>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {job.description}
              </p>
            </section>
          )}

          {/* Requirements */}
          {job.requirements && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Anforderungen
              </h2>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {job.requirements}
              </p>
            </section>
          )}

          {/* Benefits */}
          {job.benefits && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Benefits
              </h2>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {job.benefits}
              </p>
            </section>
          )}

          {/* Internal Notes */}
          {job.internalNotes && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Interne Notizen
              </h2>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {job.internalNotes}
              </p>
            </section>
          )}
        </div>

        {/* Right Column - Candidate Assignment */}
        <div className="space-y-6">
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

