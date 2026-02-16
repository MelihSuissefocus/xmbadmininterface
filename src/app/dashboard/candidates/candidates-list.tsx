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
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const matchesSearch =
        !search ||
        fullName.includes(searchLower) ||
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
        c.city?.toLowerCase().includes(locationFilter.toLowerCase()) ||
        c.postalCode?.toLowerCase().includes(locationFilter.toLowerCase()) ||
        c.canton?.toLowerCase().includes(locationFilter.toLowerCase());

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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">
            Kandidaten
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {filteredCandidates.length} von {candidates.length}
          </p>
        </div>
        <Link href="/dashboard/candidates/new">
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground lg:h-9">
            <Plus className="h-4 w-4 lg:mr-2" />
            <span className="hidden lg:inline">Neuer Kandidat</span>
          </Button>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, E-Mail, Skills..."
              className="pl-10 h-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 w-10 flex-shrink-0 lg:w-auto lg:px-3 ${activeFiltersCount > 0 ? "border-accent text-accent" : ""}`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden lg:inline lg:ml-2">Filter</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Filter</h3>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Zurücksetzen
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(["new", "reviewed", "rejected", "placed"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleArrayFilter(status, statusFilter, setStatusFilter)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        statusFilter.includes(status)
                          ? statusColors[status] + " ring-2 ring-offset-1 ring-border"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
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
                  className="h-9"
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Standort
                </label>
                <Input
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="PLZ, Ort oder Kanton"
                  className="h-9"
                />
              </div>
            </div>

            {/* Skills */}
            {availableSkills.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Skills (alle müssen vorhanden sein)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {availableSkills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleArrayFilter(skill, skillsFilter, setSkillsFilter)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        skillsFilter.includes(skill)
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Zertifikate (mind. eines)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {availableCertificates.map((cert) => (
                    <button
                      key={cert}
                      onClick={() =>
                        toggleArrayFilter(cert, certificatesFilter, setCertificatesFilter)
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        certificatesFilter.includes(cert)
                          ? "bg-violet-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
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
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {candidates.length === 0
              ? "Keine Kandidaten vorhanden"
              : "Keine Kandidaten gefunden mit diesen Filtern"}
          </p>
          {candidates.length === 0 && (
            <Link href="/dashboard/candidates/new">
              <Button className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Ersten Kandidaten anlegen
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {filteredCandidates.map((candidate) => {
              const skills = (candidate.skills as string[]) ?? [];
              const certificates = (candidate.certificates as { name: string }[]) ?? [];
              const languages = (candidate.languages as { language: string; level: string }[]) ?? [];
              const education = (candidate.education as { degree: string }[]) ?? [];

              return (
                <div
                  key={candidate.id}
                  className="p-3 lg:p-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Mobile: Card layout */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <Link
                      href={`/dashboard/candidates/${candidate.id}`}
                      className="flex-shrink-0"
                    >
                      <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full bg-primary text-sm lg:text-base font-semibold text-accent">
                        {candidate.firstName[0]}{candidate.lastName[0]}
                      </div>
                    </Link>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      {/* Name + Status row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/candidates/${candidate.id}`}
                            className="font-semibold text-sm lg:text-base text-foreground hover:text-accent block truncate"
                          >
                            {candidate.firstName} {candidate.lastName}
                          </Link>
                          {candidate.targetRole && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {candidate.targetRole}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${
                            statusColors[candidate.status]
                          }`}
                        >
                          {statusLabels[candidate.status]}
                        </span>
                      </div>

                      {/* Contact info - compact on mobile */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {candidate.email && (
                          <a
                            href={`mailto:${candidate.email}`}
                            className="flex items-center gap-1 hover:text-accent"
                          >
                            <Mail className="h-3 w-3" />
                            <span className="hidden sm:inline">{candidate.email}</span>
                            <span className="sm:hidden">E-Mail</span>
                          </a>
                        )}
                        {candidate.phone && (
                          <a
                            href={`tel:${candidate.phone}`}
                            className="flex items-center gap-1 hover:text-accent"
                          >
                            <Phone className="h-3 w-3" />
                            <span className="hidden sm:inline">{candidate.phone}</span>
                            <span className="sm:hidden">Anrufen</span>
                          </a>
                        )}
                        {(candidate.city || candidate.canton) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {candidate.city}
                            {candidate.canton && ` (${candidate.canton})`}
                          </span>
                        )}
                        {candidate.yearsOfExperience && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {candidate.yearsOfExperience}J
                          </span>
                        )}
                      </div>

                      {/* Skills Row */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {skills.slice(0, 5).map((skill, i) => (
                            <span
                              key={i}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                skillsFilter.includes(skill)
                                  ? "bg-accent text-accent-foreground"
                                  : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                              }`}
                            >
                              {skill}
                            </span>
                          ))}
                          {skills.length > 5 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              +{skills.length - 5}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions - full width on mobile */}
                      <div className="flex items-center gap-2 mt-3 lg:mt-2">
                        <Link href={`/dashboard/candidates/${candidate.id}/edit`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Bearbeiten
                          </Button>
                        </Link>
                        <DeleteCandidateButton id={candidate.id} name={`${candidate.firstName} ${candidate.lastName}`} />
                      </div>
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
