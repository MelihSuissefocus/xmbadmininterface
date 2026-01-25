/**
 * CV Auto-Fill Types
 * Based on specs/cv_autofill_schema.json
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export interface SourceInfo {
  text: string;
  page?: number;
  position?: string;
}

export interface FilledField {
  targetField: string;
  extractedValue: unknown;
  confidence: ConfidenceLevel;
  source: SourceInfo;
}

export interface SuggestedTarget {
  targetField: string;
  confidence: ConfidenceLevel;
  reason: string;
}

export interface AmbiguousField {
  extractedLabel: string;
  extractedValue: string;
  suggestedTargets: SuggestedTarget[];
  selectedTarget?: string | null;
  source: SourceInfo;
}

export interface UnmappedItem {
  extractedLabel?: string | null;
  extractedValue: string;
  category?: "contact" | "date" | "text" | "skill" | "language" | "education" | "experience" | "other";
  suggestedTargets: SuggestedTarget[];
  selectedTarget?: string | null;
  source: SourceInfo;
}

export interface ExtractionMetadata {
  fileName: string;
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx";
  fileSize: number;
  pageCount?: number;
  extractionMethod: "text" | "ocr";
  processingTimeMs: number;
  timestamp: string;
}

export interface CandidateAutoFillDraft {
  filledFields: FilledField[];
  ambiguousFields: AmbiguousField[];
  unmappedItems: UnmappedItem[];
  metadata: ExtractionMetadata;
}

// Form data types matching candidate-form.tsx structure
export interface LanguageEntry {
  language: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Muttersprache";
}

export interface CertificateEntry {
  name: string;
  issuer: string;
  date: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
}

export interface ExperienceEntry {
  role: string;
  company: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  current?: boolean;
  description?: string;
}

export interface CandidateFormData {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  canton?: string | null;
  linkedinUrl?: string | null;
  targetRole?: string | null;
  yearsOfExperience?: number | null;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  desiredHourlyRate?: number | null;
  isSubcontractor?: boolean;
  companyName?: string | null;
  companyType?: "ag" | "gmbh" | "einzelunternehmen" | null;
  workloadPreference?: string | null;
  noticePeriod?: string | null;
  availableFrom?: string | null;
  notes?: string | null;
  status?: "new" | "reviewed" | "rejected" | "placed";
  skills?: string[];
  languages?: LanguageEntry[];
  certificates?: CertificateEntry[];
  education?: EducationEntry[];
  experience?: ExperienceEntry[];
  highlights?: string[];
}
