import { notFound } from "next/navigation";
import Link from "next/link";
import { getCandidateById } from "@/actions/candidates";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
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
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="flex h-12 w-12 lg:h-16 lg:w-16 items-center justify-center rounded-full bg-primary text-lg lg:text-2xl font-semibold text-accent flex-shrink-0">
            {candidate.firstName[0]}{candidate.lastName[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl lg:text-2xl font-bold text-foreground">
                {candidate.firstName} {candidate.lastName}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  statusColors[candidate.status]
                }`}
              >
                {statusLabels[candidate.status]}
              </span>
            </div>
            {candidate.targetRole && (
              <p className="text-sm lg:text-base text-muted-foreground mt-0.5">
                {candidate.targetRole}
              </p>
            )}
          </div>
        </div>
        <Link href={`/dashboard/candidates/${id}/edit`}>
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto">
            <Edit className="h-4 w-4 mr-2" />
            Bearbeiten
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-4 lg:space-y-6">
          {/* Contact Info */}
          <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Kontakt
            </h2>
            <div className="space-y-3">
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent"
                >
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{candidate.email}</span>
                </a>
              )}
              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent"
                >
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{candidate.phone}</span>
                </a>
              )}
              {(candidate.street || candidate.city || candidate.postalCode || candidate.canton) && (
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
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
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent"
                >
                  <Linkedin className="h-4 w-4 flex-shrink-0" />
                  <span>LinkedIn Profil</span>
                </a>
              )}
            </div>
          </section>

          {/* Professional Info */}
          <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Berufliches
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {candidate.yearsOfExperience && (
                <div>
                  <p className="text-xs text-muted-foreground">Erfahrung</p>
                  <p className="text-sm font-medium text-foreground">
                    {candidate.yearsOfExperience} Jahre
                  </p>
                </div>
              )}
              {candidate.workloadPreference && (
                <div>
                  <p className="text-xs text-muted-foreground">Pensum</p>
                  <p className="text-sm font-medium text-foreground">
                    {candidate.workloadPreference}
                  </p>
                </div>
              )}
              {candidate.availableFrom && (
                <div>
                  <p className="text-xs text-muted-foreground">Verfügbar ab</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(candidate.availableFrom).toLocaleDateString("de-CH")}
                  </p>
                </div>
              )}
              {candidate.noticePeriod && (
                <div>
                  <p className="text-xs text-muted-foreground">Kündigungsfrist</p>
                  <p className="text-sm font-medium text-foreground">
                    {candidate.noticePeriod}
                  </p>
                </div>
              )}
              {candidate.currentSalary && (
                <div>
                  <p className="text-xs text-muted-foreground">Aktuelles Gehalt</p>
                  <p className="text-sm font-medium text-foreground">
                    CHF {candidate.currentSalary.toLocaleString("de-CH")}
                  </p>
                </div>
              )}
              {candidate.expectedSalary && (
                <div>
                  <p className="text-xs text-muted-foreground">Gehaltsvorstellung</p>
                  <p className="text-sm font-medium text-foreground">
                    CHF {candidate.expectedSalary.toLocaleString("de-CH")}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Languages */}
          {languages.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Languages className="h-4 w-4" />
                Sprachen
              </h2>
              <div className="space-y-2">
                {languages.map((lang, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{lang.language}</span>
                    <span className="text-xs text-muted-foreground">{lang.level}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Skills */}
          {skills.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Skills
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {experience.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <Briefcase className="h-4 w-4" />
                Berufserfahrung
              </h2>
              <div className="space-y-5">
                {experience.map((exp, i) => (
                  <div key={i} className="relative pl-5 border-l-2 border-border">
                    <div className="absolute -left-[5px] top-0.5 h-2 w-2 rounded-full bg-accent" />
                    <div>
                      <h3 className="font-medium text-sm text-foreground">
                        {exp.role}
                      </h3>
                      <p className="text-xs text-muted-foreground">{exp.company}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {exp.startMonth} {exp.startYear} – {exp.current ? "Heute" : `${exp.endMonth} ${exp.endYear}`}
                      </p>
                      {exp.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
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
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <GraduationCap className="h-4 w-4" />
                Ausbildung
              </h2>
              <div className="space-y-3">
                {education.map((edu, i) => (
                  <div key={i}>
                    <h3 className="font-medium text-sm text-foreground">
                      {edu.degree}
                    </h3>
                    <p className="text-xs text-muted-foreground">{edu.institution}</p>
                    <p className="text-xs text-muted-foreground">{edu.startMonth} {edu.startYear} – {edu.endMonth} {edu.endYear}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certificates */}
          {certificates.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Award className="h-4 w-4" />
                Zertifikate
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {certificates.map((cert, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-muted/50 p-3"
                  >
                    <h3 className="font-medium text-sm text-foreground">
                      {cert.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                    {cert.date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
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
            <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <FileText className="h-4 w-4" />
                Interne Notizen
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {candidate.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
