"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Candidate } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteCandidateButton } from "./delete-button";
import {
  Plus,
  Search,
  Filter,
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CandidatesListProps {
  candidates: Candidate[];
  availableSkills: string[];
  availableCertificates: string[];
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

export function CandidatesList({
  candidates,
  availableSkills,
  availableCertificates,
}: CandidatesListProps) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);
  const [certificatesFilter, setCertificatesFilter] = useState<string[]>([]);
  const [minExperience, setMinExperience] = useState<number | "">("");
  const [locationFilter, setLocationFilter] = useState("");

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.targetRole?.toLowerCase().includes(searchLower) ||
        (c.skills as string[] | null)?.some((s) =>
          s.toLowerCase().includes(searchLower)
        );

      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(c.status);

      const candidateSkills = (c.skills as string[] | null) ?? [];
      const matchesSkills =
        skillsFilter.length === 0 ||
        skillsFilter.every((skill) => candidateSkills.includes(skill));

      const candidateCerts =
        (c.certificates as { name: string }[] | null)?.map((cert) => cert.name) ?? [];
      const matchesCertificates =
        certificatesFilter.length === 0 ||
        certificatesFilter.some((cert) => candidateCerts.includes(cert));

      const matchesExperience =
        minExperience === "" ||
        (c.yearsOfExperience && c.yearsOfExperience >= minExperience);

      const matchesLocation =
        !locationFilter ||
        c.location?.toLowerCase().includes(locationFilter.toLowerCase());

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSkills &&
        matchesCertificates &&
        matchesExperience &&
        matchesLocation
      );
    });
  }, [
    candidates,
    search,
    statusFilter,
    skillsFilter,
    certificatesFilter,
    minExperience,
    locationFilter,
  ]);

  const activeFiltersCount =
    statusFilter.length +
    skillsFilter.length +
    certificatesFilter.length +
    (minExperience ? 1 : 0) +
    (locationFilter ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter([]);
    setSkillsFilter([]);
    setCertificatesFilter([]);
    setMinExperience("");
    setLocationFilter("");
  };

  const toggleArrayFilter = (
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) => {
    setter(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Kandidaten
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredCandidates.length} von {candidates.length} Kandidaten
          </p>
        </div>
        <Link href="/dashboard/candidates/new">
          <Button className="bg-amber-500 hover:bg-amber-400 text-black">
            <Plus className="h-4 w-4 mr-2" />
            Neuer Kandidat
          </Button>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche nach Name, E-Mail, Rolle, Skills..."
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={activeFiltersCount > 0 ? "border-amber-500 text-amber-600" : ""}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {activeFiltersCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-black">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? (
              <ChevronUp className="h-4 w-4 ml-2" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-2" />
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">Filter</h3>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Zurücksetzen
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Status */}
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["new", "reviewed", "rejected", "placed"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleArrayFilter(status, statusFilter, setStatusFilter)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        statusFilter.includes(status)
                          ? statusColors[status] + " ring-2 ring-offset-1 ring-slate-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Min. Erfahrung (Jahre)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={minExperience}
                  onChange={(e) =>
                    setMinExperience(e.target.value ? parseInt(e.target.value) : "")
                  }
                  placeholder="z.B. 5"
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Standort
                </label>
                <Input
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="z.B. Zürich"
                />
              </div>
            </div>

            {/* Skills */}
            {availableSkills.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Skills (alle müssen vorhanden sein)
                </label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {availableSkills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleArrayFilter(skill, skillsFilter, setSkillsFilter)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        skillsFilter.includes(skill)
                          ? "bg-amber-500 text-black"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Certificates */}
            {availableCertificates.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Zertifikate (mind. eines muss vorhanden sein)
                </label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {availableCertificates.map((cert) => (
                    <button
                      key={cert}
                      onClick={() =>
                        toggleArrayFilter(cert, certificatesFilter, setCertificatesFilter)
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        certificatesFilter.includes(cert)
                          ? "bg-violet-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Candidates List */}
      {filteredCandidates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-500">
            {candidates.length === 0
              ? "Keine Kandidaten vorhanden"
              : "Keine Kandidaten gefunden mit diesen Filtern"}
          </p>
          {candidates.length === 0 && (
            <Link href="/dashboard/candidates/new">
              <Button className="mt-4 bg-amber-500 hover:bg-amber-400 text-black">
                <Plus className="h-4 w-4 mr-2" />
                Ersten Kandidaten anlegen
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCandidates.map((candidate) => {
              const skills = (candidate.skills as string[]) ?? [];
              const certificates = (candidate.certificates as { name: string }[]) ?? [];
              const languages = (candidate.languages as { language: string; level: string }[]) ?? [];
              const education = (candidate.education as { degree: string }[]) ?? [];

              return (
                <div
                  key={candidate.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Link
                      href={`/dashboard/candidates/${candidate.id}`}
                      className="flex-shrink-0"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-amber-400">
                        {candidate.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                    </Link>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/dashboard/candidates/${candidate.id}`}
                              className="font-semibold text-lg text-slate-900 dark:text-white hover:text-amber-500"
                            >
                              {candidate.name}
                            </Link>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                statusColors[candidate.status]
                              }`}
                            >
                              {statusLabels[candidate.status]}
                            </span>
                          </div>
                          {candidate.targetRole && (
                            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                              {candidate.targetRole}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link href={`/dashboard/candidates/${candidate.id}/edit`}>
                            <Button variant="outline" size="sm">
                              Bearbeiten
                            </Button>
                          </Link>
                          <DeleteCandidateButton id={candidate.id} name={candidate.name} />
                        </div>
                      </div>

                      {/* Contact & Key Info Row */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-slate-500">
                        {candidate.email && (
                          <a
                            href={`mailto:${candidate.email}`}
                            className="flex items-center gap-1.5 hover:text-amber-500"
                          >
                            <Mail className="h-4 w-4" />
                            {candidate.email}
                          </a>
                        )}
                        {candidate.phone && (
                          <a
                            href={`tel:${candidate.phone}`}
                            className="flex items-center gap-1.5 hover:text-amber-500"
                          >
                            <Phone className="h-4 w-4" />
                            {candidate.phone}
                          </a>
                        )}
                        {candidate.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {candidate.location}
                          </span>
                        )}
                        {candidate.yearsOfExperience && (
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="h-4 w-4" />
                            {candidate.yearsOfExperience} Jahre Erfahrung
                          </span>
                        )}
                        {education.length > 0 && (
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="h-4 w-4" />
                            {education[0].degree}
                          </span>
                        )}
                      </div>

                      {/* Skills Row */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {skills.slice(0, 8).map((skill, i) => (
                            <span
                              key={i}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                skillsFilter.includes(skill)
                                  ? "bg-amber-500 text-black"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {skill}
                            </span>
                          ))}
                          {skills.length > 8 && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                              +{skills.length - 8} mehr
                            </span>
                          )}
                        </div>
                      )}

                      {/* Certificates Row */}
                      {certificates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Award className="h-4 w-4 text-violet-500" />
                          {certificates.slice(0, 4).map((cert, i) => (
                            <span
                              key={i}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                certificatesFilter.includes(cert.name)
                                  ? "bg-violet-500 text-white"
                                  : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                              }`}
                            >
                              {cert.name}
                            </span>
                          ))}
                          {certificates.length > 4 && (
                            <span className="text-xs text-slate-500">
                              +{certificates.length - 4} mehr
                            </span>
                          )}
                        </div>
                      )}

                      {/* Languages Row */}
                      {languages.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                          <span className="font-medium">Sprachen:</span>
                          {languages.map((lang, i) => (
                            <span key={i}>
                              {lang.language} ({lang.level})
                              {i < languages.length - 1 && ","}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Salary Info */}
                      {(candidate.expectedSalary || candidate.workloadPreference) && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          {candidate.expectedSalary && (
                            <span>
                              Gehaltsvorstellung:{" "}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                CHF {candidate.expectedSalary.toLocaleString("de-CH")}
                              </span>
                            </span>
                          )}
                          {candidate.workloadPreference && (
                            <span>
                              Pensum:{" "}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {candidate.workloadPreference}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

