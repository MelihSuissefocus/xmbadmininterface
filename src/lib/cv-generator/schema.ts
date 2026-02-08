import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Design Configuration (Zod Schemas with Defaults)
// ─────────────────────────────────────────────────────────────────────────────

export const CvGlobalStyleSchema = z.object({
  primaryColor: z.string().default("#333333"),
  fontFamily: z
    .enum(["Helvetica", "Times-Roman", "Courier"])
    .default("Helvetica"),
  baseFontSize: z.number().min(6).max(16).default(10),
  lineHeight: z.number().min(1).max(2.5).default(1.4),
});

export const CvHeaderConfigSchema = z.object({
  logoUrl: z.string().default(""),
  logoWidth: z.number().min(40).max(300).default(150),
  logoPosition: z.enum(["left", "right", "center"]).default("left"),
  companyName: z.string().default("XMB Consulting"),
  companySlogan: z.string().default(""),
  showCompanyInfo: z.boolean().default(true),
});

export const CvLayoutConfigSchema = z.object({
  sidebarWidth: z.number().min(20).max(45).default(30),
  pageMargin: z.number().min(10).max(40).default(20),
});

export const CvSectionVisibilitySchema = z.object({
  showPhoto: z.boolean().default(false),
  showSignature: z.boolean().default(false),
});

export const CvTypographySchema = z.object({
  headingSize: z.number().min(10).max(24).default(14),
  bodySize: z.number().min(7).max(14).default(10),
});

export const CvDesignConfigSchema = z.object({
  global: CvGlobalStyleSchema.default({
    primaryColor: "#333333",
    fontFamily: "Helvetica",
    baseFontSize: 10,
    lineHeight: 1.4,
  }),
  header: CvHeaderConfigSchema.default({
    logoUrl: "",
    logoWidth: 150,
    logoPosition: "left",
    companyName: "XMB Consulting",
    companySlogan: "",
    showCompanyInfo: true,
  }),
  layout: CvLayoutConfigSchema.default({
    sidebarWidth: 30,
    pageMargin: 20,
  }),
  sections: CvSectionVisibilitySchema.default({
    showPhoto: false,
    showSignature: false,
  }),
  typography: CvTypographySchema.default({
    headingSize: 14,
    bodySize: 10,
  }),
});

export type CvDesignConfig = z.infer<typeof CvDesignConfigSchema>;
export type CvGlobalStyle = z.infer<typeof CvGlobalStyleSchema>;
export type CvHeaderConfig = z.infer<typeof CvHeaderConfigSchema>;
export type CvLayoutConfig = z.infer<typeof CvLayoutConfigSchema>;
export type CvSectionVisibility = z.infer<typeof CvSectionVisibilitySchema>;
export type CvTypography = z.infer<typeof CvTypographySchema>;

/** Iron-Horse-Defaults – ein sauberer Aufruf reicht */
export const DEFAULT_DESIGN_CONFIG: CvDesignConfig =
  CvDesignConfigSchema.parse({});

// ─────────────────────────────────────────────────────────────────────────────
// Content Data (Kandidaten-Daten für den PDF-Renderer)
// ─────────────────────────────────────────────────────────────────────────────

export interface CvPersonalInfo {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  city?: string | null;
  canton?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  targetRole?: string | null;
}

export interface CvExperienceEntry {
  role: string;
  company: string;
  startDate?: string | null; // YYYY-MM
  endDate?: string | null; // YYYY-MM | "present"
  description?: string | null;
  technologies?: string[];
  /** "project" = Mandat / Freelance, "permanent" = Festanstellung */
  type?: "project" | "permanent";
}

export interface CvEducationEntry {
  degree: string;
  institution: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CvLanguageEntry {
  language: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Muttersprache";
}

export interface CvCertificateEntry {
  name: string;
  issuer?: string | null;
  date?: string | null;
}

export interface CvContentData {
  personal: CvPersonalInfo;
  experience: CvExperienceEntry[];
  education: CvEducationEntry[];
  skills: string[];
  languages: CvLanguageEntry[];
  certificates: CvCertificateEntry[];
  highlights: string[];
}
