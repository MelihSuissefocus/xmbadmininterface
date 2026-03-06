/**
 * CV Parser Types
 * Target schema for parsed CV data, matching the candidate form and database schema.
 */

export interface ParsedLanguage {
  language: string;
  level: string; // "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Muttersprache" | ""
}

export interface ParsedCertification {
  name: string;
  issuer: string;
  year: string;
}

export interface ParsedEducation {
  degree: string;
  institution: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
}

export interface ParsedWorkExperience {
  role: string;
  company: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  current: boolean;
  description: string;
}

/**
 * The complete parsed CV data structure, matching the target form schema.
 * This is the canonical intermediate format before it gets mapped to FilledField[] / CandidateAutoFillDraftV2.
 */
export interface ParsedCvData {
  // Personal data
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  linkedin_url: string;
  target_position: string;
  street: string;
  postal_code: string;
  city: string;
  canton: string;

  // Professional info
  years_experience: number | null;
  current_salary_chf: number | null;
  expected_salary_chf: number | null;
  desired_hourly_rate_chf: number | null;
  is_subcontractor: boolean;
  employment_percentage: number | null;
  notice_period: string;
  available_from: string;
  status: string;

  // Arrays
  skills: string[];
  languages: ParsedLanguage[];
  certifications: ParsedCertification[];
  education: ParsedEducation[];
  work_experience: ParsedWorkExperience[];
  highlights: string[];

  // Internal
  internal_notes: string;
}

/**
 * Create an empty ParsedCvData with proper defaults.
 */
export function createEmptyParsedCv(): ParsedCvData {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    linkedin_url: "",
    target_position: "",
    street: "",
    postal_code: "",
    city: "",
    canton: "",
    years_experience: null,
    current_salary_chf: null,
    expected_salary_chf: null,
    desired_hourly_rate_chf: null,
    is_subcontractor: false,
    employment_percentage: null,
    notice_period: "",
    available_from: "",
    status: "Neu",
    skills: [],
    languages: [],
    certifications: [],
    education: [],
    work_experience: [],
    highlights: [],
    internal_notes: "",
  };
}
