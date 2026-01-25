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
  ChevronDown,
  ChevronUp,
  DollarSign,
} from "lucide-react";

interface JobsListProps {
  jobs: Job[];
  availableSkills: string[];
  availableLocations: string[];
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

export function JobsList({ jobs, availableSkills, availableLocations }: JobsListProps) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Stellenmarkt
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredJobs.length} von {jobs.length} Stellen
          </p>
        </div>
        <Link href="/dashboard/jobs/new">
          <Button className="bg-amber-500 hover:bg-amber-400 text-black">
            <Plus className="h-4 w-4 mr-2" />
            Neue Stelle
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
              placeholder="Suche nach Titel, Kunde, Standort, Skills..."
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
                  {(["draft", "published", "archived"] as const).map((status) => (
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

              {/* Type */}
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Art
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["permanent", "contract"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleArrayFilter(type, typeFilter, setTypeFilter)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        typeFilter.includes(type)
                          ? typeColors[type] + " ring-2 ring-offset-1 ring-slate-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {typeLabels[type]}
                    </button>
                  ))}
                </div>
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
                  Skills
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
          </div>
        )}
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-500">
            {jobs.length === 0 ? "Keine Stellen vorhanden" : "Keine Stellen gefunden"}
          </p>
          {jobs.length === 0 && (
            <Link href="/dashboard/jobs/new">
              <Button className="mt-4 bg-amber-500 hover:bg-amber-400 text-black">
                <Plus className="h-4 w-4 mr-2" />
                Erste Stelle anlegen
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredJobs.map((job) => {
              const requiredSkills = (job.requiredSkills as string[]) ?? [];

              return (
                <div
                  key={job.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${
                        job.type === "permanent" ? "bg-blue-500" : "bg-violet-500"
                      }`}
                    >
                      <Briefcase className="h-6 w-6 text-white" />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Link
                              href={`/dashboard/jobs/${job.id}`}
                              className="font-semibold text-lg text-slate-900 dark:text-white hover:text-amber-500"
                            >
                              {job.title}
                            </Link>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[job.status]}`}>
                              {statusLabels[job.status]}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[job.type]}`}>
                              {typeLabels[job.type]}
                            </span>
                          </div>
                          {job.clientCompany && (
                            <p className="text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <Building2 className="h-4 w-4" />
                              {job.clientCompany}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link href={`/dashboard/jobs/${job.id}/edit`}>
                            <Button variant="outline" size="sm">
                              Bearbeiten
                            </Button>
                          </Link>
                          <DeleteJobButton id={job.id} title={job.title} />
                        </div>
                      </div>

                      {/* Details Row */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-slate-500">
                        {job.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {job.location}
                            {job.remote && ` (${job.remote})`}
                          </span>
                        )}
                        {job.workload && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {job.workload}
                          </span>
                        )}
                        {job.type === "permanent" && (job.salaryMin || job.salaryMax) && (
                          <span className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4" />
                            {job.salaryMin && job.salaryMax
                              ? `CHF ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
                              : job.salaryMin
                              ? `ab CHF ${job.salaryMin.toLocaleString()}`
                              : `bis CHF ${job.salaryMax?.toLocaleString()}`}
                          </span>
                        )}
                        {job.type === "contract" && (job.ratePayroll || job.rateCompany) && (
                          <span className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4" />
                            {job.ratePayroll && `${job.ratePayroll}/h Payroll`}
                            {job.ratePayroll && job.rateCompany && " / "}
                            {job.rateCompany && `${job.rateCompany}/h Firma`}
                          </span>
                        )}
                        {job.startDate && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            Start: {new Date(job.startDate).toLocaleDateString("de-CH")}
                          </span>
                        )}
                        {job.duration && (
                          <span className="flex items-center gap-1.5">
                            Dauer: {job.duration}
                          </span>
                        )}
                      </div>

                      {/* Skills Row */}
                      {requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {requiredSkills.slice(0, 6).map((skill, i) => (
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
                          {requiredSkills.length > 6 && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                              +{requiredSkills.length - 6} mehr
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

