"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createJob, updateJob } from "@/actions/jobs";
import { Job, NewJob } from "@/db/schema";
import { Plus, X, Save, Loader2 } from "lucide-react";

interface JobFormProps {
  job?: Job;
}

type ContractBilling = "payroll" | "company" | "hybrid";

export function JobForm({ job }: JobFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<{
    referenceNumber: string;
    industry: string;
    endDate: string;
    title: string;
    type: "permanent" | "contract";
    description: string;
    requirements: string;
    benefits: string;
    workload: string;
    location: string;
    remote: string;
    salaryMin: number;
    salaryMax: number;
    contractBilling: ContractBilling | null;
    ratePayroll: number;
    rateCompany: number;
    startDate: string;
    duration: string;
    contactPerson: string;
    clientCompany: string;
    internalNotes: string;
    status: "draft" | "published" | "archived";
  }>({
    referenceNumber: job?.referenceNumber ?? "",
    industry: job?.industry ?? "",
    endDate: job?.endDate ?? "",
    title: job?.title ?? "",
    type: job?.type ?? "permanent",
    description: job?.description ?? "",
    requirements: job?.requirements ?? "",
    benefits: job?.benefits ?? "",
    workload: job?.workload ?? "",
    location: job?.location ?? "",
    remote: job?.remote ?? "",
    salaryMin: job?.salaryMin ?? 0,
    salaryMax: job?.salaryMax ?? 0,
    contractBilling: job?.contractBilling ?? null,
    ratePayroll: job?.ratePayroll ?? 0,
    rateCompany: job?.rateCompany ?? 0,
    startDate: job?.startDate ?? "",
    duration: job?.duration ?? "",
    contactPerson: job?.contactPerson ?? "",
    clientCompany: job?.clientCompany ?? "",
    internalNotes: job?.internalNotes ?? "",
    status: job?.status ?? "draft",
  });

  const [languages, setLanguages] = useState<{ lang: string; level: string }[]>(
    (job?.languages as { lang: string; level: string }[]) ?? []
  );

  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    (job?.requiredSkills as string[]) ?? []
  );
  const [newRequiredSkill, setNewRequiredSkill] = useState("");

  const [niceToHaveSkills, setNiceToHaveSkills] = useState<string[]>(
    (job?.niceToHaveSkills as string[]) ?? []
  );
  const [newNiceToHaveSkill, setNewNiceToHaveSkill] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.type === "contract" && !formData.contractBilling) {
      setError("Bitte wähle ein Abrechnungsmodell für Contracting");
      setLoading(false);
      return;
    }

    const data: NewJob = {
      ...formData,
      salaryMin: formData.type === "permanent" ? (Number(formData.salaryMin) || null) : null,
      salaryMax: formData.type === "permanent" ? (Number(formData.salaryMax) || null) : null,
      contractBilling: formData.type === "contract" ? formData.contractBilling : null,
      ratePayroll: formData.type === "contract" ? (Number(formData.ratePayroll) || null) : null,
      rateCompany: formData.type === "contract" ? (Number(formData.rateCompany) || null) : null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      workload: formData.workload || null,
      requiredSkills,
      niceToHaveSkills,
      languages: languages,
    };

    const result = job ? await updateJob(job.id, data) : await createJob(data);

    setLoading(false);

    if (result.success) {
      router.push("/dashboard/jobs");
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const addLanguage = () => {
    setLanguages([...languages, { lang: "", level: "" }]);
  };

  const updateLanguage = (index: number, field: "lang" | "level", value: string) => {
    const newLanguages = [...languages];
    newLanguages[index][field] = value;
    setLanguages(newLanguages);
  };

  const removeLanguage = (index: number) => {
    setLanguages(languages.filter((_, i) => i !== index));
  };

  const addSkill = (
    newSkill: string,
    skills: string[],
    setSkills: (s: string[]) => void,
    setNewSkill: (s: string) => void
  ) => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (index: number, skills: string[], setSkills: (s: string[]) => void) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleTypeChange = (newType: "permanent" | "contract") => {
    setFormData({
      ...formData,
      type: newType,
      contractBilling: newType === "contract" ? (formData.contractBilling ?? "payroll") : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Grundinformationen
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-1">
            <Label htmlFor="referenceNumber">Referenznummer</Label>
            <Input
              id="referenceNumber"
              value={formData.referenceNumber}
              onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              placeholder="z.B. XMB-2025-042"
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-1">
            <Label htmlFor="industry">Branche</Label>
            <Input
              id="industry"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              placeholder="z.B. Finanzdienstleistungen"
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="z.B. Senior React Developer"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="type">Art *</Label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => handleTypeChange(e.target.value as "permanent" | "contract")}
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="permanent">Festanstellung</option>
              <option value="contract">Contracting</option>
            </select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as "draft" | "published" | "archived" })}
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="draft">Entwurf</option>
              <option value="published">Veröffentlicht</option>
              <option value="archived">Archiviert</option>
            </select>
          </div>
          <div>
            <Label htmlFor="clientCompany">Kunde / Unternehmen</Label>
            <Input
              id="clientCompany"
              value={formData.clientCompany}
              onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
              placeholder="z.B. Swisscom AG"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="contactPerson">Ansprechpartner</Label>
            <Input
              id="contactPerson"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="Name des Ansprechpartners"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="endDate">Enddatum</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Sprachen
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={addLanguage}>
            <Plus className="h-4 w-4 mr-2" />
            Sprache hinzufügen
          </Button>
        </div>
        <div className="space-y-3">
          {languages.map((lang, index) => (
            <div key={index} className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor={`lang-${index}`}>Sprache</Label>
                <Input
                  id={`lang-${index}`}
                  value={lang.lang}
                  onChange={(e) => updateLanguage(index, "lang", e.target.value)}
                  placeholder="z.B. Deutsch"
                  className="mt-1.5"
                />
              </div>
              <div className="w-32">
                <Label htmlFor={`level-${index}`}>Niveau</Label>
                <select
                  id={`level-${index}`}
                  value={lang.level}
                  onChange={(e) => updateLanguage(index, "level", e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Wählen...</option>
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                  <option value="Muttersprache">Muttersprache</option>
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLanguage(index)}
                className="mb-0.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {languages.length === 0 && (
            <p className="text-sm text-slate-500 italic">Keine Sprachen erfasst.</p>
          )}
        </div>
      </section>

      {/* Location & Work Details */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Arbeitsort & Konditionen
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="location">Standort</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="z.B. Zürich"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="remote">Remote-Optionen</Label>
            <select
              id="remote"
              value={formData.remote}
              onChange={(e) => setFormData({ ...formData, remote: e.target.value })}
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Vor Ort</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Remote">Full Remote</option>
              <option value="Flexibel">Flexibel</option>
            </select>
          </div>
          <div>
            <Label htmlFor="workload">Pensum</Label>
            <Input
              id="workload"
              value={formData.workload}
              onChange={(e) => setFormData({ ...formData, workload: e.target.value })}
              placeholder="z.B. 80-100% oder 60%"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="startDate">Startdatum</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="mt-1.5"
            />
          </div>
          {formData.type === "contract" && (
            <div>
              <Label htmlFor="duration">Dauer</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="z.B. 6 Monate"
                className="mt-1.5"
              />
            </div>
          )}
        </div>
      </section>

      {/* Salary/Rate Section - Conditional */}
      {formData.type === "permanent" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Gehalt (Festanstellung)
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="salaryMin">Minimum (CHF/Jahr)</Label>
              <Input
                id="salaryMin"
                type="number"
                value={formData.salaryMin || ""}
                onChange={(e) => setFormData({ ...formData, salaryMin: parseInt(e.target.value) || 0 })}
                placeholder="z.B. 100000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="salaryMax">Maximum (CHF/Jahr)</Label>
              <Input
                id="salaryMax"
                type="number"
                value={formData.salaryMax || ""}
                onChange={(e) => setFormData({ ...formData, salaryMax: parseInt(e.target.value) || 0 })}
                placeholder="z.B. 130000"
                className="mt-1.5"
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-900/20">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Contracting - Raten & Abrechnungsmodell
          </h2>

          {/* Billing Type Radio Buttons */}
          <div className="mb-6">
            <Label className="mb-3 block">Abrechnungsmodell *</Label>
            <div className="grid gap-3 md:grid-cols-3">
              <label
                className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${formData.contractBilling === "payroll"
                  ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40"
                  : "border-slate-200 hover:border-violet-300 dark:border-slate-700"
                  }`}
              >
                <input
                  type="radio"
                  name="contractBilling"
                  value="payroll"
                  checked={formData.contractBilling === "payroll"}
                  onChange={() => setFormData({ ...formData, contractBilling: "payroll" })}
                  className="h-4 w-4 text-violet-600"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Nur Payroll</p>
                  <p className="text-xs text-slate-500">Abrechnung über Payroll</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${formData.contractBilling === "company"
                  ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40"
                  : "border-slate-200 hover:border-violet-300 dark:border-slate-700"
                  }`}
              >
                <input
                  type="radio"
                  name="contractBilling"
                  value="company"
                  checked={formData.contractBilling === "company"}
                  onChange={() => setFormData({ ...formData, contractBilling: "company" })}
                  className="h-4 w-4 text-violet-600"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Über Firma</p>
                  <p className="text-xs text-slate-500">Verrechnung über eigene Firma</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${formData.contractBilling === "hybrid"
                  ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40"
                  : "border-slate-200 hover:border-violet-300 dark:border-slate-700"
                  }`}
              >
                <input
                  type="radio"
                  name="contractBilling"
                  value="hybrid"
                  checked={formData.contractBilling === "hybrid"}
                  onChange={() => setFormData({ ...formData, contractBilling: "hybrid" })}
                  className="h-4 w-4 text-violet-600"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Hybrid</p>
                  <p className="text-xs text-slate-500">Hybrid Modell</p>
                </div>
              </label>
            </div>
          </div>

          {/* Rate Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="ratePayroll">All-in Stundensatz Payroll (CHF)</Label>
              <Input
                id="ratePayroll"
                type="number"
                value={formData.ratePayroll || ""}
                onChange={(e) => setFormData({ ...formData, ratePayroll: parseInt(e.target.value) || 0 })}
                placeholder="z.B. 95"
                className="mt-1.5 bg-white dark:bg-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">Für Kandidaten über Payroll</p>
            </div>
            <div>
              <Label htmlFor="rateCompany">All-in Stundensatz über Firma (CHF)</Label>
              <Input
                id="rateCompany"
                type="number"
                value={formData.rateCompany || ""}
                onChange={(e) => setFormData({ ...formData, rateCompany: parseInt(e.target.value) || 0 })}
                placeholder="z.B. 120"
                className="mt-1.5 bg-white dark:bg-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">Für Kandidaten mit eigener Firma</p>
            </div>
          </div>
        </section>
      )}

      {/* Required Skills */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Erforderliche Skills
        </h2>
        <div className="flex gap-2 mb-4">
          <Input
            value={newRequiredSkill}
            onChange={(e) => setNewRequiredSkill(e.target.value)}
            placeholder="Skill hinzufügen..."
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (e.preventDefault(),
                addSkill(newRequiredSkill, requiredSkills, setRequiredSkills, setNewRequiredSkill))
            }
          />
          <Button
            type="button"
            onClick={() =>
              addSkill(newRequiredSkill, requiredSkills, setRequiredSkills, setNewRequiredSkill)
            }
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {requiredSkills.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(i, requiredSkills, setRequiredSkills)}
                className="ml-1 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Nice to Have Skills */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Nice-to-Have Skills
        </h2>
        <div className="flex gap-2 mb-4">
          <Input
            value={newNiceToHaveSkill}
            onChange={(e) => setNewNiceToHaveSkill(e.target.value)}
            placeholder="Skill hinzufügen..."
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (e.preventDefault(),
                addSkill(
                  newNiceToHaveSkill,
                  niceToHaveSkills,
                  setNiceToHaveSkills,
                  setNewNiceToHaveSkill
                ))
            }
          />
          <Button
            type="button"
            onClick={() =>
              addSkill(
                newNiceToHaveSkill,
                niceToHaveSkills,
                setNiceToHaveSkills,
                setNewNiceToHaveSkill
              )
            }
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {niceToHaveSkills.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(i, niceToHaveSkills, setNiceToHaveSkills)}
                className="ml-1 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Description */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Stellenbeschreibung
        </h2>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Ausführliche Beschreibung der Position..."
          rows={6}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </section>

      {/* Requirements */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Anforderungen
        </h2>
        <textarea
          value={formData.requirements}
          onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
          placeholder="Was wird vom Kandidaten erwartet..."
          rows={4}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </section>

      {/* Benefits */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Benefits
        </h2>
        <textarea
          value={formData.benefits}
          onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
          placeholder="Was wird geboten (z.B. Homeoffice, Weiterbildung, etc.)..."
          rows={4}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </section>

      {/* Internal Notes */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Interne Notizen
        </h2>
        <textarea
          value={formData.internalNotes}
          onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
          placeholder="Interne Notizen zur Stelle..."
          rows={3}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </section>

      {error && (
        <div className="p-4 bg-red-100 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Abbrechen
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-black"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {job ? "Speichern" : "Stelle erstellen"}
        </Button>
      </div>
    </form>
  );
}
