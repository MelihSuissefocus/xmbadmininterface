"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCandidate, updateCandidate } from "@/actions/candidates";
import { getAllSkills } from "@/actions/skills";
import { Candidate, NewCandidate, Skill } from "@/db/schema";
import { Plus, X, Save, Loader2 } from "lucide-react";
import { WORLD_LANGUAGES, LANGUAGE_LEVELS, MONTHS, generateYears } from "@/lib/constants";
import { CVUploadButton } from "./cv-upload-button";
import { CVMappingModal } from "./cv-mapping-modal";
import type { CandidateFormData } from "@/lib/cv-autofill/types";
import type { CandidateAutoFillDraftV2 } from "@/lib/azure-di/types";

interface CandidateFormProps {
  candidate?: Candidate;
}

export function CandidateForm({ candidate }: CandidateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const years = generateYears();

  useEffect(() => {
    getAllSkills().then(setAvailableSkills);
  }, []);

  const [formData, setFormData] = useState({
    firstName: candidate?.firstName ?? "",
    lastName: candidate?.lastName ?? "",
    email: candidate?.email ?? "",
    phone: candidate?.phone ?? "",
    street: candidate?.street ?? "",
    postalCode: candidate?.postalCode ?? "",
    city: candidate?.city ?? "",
    canton: candidate?.canton ?? "",
    linkedinUrl: candidate?.linkedinUrl ?? "",
    targetRole: candidate?.targetRole ?? "",
    yearsOfExperience: candidate?.yearsOfExperience ?? 0,
    currentSalary: candidate?.currentSalary ?? 0,
    expectedSalary: candidate?.expectedSalary ?? 0,
    desiredHourlyRate: candidate?.desiredHourlyRate ?? 0,
    isSubcontractor: candidate?.isSubcontractor === 1,
    companyName: candidate?.companyName ?? "",
    companyType: candidate?.companyType ?? "",
    workloadPreference: candidate?.workloadPreference ?? "100%",
    noticePeriod: candidate?.noticePeriod ?? "",
    availableFrom: candidate?.availableFrom ?? "",
    notes: candidate?.notes ?? "",
    status: candidate?.status ?? "new",
  });

  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    (candidate?.skills as string[]) ?? []
  );

  const [certificates, setCertificates] = useState<
    { name: string; issuer: string; date: string }[]
  >((candidate?.certificates as { name: string; issuer: string; date: string }[]) ?? []);

  const [languages, setLanguages] = useState<{ language: string; level: string }[]>(
    (candidate?.languages as { language: string; level: string }[]) ?? []
  );

  const [education, setEducation] = useState<{
    degree: string;
    institution: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
  }[]>(
    (candidate?.education as Array<{
      degree: string;
      institution: string;
      startMonth: string;
      startYear: string;
      endMonth: string;
      endYear: string;
    }>)?.map((edu) => ({
      degree: edu.degree || "",
      institution: edu.institution || "",
      startMonth: edu.startMonth || "",
      startYear: edu.startYear || "",
      endMonth: edu.endMonth || "",
      endYear: edu.endYear || "",
    })) ?? []
  );

  const [experience, setExperience] = useState<{
    role: string;
    company: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
    current: boolean;
    description: string;
  }[]>(
    (candidate?.experience as Array<{
      role: string;
      company: string;
      startMonth: string;
      startYear: string;
      endMonth: string;
      endYear: string;
      current: boolean;
      description: string;
    }>)?.map((exp) => ({
      role: exp.role || "",
      company: exp.company || "",
      startMonth: exp.startMonth || "",
      startYear: exp.startYear || "",
      endMonth: exp.endMonth || "",
      endYear: exp.endYear || "",
      current: exp.current || false,
      description: exp.description || "",
    })) ?? []
  );

  const [highlights, setHighlights] = useState<string[]>(
    (candidate?.highlights as string[]) ?? []
  );

  // CV Auto-Fill state
  const [cvDraft, setCvDraft] = useState<CandidateAutoFillDraftV2 | null>(null);
  const [showCvModal, setShowCvModal] = useState(false);
  const [cvError, setCvError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const data: NewCandidate = {
      ...formData,
      companyType: (formData.companyType || null) as "ag" | "gmbh" | "einzelunternehmen" | null,
      yearsOfExperience: Number(formData.yearsOfExperience) || null,
      currentSalary: Number(formData.currentSalary) || null,
      expectedSalary: Number(formData.expectedSalary) || null,
      desiredHourlyRate: Number(formData.desiredHourlyRate) || null,
      isSubcontractor: formData.isSubcontractor ? 1 : 0,
      availableFrom: formData.availableFrom || null,
      email: formData.email || null,
      phone: formData.phone || null,
      street: formData.street || null,
      postalCode: formData.postalCode || null,
      city: formData.city || null,
      canton: formData.canton || null,
      linkedinUrl: formData.linkedinUrl || null,
      targetRole: formData.targetRole || null,
      companyName: formData.companyName || null,
      workloadPreference: formData.workloadPreference || null,
      noticePeriod: formData.noticePeriod || null,
      notes: formData.notes || null,
      skills: selectedSkills,
      certificates,
      languages,
      education,
      experience,
      highlights,
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

  const handleCVUploadComplete = (draft: CandidateAutoFillDraftV2) => {
    setCvDraft(draft);
    setShowCvModal(true);
    setCvError("");
  };

  const handleCVError = (errorMessage: string) => {
    setCvError(errorMessage);
    setTimeout(() => setCvError(""), 5000);
  };

  const handleCVDataApply = (mappedData: Partial<CandidateFormData>) => {
    // Apply mapped data to form state
    if (mappedData.firstName) setFormData(prev => ({ ...prev, firstName: mappedData.firstName || "" }));
    if (mappedData.lastName) setFormData(prev => ({ ...prev, lastName: mappedData.lastName || "" }));
    if (mappedData.email) setFormData(prev => ({ ...prev, email: mappedData.email || "" }));
    if (mappedData.phone) setFormData(prev => ({ ...prev, phone: mappedData.phone || "" }));
    if (mappedData.street) setFormData(prev => ({ ...prev, street: mappedData.street || "" }));
    if (mappedData.postalCode) setFormData(prev => ({ ...prev, postalCode: mappedData.postalCode || "" }));
    if (mappedData.city) setFormData(prev => ({ ...prev, city: mappedData.city || "" }));
    if (mappedData.canton) setFormData(prev => ({ ...prev, canton: mappedData.canton || "" }));
    if (mappedData.linkedinUrl) setFormData(prev => ({ ...prev, linkedinUrl: mappedData.linkedinUrl || "" }));
    if (mappedData.targetRole) setFormData(prev => ({ ...prev, targetRole: mappedData.targetRole || "" }));
    if (mappedData.yearsOfExperience !== undefined) setFormData(prev => ({ ...prev, yearsOfExperience: mappedData.yearsOfExperience || 0 }));
    if (mappedData.currentSalary !== undefined) setFormData(prev => ({ ...prev, currentSalary: mappedData.currentSalary || 0 }));
    if (mappedData.expectedSalary !== undefined) setFormData(prev => ({ ...prev, expectedSalary: mappedData.expectedSalary || 0 }));
    if (mappedData.desiredHourlyRate !== undefined) setFormData(prev => ({ ...prev, desiredHourlyRate: mappedData.desiredHourlyRate || 0 }));
    if (mappedData.isSubcontractor !== undefined) setFormData(prev => ({ ...prev, isSubcontractor: mappedData.isSubcontractor || false }));
    if (mappedData.companyName) setFormData(prev => ({ ...prev, companyName: mappedData.companyName || "" }));
    if (mappedData.companyType) setFormData(prev => ({ ...prev, companyType: mappedData.companyType || "" }));
    if (mappedData.workloadPreference) setFormData(prev => ({ ...prev, workloadPreference: mappedData.workloadPreference || "" }));
    if (mappedData.noticePeriod) setFormData(prev => ({ ...prev, noticePeriod: mappedData.noticePeriod || "" }));
    if (mappedData.availableFrom) setFormData(prev => ({ ...prev, availableFrom: mappedData.availableFrom || "" }));
    if (mappedData.notes) setFormData(prev => ({ ...prev, notes: mappedData.notes || "" }));

    // Apply array fields
    if (mappedData.skills && mappedData.skills.length > 0) {
      setSelectedSkills(mappedData.skills);
    }
    if (mappedData.languages && mappedData.languages.length > 0) {
      setLanguages(mappedData.languages);
    }
    if (mappedData.certificates && mappedData.certificates.length > 0) {
      setCertificates(mappedData.certificates);
    }
    if (mappedData.education && mappedData.education.length > 0) {
      // Convert EducationEntry to form structure (ensure all fields are defined)
      setEducation(mappedData.education.map(edu => ({
        degree: edu.degree,
        institution: edu.institution,
        startMonth: edu.startMonth || "",
        startYear: edu.startYear || "",
        endMonth: edu.endMonth || "",
        endYear: edu.endYear || "",
      })));
    }
    if (mappedData.experience && mappedData.experience.length > 0) {
      // Convert ExperienceEntry to form structure (ensure all fields are defined)
      setExperience(mappedData.experience.map(exp => ({
        role: exp.role,
        company: exp.company,
        startMonth: exp.startMonth || "",
        startYear: exp.startYear || "",
        endMonth: exp.endMonth || "",
        endYear: exp.endYear || "",
        current: exp.current || false,
        description: exp.description || "",
      })));
    }
    if (mappedData.highlights && mappedData.highlights.length > 0) {
      setHighlights(mappedData.highlights);
    }

    // Close modal
    setShowCvModal(false);
    setCvDraft(null);
  };

  const handleCVModalCancel = () => {
    setShowCvModal(false);
    setCvDraft(null);
  };

  const toggleSkill = (skillName: string) => {
    setSelectedSkills(prev =>
      prev.includes(skillName)
        ? prev.filter(s => s !== skillName)
        : [...prev, skillName]
    );
  };

  const addCertificate = () => {
    setCertificates([...certificates, { name: "", issuer: "", date: "" }]);
  };

  const updateCertificate = (
    index: number,
    field: string,
    value: string
  ) => {
    setCertificates(prev => prev.map((cert, i) => 
      i === index ? { ...cert, [field]: value } : cert
    ));
  };

  const removeCertificate = (index: number) => {
    setCertificates(certificates.filter((_, i) => i !== index));
  };

  const addLanguage = () => {
    setLanguages([...languages, { language: "", level: "B2" }]);
  };

  const updateLanguage = (
    index: number,
    field: string,
    value: string
  ) => {
    setLanguages(prev => prev.map((lang, i) => 
      i === index ? { ...lang, [field]: value } : lang
    ));
  };

  const removeLanguage = (index: number) => {
    setLanguages(languages.filter((_, i) => i !== index));
  };

  const addEducation = () => {
    setEducation([
      ...education,
      { degree: "", institution: "", startMonth: "", startYear: "", endMonth: "", endYear: "" },
    ]);
  };

  const updateEducation = (
    index: number,
    field: string,
    value: string
  ) => {
    setEducation(prev => prev.map((edu, i) => 
      i === index ? { ...edu, [field]: value } : edu
    ));
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const addExperience = () => {
    setExperience([
      ...experience,
      {
        role: "",
        company: "",
        startMonth: "",
        startYear: "",
        endMonth: "",
        endYear: "",
        current: false,
        description: "",
      },
    ]);
  };

  const updateExperience = (
    index: number,
    field: string,
    value: string | boolean
  ) => {
    setExperience(prev => prev.map((exp, i) => 
      i === index ? { ...exp, [field]: value } : exp
    ));
  };

  const removeExperience = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  const addHighlight = () => {
    if (highlights.length < 4) {
      setHighlights([...highlights, ""]);
    }
  };

  const updateHighlight = (index: number, value: string) => {
    const updated = [...highlights];
    updated[index] = value;
    setHighlights(updated);
  };

  const removeHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* CV Upload Section */}
        {!candidate && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  CV hochladen
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Laden Sie einen Lebenslauf hoch, um Felder automatisch auszufüllen
                </p>
              </div>
              <CVUploadButton
                onUploadComplete={handleCVUploadComplete}
                onError={handleCVError}
              />
              {cvError && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {cvError}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Basic Info */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Persönliche Daten
          </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="firstName">Vorname *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Nachname *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              value={formData.linkedinUrl}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/..."
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="targetRole">Zielposition</Label>
            <Input
              id="targetRole"
              value={formData.targetRole}
              onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
              placeholder="z.B. Senior Software Engineer"
              className="mt-1.5"
            />
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="md:col-span-2">
            <Label htmlFor="street">Strasse</Label>
            <Input
              id="street"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              placeholder="z.B. Bahnhofstrasse 1"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="postalCode">PLZ</Label>
            <Input
              id="postalCode"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="z.B. 8001"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="city">Ort</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="z.B. Zürich"
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="canton">Kanton</Label>
            <select
              id="canton"
              value={formData.canton}
              onChange={(e) => setFormData({ ...formData, canton: e.target.value })}
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">-- Kanton auswählen --</option>
              <option value="AG">Aargau</option>
              <option value="AR">Appenzell Ausserrhoden</option>
              <option value="AI">Appenzell Innerrhoden</option>
              <option value="BL">Basel-Landschaft</option>
              <option value="BS">Basel-Stadt</option>
              <option value="BE">Bern</option>
              <option value="FR">Freiburg</option>
              <option value="GE">Genf</option>
              <option value="GL">Glarus</option>
              <option value="GR">Graubünden</option>
              <option value="JU">Jura</option>
              <option value="LU">Luzern</option>
              <option value="NE">Neuenburg</option>
              <option value="NW">Nidwalden</option>
              <option value="OW">Obwalden</option>
              <option value="SH">Schaffhausen</option>
              <option value="SZ">Schwyz</option>
              <option value="SO">Solothurn</option>
              <option value="SG">St. Gallen</option>
              <option value="TG">Thurgau</option>
              <option value="TI">Tessin</option>
              <option value="UR">Uri</option>
              <option value="VD">Waadt</option>
              <option value="VS">Wallis</option>
              <option value="ZG">Zug</option>
              <option value="ZH">Zürich</option>
            </select>
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
            <Label htmlFor="currentSalary">Aktuelles Gehalt Brutto (CHF/Jahr)</Label>
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
            <Label htmlFor="expectedSalary">Gehaltsvorstellung Brutto (CHF/Jahr)</Label>
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
            <Label htmlFor="desiredHourlyRate">Gewünschter Stundensatz All-in (CHF/h)</Label>
            <Input
              id="desiredHourlyRate"
              type="number"
              value={formData.desiredHourlyRate}
              onChange={(e) =>
                setFormData({ ...formData, desiredHourlyRate: parseInt(e.target.value) || 0 })
              }
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isSubcontractor"
                checked={formData.isSubcontractor}
                onChange={(e) => setFormData({ ...formData, isSubcontractor: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <Label htmlFor="isSubcontractor" className="cursor-pointer">
                Ist Subunternehmer
              </Label>
            </div>
          </div>
          {formData.isSubcontractor && (
            <>
              <div>
                <Label htmlFor="companyName">Name Unternehmen</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="z.B. XY Solutions GmbH"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="companyType">Rechtsform</Label>
                <select
                  id="companyType"
                  value={formData.companyType}
                  onChange={(e) => setFormData({ ...formData, companyType: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">-- Rechtsform auswählen --</option>
                  <option value="ag">AG</option>
                  <option value="gmbh">GmbH</option>
                  <option value="einzelunternehmen">Einzelunternehmen</option>
                </select>
              </div>
            </>
          )}
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
        <div className="flex flex-wrap gap-2">
          {availableSkills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => toggleSkill(skill.name)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                selectedSkills.includes(skill.name)
                  ? "bg-amber-500 text-black"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {skill.name}
            </button>
          ))}
        </div>
        {availableSkills.length === 0 && (
          <p className="text-sm text-slate-500">
            Keine Skills verfügbar. Bitte fügen Sie Skills in den Einstellungen hinzu.
          </p>
        )}
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
              <select
                value={lang.language}
                onChange={(e) => updateLanguage(i, "language", e.target.value)}
                className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- Sprache auswählen --</option>
                {WORLD_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
              <select
                value={lang.level}
                onChange={(e) => updateLanguage(i, "level", e.target.value)}
                className="w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                onClick={() => removeLanguage(i)}
                variant="ghost"
                size="sm"
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
                size="sm"
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
            <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg dark:bg-slate-800">
              <div className="flex-1 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
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
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <Label className="text-xs text-slate-500">Von Monat</Label>
                    <select
                      value={edu.startMonth}
                      onChange={(e) => updateEducation(i, "startMonth", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">--</option>
                      {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Von Jahr</Label>
                    <select
                      value={edu.startYear}
                      onChange={(e) => updateEducation(i, "startYear", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">--</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Bis Monat</Label>
                    <select
                      value={edu.endMonth}
                      onChange={(e) => updateEducation(i, "endMonth", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">--</option>
                      {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Bis Jahr</Label>
                    <select
                      value={edu.endYear}
                      onChange={(e) => updateEducation(i, "endYear", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">--</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => removeEducation(i)}
                variant="ghost"
                size="sm"
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
                </div>
                <Button
                  type="button"
                  onClick={() => removeExperience(i)}
                  variant="ghost"
                  size="sm"
                  className="text-red-500 ml-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <Label className="text-xs text-slate-500">Von Monat</Label>
                  <select
                    value={exp.startMonth}
                    onChange={(e) => updateExperience(i, "startMonth", e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">--</option>
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Von Jahr</Label>
                  <select
                    value={exp.startYear}
                    onChange={(e) => updateExperience(i, "startYear", e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">--</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Bis Monat</Label>
                  <select
                    value={exp.endMonth}
                    onChange={(e) => updateExperience(i, "endMonth", e.target.value)}
                    disabled={exp.current}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 disabled:opacity-50"
                  >
                    <option value="">--</option>
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Bis Jahr</Label>
                  <select
                    value={exp.endYear}
                    onChange={(e) => updateExperience(i, "endYear", e.target.value)}
                    disabled={exp.current}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 disabled:opacity-50"
                  >
                    <option value="">--</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`current-${i}`}
                      checked={exp.current}
                      onChange={(e) => updateExperience(i, "current", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <Label htmlFor={`current-${i}`} className="text-sm cursor-pointer">
                      Aktuell
                    </Label>
                  </div>
                </div>
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

      {/* Highlights */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Highlights
          </h2>
          <Button 
            type="button" 
            onClick={addHighlight} 
            variant="outline" 
            size="sm"
            disabled={highlights.length >= 4}
          >
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
        </div>
        {highlights.length >= 4 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
            Maximal 4 Highlights erlaubt
          </p>
        )}
        <div className="space-y-3">
          {highlights.map((highlight, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg dark:bg-slate-800">
              <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-semibold mt-1">
                {i + 1}
              </div>
              <textarea
                value={highlight}
                onChange={(e) => updateHighlight(i, e.target.value)}
                placeholder="Bulletsatz / Highlight eingeben (min. 200 Wörter empfohlen)..."
                rows={4}
                className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 resize-y"
              />
              <Button
                type="button"
                onClick={() => removeHighlight(i)}
                variant="ghost"
                size="sm"
                className="text-red-500 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {highlights.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              Keine Highlights hinzugefügt. Klicken Sie auf &quot;Hinzufügen&quot;, um ein Highlight zu erstellen.
            </p>
          )}
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

    {/* CV Mapping Modal */}
    <CVMappingModal
      draft={cvDraft}
      isOpen={showCvModal}
      onConfirm={handleCVDataApply}
      onCancel={handleCVModalCancel}
    />
  </>
  );
}
