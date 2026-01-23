import { notFound } from "next/navigation";
import Link from "next/link";
import { getCandidateById } from "@/actions/candidates";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Calendar,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  Edit,
  FileText,
} from "lucide-react";

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
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

export default async function CandidateDetailPage({
  params,
}: CandidateDetailPageProps) {
  const { id } = await params;
  const candidate = await getCandidateById(id);

  if (!candidate) {
    notFound();
  }

  const skills = (candidate.skills as string[]) ?? [];
  const certificates = (candidate.certificates as { name: string; issuer: string; date: string }[]) ?? [];
  const languages = (candidate.languages as { language: string; level: string }[]) ?? [];
  const education = (candidate.education as { degree: string; institution: string; startMonth: string; startYear: string; endMonth: string; endYear: string }[]) ?? [];
  const experience = (candidate.experience as {
    role: string;
    company: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
    current: boolean;
    description: string;
  }[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-2xl font-semibold text-amber-400">
            {candidate.firstName[0]}{candidate.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {candidate.firstName} {candidate.lastName}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  statusColors[candidate.status]
                }`}
              >
                {statusLabels[candidate.status]}
              </span>
            </div>
            {candidate.targetRole && (
              <p className="text-lg text-slate-500 dark:text-slate-400">
                {candidate.targetRole}
              </p>
            )}
          </div>
        </div>
        <Link href={`/dashboard/candidates/${id}/edit`}>
          <Button className="bg-amber-500 hover:bg-amber-400 text-black">
            <Edit className="h-4 w-4 mr-2" />
            Bearbeiten
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Contact Info */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Kontakt
            </h2>
            <div className="space-y-3">
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="flex items-center gap-3 text-slate-600 hover:text-amber-500 dark:text-slate-400"
                >
                  <Mail className="h-5 w-5" />
                  <span>{candidate.email}</span>
                </a>
              )}
              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  className="flex items-center gap-3 text-slate-600 hover:text-amber-500 dark:text-slate-400"
                >
                  <Phone className="h-5 w-5" />
                  <span>{candidate.phone}</span>
                </a>
              )}
              {(candidate.street || candidate.city || candidate.postalCode || candidate.canton) && (
                <div className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <MapPin className="h-5 w-5 mt-0.5" />
                  <div className="flex flex-col">
                    {candidate.street && <span>{candidate.street}</span>}
                    {(candidate.postalCode || candidate.city) && (
                      <span>
                        {candidate.postalCode && `${candidate.postalCode} `}
                        {candidate.city}
                      </span>
                    )}
                    {candidate.canton && <span>{candidate.canton}</span>}
                  </div>
                </div>
              )}
              {candidate.linkedinUrl && (
                <a
                  href={candidate.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-slate-600 hover:text-amber-500 dark:text-slate-400"
                >
                  <Linkedin className="h-5 w-5" />
                  <span>LinkedIn Profil</span>
                </a>
              )}
            </div>
          </section>

          {/* Professional Info */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Berufliches
            </h2>
            <div className="space-y-4">
              {candidate.yearsOfExperience && (
                <div>
                  <p className="text-sm text-slate-500">Erfahrung</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {candidate.yearsOfExperience} Jahre
                  </p>
                </div>
              )}
              {candidate.workloadPreference && (
                <div>
                  <p className="text-sm text-slate-500">Pensum</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {candidate.workloadPreference}
                  </p>
                </div>
              )}
              {candidate.availableFrom && (
                <div>
                  <p className="text-sm text-slate-500">Verfügbar ab</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {new Date(candidate.availableFrom).toLocaleDateString("de-CH")}
                  </p>
                </div>
              )}
              {candidate.noticePeriod && (
                <div>
                  <p className="text-sm text-slate-500">Kündigungsfrist</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {candidate.noticePeriod}
                  </p>
                </div>
              )}
              {(candidate.currentSalary || candidate.expectedSalary) && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  {candidate.currentSalary && (
                    <div className="mb-2">
                      <p className="text-sm text-slate-500">Aktuelles Gehalt</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        CHF {candidate.currentSalary.toLocaleString("de-CH")}
                      </p>
                    </div>
                  )}
                  {candidate.expectedSalary && (
                    <div>
                      <p className="text-sm text-slate-500">Gehaltsvorstellung</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        CHF {candidate.expectedSalary.toLocaleString("de-CH")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Languages */}
          {languages.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-4">
                <Languages className="h-5 w-5" />
                Sprachen
              </h2>
              <div className="space-y-2">
                {languages.map((lang, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-slate-900 dark:text-white">{lang.language}</span>
                    <span className="text-sm text-slate-500">{lang.level}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills */}
          {skills.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {experience.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-4">
                <Briefcase className="h-5 w-5" />
                Berufserfahrung
              </h2>
              <div className="space-y-6">
                {experience.map((exp, i) => (
                  <div key={i} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                    <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-amber-500" />
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {exp.role}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400">{exp.company}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {exp.startMonth} {exp.startYear} – {exp.current ? "Heute" : `${exp.endMonth} ${exp.endYear}`}
                      </p>
                      {exp.description && (
                        <p className="mt-2 text-slate-600 dark:text-slate-400">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education */}
          {education.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-4">
                <GraduationCap className="h-5 w-5" />
                Ausbildung
              </h2>
              <div className="space-y-4">
                {education.map((edu, i) => (
                  <div key={i}>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {edu.degree}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">{edu.institution}</p>
                    <p className="text-sm text-slate-500">{edu.startMonth} {edu.startYear} – {edu.endMonth} {edu.endYear}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certificates */}
          {certificates.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-4">
                <Award className="h-5 w-5" />
                Zertifikate
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {certificates.map((cert, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                  >
                    <h3 className="font-medium text-slate-900 dark:text-white">
                      {cert.name}
                    </h3>
                    <p className="text-sm text-slate-500">{cert.issuer}</p>
                    {cert.date && (
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(cert.date).toLocaleDateString("de-CH")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          {candidate.notes && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white mb-4">
                <FileText className="h-5 w-5" />
                Interne Notizen
              </h2>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {candidate.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

