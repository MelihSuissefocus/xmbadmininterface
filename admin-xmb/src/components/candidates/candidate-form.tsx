"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCandidate, updateCandidate } from "@/actions/candidates";
import { Candidate, NewCandidate } from "@/db/schema";
import { Plus, X, Save, Loader2 } from "lucide-react";

interface CandidateFormProps {
  candidate?: Candidate;
}

export function CandidateForm({ candidate }: CandidateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: candidate?.name ?? "",
    email: candidate?.email ?? "",
    phone: candidate?.phone ?? "",
    location: candidate?.location ?? "",
    linkedinUrl: candidate?.linkedinUrl ?? "",
    targetRole: candidate?.targetRole ?? "",
    yearsOfExperience: candidate?.yearsOfExperience ?? 0,
    currentSalary: candidate?.currentSalary ?? 0,
    expectedSalary: candidate?.expectedSalary ?? 0,
    workloadPreference: candidate?.workloadPreference ?? "100%",
    noticePeriod: candidate?.noticePeriod ?? "",
    availableFrom: candidate?.availableFrom ?? "",
    notes: candidate?.notes ?? "",
    status: candidate?.status ?? "new",
  });

  const [skills, setSkills] = useState<string[]>(
    (candidate?.skills as string[]) ?? []
  );
  const [newSkill, setNewSkill] = useState("");

  const [certificates, setCertificates] = useState<
    { name: string; issuer: string; date: string }[]
  >((candidate?.certificates as { name: string; issuer: string; date: string }[]) ?? []);

  const [languages, setLanguages] = useState<{ language: string; level: string }[]>(
    (candidate?.languages as { language: string; level: string }[]) ?? []
  );

  const [education, setEducation] = useState<
    { degree: string; institution: string; year: string }[]
  >((candidate?.education as { degree: string; institution: string; year: string }[]) ?? []);

  const [experience, setExperience] = useState<
    { role: string; company: string; from: string; to: string; description: string }[]
  >(
    (candidate?.experience as {
      role: string;
      company: string;
      from: string;
      to: string;
      description: string;
    }[]) ?? []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const data: NewCandidate = {
      ...formData,
      yearsOfExperience: Number(formData.yearsOfExperience) || null,
      currentSalary: Number(formData.currentSalary) || null,
      expectedSalary: Number(formData.expectedSalary) || null,
      availableFrom: formData.availableFrom || null,
      skills,
      certificates,
      languages,
      education,
      experience,
    };

    const result = candidate
      ? await updateCandidate(candidate.id, data)
      : await createCandidate(data);

    setLoading(false);

    if (result.success) {
      router.push("/dashboard/candidates");
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const addCertificate = () => {
    setCertificates([...certificates, { name: "", issuer: "", date: "" }]);
  };

  const updateCertificate = (
    index: number,
    field: keyof (typeof certificates)[0],
    value: string
  ) => {
    const updated = [...certificates];
    updated[index][field] = value;
    setCertificates(updated);
  };

  const removeCertificate = (index: number) => {
    setCertificates(certificates.filter((_, i) => i !== index));
  };

  const addLanguage = () => {
    setLanguages([...languages, { language: "", level: "B2" }]);
  };

  const updateLanguage = (
    index: number,
    field: keyof (typeof languages)[0],
    value: string
  ) => {
    const updated = [...languages];
    updated[index][field] = value;
    setLanguages(updated);
  };

  const removeLanguage = (index: number) => {
    setLanguages(languages.filter((_, i) => i !== index));
  };

  const addEducation = () => {
    setEducation([...education, { degree: "", institution: "", year: "" }]);
  };

  const updateEducation = (
    index: number,
    field: keyof (typeof education)[0],
    value: string
  ) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const addExperience = () => {
    setExperience([
      ...experience,
      { role: "", company: "", from: "", to: "", description: "" },
    ]);
  };

  const updateExperience = (
    index: number,
    field: keyof (typeof experience)[0],
    value: string
  ) => {
    const updated = [...experience];
    updated[index][field] = value;
    setExperience(updated);
  };

  const removeExperience = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Persönliche Daten
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1.5"
            />
          </div>
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
          <div className="md:col-span-2">
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              value={formData.linkedinUrl}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/..."
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* Professional Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Berufliche Informationen
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="targetRole">Zielposition</Label>
            <Input
              id="targetRole"
              value={formData.targetRole}
              onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
              placeholder="z.B. Senior React Developer"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="yearsOfExperience">Jahre Erfahrung</Label>
            <Input
              id="yearsOfExperience"
              type="number"
              min={0}
              value={formData.yearsOfExperience}
              onChange={(e) =>
                setFormData({ ...formData, yearsOfExperience: parseInt(e.target.value) || 0 })
              }
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="currentSalary">Aktuelles Gehalt (CHF/Jahr)</Label>
            <Input
              id="currentSalary"
              type="number"
              value={formData.currentSalary}
              onChange={(e) =>
                setFormData({ ...formData, currentSalary: parseInt(e.target.value) || 0 })
              }
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="expectedSalary">Gehaltsvorstellung (CHF/Jahr)</Label>
            <Input
              id="expectedSalary"
              type="number"
              value={formData.expectedSalary}
              onChange={(e) =>
                setFormData({ ...formData, expectedSalary: parseInt(e.target.value) || 0 })
              }
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="workloadPreference">Pensum</Label>
            <select
              id="workloadPreference"
              value={formData.workloadPreference}
              onChange={(e) =>
                setFormData({ ...formData, workloadPreference: e.target.value })
              }
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="100%">100%</option>
              <option value="80-100%">80-100%</option>
              <option value="60-80%">60-80%</option>
              <option value="40-60%">40-60%</option>
              <option value="Flexibel">Flexibel</option>
            </select>
          </div>
          <div>
            <Label htmlFor="noticePeriod">Kündigungsfrist</Label>
            <Input
              id="noticePeriod"
              value={formData.noticePeriod}
              onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
              placeholder="z.B. 3 Monate"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="availableFrom">Verfügbar ab</Label>
            <Input
              id="availableFrom"
              type="date"
              value={formData.availableFrom}
              onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "new" | "reviewed" | "rejected" | "placed",
                })
              }
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="new">Neu</option>
              <option value="reviewed">In Prüfung</option>
              <option value="rejected">Abgelehnt</option>
              <option value="placed">Platziert</option>
            </select>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Skills
        </h2>
        <div className="flex gap-2 mb-4">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Skill hinzufügen..."
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
          />
          <Button type="button" onClick={addSkill} variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(i)}
                className="ml-1 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Languages */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Sprachen
          </h2>
          <Button type="button" onClick={addLanguage} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
        </div>
        <div className="space-y-3">
          {languages.map((lang, i) => (
            <div key={i} className="flex items-center gap-3">
              <Input
                value={lang.language}
                onChange={(e) => updateLanguage(i, "language", e.target.value)}
                placeholder="Sprache"
                className="flex-1"
              />
              <select
                value={lang.level}
                onChange={(e) => updateLanguage(i, "level", e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="A1">A1 - Anfänger</option>
                <option value="A2">A2 - Grundkenntnisse</option>
                <option value="B1">B1 - Mittelstufe</option>
                <option value="B2">B2 - Gute Mittelstufe</option>
                <option value="C1">C1 - Fortgeschritten</option>
                <option value="C2">C2 - Muttersprachlich</option>
                <option value="Muttersprache">Muttersprache</option>
              </select>
              <Button
                type="button"
                onClick={() => removeLanguage(i)}
                variant="ghost"
                size="icon-sm"
                className="text-red-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Certificates */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Zertifikate
          </h2>
          <Button type="button" onClick={addCertificate} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
        </div>
        <div className="space-y-4">
          {certificates.map((cert, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg dark:bg-slate-800">
              <div className="flex-1 grid gap-3 md:grid-cols-3">
                <Input
                  value={cert.name}
                  onChange={(e) => updateCertificate(i, "name", e.target.value)}
                  placeholder="Zertifikat Name"
                />
                <Input
                  value={cert.issuer}
                  onChange={(e) => updateCertificate(i, "issuer", e.target.value)}
                  placeholder="Aussteller"
                />
                <Input
                  type="date"
                  value={cert.date}
                  onChange={(e) => updateCertificate(i, "date", e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={() => removeCertificate(i)}
                variant="ghost"
                size="icon-sm"
                className="text-red-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Education */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Ausbildung
          </h2>
          <Button type="button" onClick={addEducation} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
        </div>
        <div className="space-y-4">
          {education.map((edu, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg dark:bg-slate-800">
              <div className="flex-1 grid gap-3 md:grid-cols-3">
                <Input
                  value={edu.degree}
                  onChange={(e) => updateEducation(i, "degree", e.target.value)}
                  placeholder="Abschluss / Titel"
                />
                <Input
                  value={edu.institution}
                  onChange={(e) => updateEducation(i, "institution", e.target.value)}
                  placeholder="Institution"
                />
                <Input
                  value={edu.year}
                  onChange={(e) => updateEducation(i, "year", e.target.value)}
                  placeholder="Jahr"
                />
              </div>
              <Button
                type="button"
                onClick={() => removeEducation(i)}
                variant="ghost"
                size="icon-sm"
                className="text-red-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Experience */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Berufserfahrung
          </h2>
          <Button type="button" onClick={addExperience} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
        </div>
        <div className="space-y-4">
          {experience.map((exp, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-lg dark:bg-slate-800 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 grid gap-3 md:grid-cols-2">
                  <Input
                    value={exp.role}
                    onChange={(e) => updateExperience(i, "role", e.target.value)}
                    placeholder="Position / Rolle"
                  />
                  <Input
                    value={exp.company}
                    onChange={(e) => updateExperience(i, "company", e.target.value)}
                    placeholder="Unternehmen"
                  />
                  <Input
                    value={exp.from}
                    onChange={(e) => updateExperience(i, "from", e.target.value)}
                    placeholder="Von (z.B. 01/2020)"
                  />
                  <Input
                    value={exp.to}
                    onChange={(e) => updateExperience(i, "to", e.target.value)}
                    placeholder="Bis (z.B. 12/2023 oder Heute)"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => removeExperience(i)}
                  variant="ghost"
                  size="icon-sm"
                  className="text-red-500 ml-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                value={exp.description}
                onChange={(e) => updateExperience(i, "description", e.target.value)}
                placeholder="Beschreibung der Tätigkeiten..."
                rows={3}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Interne Notizen
        </h2>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Interne Notizen zum Kandidaten..."
          rows={4}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </section>

      {error && (
        <div className="p-4 bg-red-100 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
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
          {candidate ? "Speichern" : "Kandidat erstellen"}
        </Button>
      </div>
    </form>
  );
}

