"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Job } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteJobButton } from "./delete-button";
import {
  Plus,
  Search,
  Filter,
  X,
  MapPin,
  Clock,
  Briefcase,
  Building2,
  Calendar,
  DollarSign,
} from "lucide-react";

interface JobsListProps {
  jobs: Job[];
  availableSkills: string[];
  availableLocations: string[];
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

export function JobsList({ jobs, availableSkills }: JobsListProps) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState("");

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        job.title.toLowerCase().includes(searchLower) ||
        job.clientCompany?.toLowerCase().includes(searchLower) ||
        job.location?.toLowerCase().includes(searchLower) ||
        (job.requiredSkills as string[] | null)?.some((s) =>
          s.toLowerCase().includes(searchLower)
        );

      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(job.status);

      const matchesType = typeFilter.length === 0 || typeFilter.includes(job.type);

      const jobSkills = [
        ...((job.requiredSkills as string[] | null) ?? []),
        ...((job.niceToHaveSkills as string[] | null) ?? []),
      ];
      const matchesSkills =
        skillsFilter.length === 0 ||
        skillsFilter.some((skill) => jobSkills.includes(skill));

      const matchesLocation =
        !locationFilter ||
        job.location?.toLowerCase().includes(locationFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesType && matchesSkills && matchesLocation;
    });
  }, [jobs, search, statusFilter, typeFilter, skillsFilter, locationFilter]);

  const activeFiltersCount =
    statusFilter.length +
    typeFilter.length +
    skillsFilter.length +
    (locationFilter ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter([]);
    setTypeFilter([]);
    setSkillsFilter([]);
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
            Stellenmarkt
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {filteredJobs.length} von {jobs.length} Stellen
          </p>
        </div>
        <Link href="/dashboard/jobs/new">
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground lg:h-9">
            <Plus className="h-4 w-4 lg:mr-2" />
            <span className="hidden lg:inline">Neue Stelle</span>
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
              placeholder="Titel, Kunde, Standort..."
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
                  {(["draft", "published", "archived"] as const).map((status) => (
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

              {/* Type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Art
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(["permanent", "contract"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleArrayFilter(type, typeFilter, setTypeFilter)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        typeFilter.includes(type)
                          ? typeColors[type] + " ring-2 ring-offset-1 ring-border"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {typeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Standort
                </label>
                <Input
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="z.B. Zürich"
                  className="h-9"
                />
              </div>
            </div>

            {/* Skills */}
            {availableSkills.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Skills
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
          </div>
        )}
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {jobs.length === 0 ? "Keine Stellen vorhanden" : "Keine Stellen gefunden"}
          </p>
          {jobs.length === 0 && (
            <Link href="/dashboard/jobs/new">
              <Button className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Erste Stelle anlegen
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {filteredJobs.map((job) => {
              const requiredSkills = (job.requiredSkills as string[]) ?? [];

              return (
                <div
                  key={job.id}
                  className="p-3 lg:p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Type indicator */}
                    <div
                      className={`flex h-10 w-10 lg:h-11 lg:w-11 flex-shrink-0 items-center justify-center rounded-lg ${
                        job.type === "permanent" ? "bg-blue-500" : "bg-violet-500"
                      }`}
                    >
                      <Briefcase className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      {/* Title + badges row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/jobs/${job.id}`}
                            className="font-semibold text-sm lg:text-base text-foreground hover:text-accent block truncate"
                          >
                            {job.title}
                          </Link>
                          {job.clientCompany && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" />
                              {job.clientCompany}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[job.status]}`}>
                            {statusLabels[job.status]}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium hidden sm:inline-flex ${typeColors[job.type]}`}>
                            {job.type === "permanent" ? "Fest" : "Contract"}
                          </span>
                        </div>
                      </div>

                      {/* Details Row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </span>
                        )}
                        {job.workload && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {job.workload}
                          </span>
                        )}
                        {job.type === "permanent" && (job.salaryMin || job.salaryMax) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {job.salaryMin && job.salaryMax
                              ? `${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
                              : job.salaryMin
                              ? `ab ${job.salaryMin.toLocaleString()}`
                              : `bis ${job.salaryMax?.toLocaleString()}`}
                          </span>
                        )}
                        {job.type === "contract" && (job.ratePayroll || job.rateCompany) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {job.ratePayroll && `${job.ratePayroll}/h`}
                            {job.ratePayroll && job.rateCompany && " / "}
                            {job.rateCompany && `${job.rateCompany}/h`}
                          </span>
                        )}
                        {job.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.startDate).toLocaleDateString("de-CH")}
                          </span>
                        )}
                      </div>

                      {/* Skills Row */}
                      {requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {requiredSkills.slice(0, 4).map((skill, i) => (
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
                          {requiredSkills.length > 4 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              +{requiredSkills.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 lg:mt-2">
                        <Link href={`/dashboard/jobs/${job.id}/edit`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Bearbeiten
                          </Button>
                        </Link>
                        <DeleteJobButton id={job.id} title={job.title} />
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
