// ─────────────────────────────────────────────────────────────────────────────
// CVData – Rendering model for the e3Inspired PDF renderer
// ─────────────────────────────────────────────────────────────────────────────

/** Controls what contact details are shown in the header. */
export type CVVariant = "internal" | "external";

export interface CVPersonal {
  firstName: string;
  lastName: string;
  targetRole?: string | null;
  /** Shown only when variant === "internal" */
  email?: string | null;
  /** Shown only when variant === "internal" */
  phone?: string | null;
  /** Shown only when variant === "internal" */
  city?: string | null;
}

export interface CVLanguageEntry {
  language: string;
  level: string; // e.g. "C1", "Muttersprache"
}

export interface CVHighlight {
  text: string;
}

export interface CVEducationEntry {
  periodLabel: string; // e.g. "2015 – 2018"
  title: string;
  institution: string;
}

export interface CVCertificateEntry {
  name: string;
  issuer?: string | null;
  date?: string | null;
}

export interface CVExperienceEntry {
  /** e.g. "01/2022 – 06/2023" */
  periodLabel: string;
  /** e.g. "Senior Consultant – Firma AG, Zürich" */
  titleLine: string;
  /** Bullet points describing the role */
  descriptionLines: string[];
  /** Optional internal reference number */
  idNo?: string | null;
}

/**
 * Root data model consumed by the e3Inspired PDF renderer.
 *
 * All array fields default to empty – the renderer gracefully omits
 * sections that have no data.
 */
export interface CVData {
  variant: CVVariant;
  personal: CVPersonal;
  languages: CVLanguageEntry[];
  skills: { category: string; details: string }[];
  highlights: string[];
  education: CVEducationEntry[];
  certificates: CVCertificateEntry[];
  experience: CVExperienceEntry[];
}
