import { z } from "zod";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

const EvidenceSchema = z.object({
  lineId: z.string(),
  page: z.number(),
  text: z.string(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

const UnmappedSegmentSchema = z.object({
  original_text: z.string(),
  detected_type: z.enum([
    "date", 
    "skill", 
    "credential", 
    "personal", 
    "job_details",      // NEW: For orphaned job descriptions
    "education_details", // NEW: For orphaned education details
    "other"
  ]),
  reason: z.string(),
  suggested_field: z.string().nullable(),
  /** For job_details: which job entry does this text belong to? */
  suggested_parent: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  line_reference: z.string().nullable().optional(),
});

export type UnmappedSegment = z.infer<typeof UnmappedSegmentSchema>;

const PersonSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

const AddressSchema = z.object({
  street: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  canton: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema).optional(),
});

const ContactSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable().optional(),
  xingUrl: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  address: AddressSchema.nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

const LanguageSchema = z.object({
  name: z.string(),
  level: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

const SkillSchema = z.object({
  name: z.string(),
  category: z.string().nullable().optional(),
  yearsOfExperience: z.number().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

const ExperienceSchema = z.object({
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  /** DEPRECATED: Use responsibilities instead */
  description: z.string().nullable().optional(),
  /** Array of ALL job description bullets/paragraphs - CAPTURE VERBATIM! */
  responsibilities: z.array(z.string()).optional().default([]),
  /** Technologies/tools mentioned in this role */
  technologies: z.array(z.string()).optional().default([]),
  evidence: z.array(EvidenceSchema),
});

const EducationSchema = z.object({
  institution: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  field: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

const ExtractedDataSchema = z.object({
  person: PersonSchema,
  contact: ContactSchema,
  nationality: z.string().nullable().optional(),
  birthdate: z.string().nullable().optional(),
  workPermit: z.string().nullable().optional(),
  driversLicense: z.string().nullable().optional(),
  languages: z.array(LanguageSchema),
  skills: z.array(SkillSchema),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
});

const ExtractionMetadataSchema = z.object({
  confidence_scores: z.record(z.string(), z.number()).optional(),
  warnings: z.array(z.string()).optional(),
  implicit_mappings_applied: z.array(z.string()).optional(),
});

export const CognitiveExtractionResponseSchema = z.object({
  _thought_process: z.string().min(1, "Thought process is required"),
  extracted_data: ExtractedDataSchema,
  unmapped_segments: z.array(UnmappedSegmentSchema),
  extraction_metadata: ExtractionMetadataSchema.optional(),
});

export type CognitiveExtractionResponse = z.infer<typeof CognitiveExtractionResponseSchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

const JOB_TITLE_PATTERNS = [
  /^(senior|junior|lead|head|chief|principal|staff)?\s*(software|system|data|cloud|devops|frontend|backend|fullstack|full-stack|mobile|web|platform|infrastructure|security|network|database|ml|ai|machine\s*learning)?\s*(engineer|developer|architect|analyst|scientist|specialist|consultant|manager|director|administrator|coordinator|designer|lead|owner)$/i,
  /^(project|product|program|delivery|account|sales|marketing|hr|human\s*resources|finance|operations|business|technical|engineering|it|information\s*technology)?\s*(manager|director|lead|head|coordinator|specialist|analyst|consultant|officer|executive)$/i,
  /^(c[etfio]o|vp|vice\s*president|svp|evp|md|managing\s*director)$/i,
  /^(scrum\s*master|agile\s*coach|tech\s*lead|team\s*lead|squad\s*lead)$/i,
  /^(intern|trainee|apprentice|working\s*student|werkstudent)$/i,
  /^(freelancer|contractor|consultant|berater)$/i,
];

const COMPANY_PATTERNS = [
  /\b(gmbh|ag|inc|ltd|llc|corp|company|co\.|sarl|sa|kg|ohg|ug|se|plc|nv|bv)\b/i,
  /\b(bank|consulting|solutions|services|systems|group|holding|partners|associates)\b/i,
];

function isLikelyJobTitle(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length > 50) return false;
  return JOB_TITLE_PATTERNS.some((p) => p.test(normalized));
}

function isLikelyCompanyName(text: string): boolean {
  return COMPANY_PATTERNS.some((p) => p.test(text));
}

function containsDigits(text: string): boolean {
  return /\d/.test(text);
}

function isValidPersonName(firstName: string, lastName: string): boolean {
  if (!firstName || !lastName) return false;
  
  if (isLikelyJobTitle(firstName) || isLikelyJobTitle(lastName)) return false;
  if (isLikelyJobTitle(`${firstName} ${lastName}`)) return false;
  if (isLikelyCompanyName(firstName) || isLikelyCompanyName(lastName)) return false;
  
  if (firstName.length < 2 || lastName.length < 2) return false;
  if (firstName.length > 30 || lastName.length > 40) return false;
  
  if (containsDigits(firstName) || containsDigits(lastName)) return false;
  
  const invalidChars = /[@#$%^&*()+=\[\]{}|\\<>\/]/;
  if (invalidChars.test(firstName) || invalidChars.test(lastName)) return false;
  
  return true;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  valid: boolean;
  data?: CognitiveExtractionResponse;
  errors: string[];
  warnings: string[];
  flaggedFields: string[];
  autoCorrections: Array<{
    field: string;
    original: unknown;
    corrected: unknown;
    reason: string;
  }>;
}

export function validateCognitiveResponse(raw: unknown): ValidationResult {
  const parseResult = CognitiveExtractionResponseSchema.safeParse(raw);
  const flaggedFields: string[] = [];
  const warnings: string[] = [];
  const autoCorrections: Array<{
    field: string;
    original: unknown;
    corrected: unknown;
    reason: string;
  }> = [];

  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
    
    if (errors.some((e) => e.includes("_thought_process"))) {
      errors.push("CRITICAL: _thought_process field is missing or empty. The model MUST reason before extracting.");
    }
    
    return {
      valid: false,
      errors,
      warnings: [],
      flaggedFields: ["all"],
      autoCorrections: [],
    };
  }

  const data = parseResult.data;
  const extracted = data.extracted_data;

  if (data._thought_process.length < 50) {
    warnings.push("Thought process seems too short. Model may not have reasoned thoroughly.");
  }

  if (extracted.person.firstName && extracted.person.lastName) {
    if (!isValidPersonName(extracted.person.firstName, extracted.person.lastName)) {
      const originalFirst = extracted.person.firstName;
      const originalLast = extracted.person.lastName;

      flaggedFields.push("firstName", "lastName");
      extracted.person.firstName = null;
      extracted.person.lastName = null;

      autoCorrections.push({
        field: "extracted_data.person.firstName",
        original: originalFirst,
        corrected: null,
        reason: `"${originalFirst} ${originalLast}" detected as job title or invalid name pattern`,
      });
      autoCorrections.push({
        field: "extracted_data.person.lastName",
        original: originalLast,
        corrected: null,
        reason: `"${originalFirst} ${originalLast}" detected as job title or invalid name pattern`,
      });

      data.unmapped_segments.push({
        original_text: `${originalFirst} ${originalLast}`,
        detected_type: "other",
        reason: "Extracted as name but detected as job title. Requires manual review.",
        suggested_field: "person.firstName/lastName",
        confidence: 0.3,
      });
    }
  }

  if (extracted.person.evidence.length === 0 && (extracted.person.firstName || extracted.person.lastName)) {
    flaggedFields.push("firstName", "lastName");
    warnings.push("Name extracted without evidence - flagged for review");
    extracted.person.firstName = null;
    extracted.person.lastName = null;
  }

  if (extracted.contact.email) {
    if (!EMAIL_REGEX.test(extracted.contact.email)) {
      const originalEmail = extracted.contact.email;
      flaggedFields.push("email");
      extracted.contact.email = null;

      autoCorrections.push({
        field: "extracted_data.contact.email",
        original: originalEmail,
        corrected: null,
        reason: "Invalid email format",
      });
    }
  }

  if (extracted.contact.phone) {
    try {
      const phoneCountries = ["CH", "DE", "AT", "FR", "IT", "GB", "US"] as const;
      let validPhone = false;

      for (const country of phoneCountries) {
        if (isValidPhoneNumber(extracted.contact.phone, country)) {
          const parsed = parsePhoneNumber(extracted.contact.phone, country);
          const originalPhone = extracted.contact.phone;
          extracted.contact.phone = parsed.number;
          validPhone = true;

          if (originalPhone !== extracted.contact.phone) {
            autoCorrections.push({
              field: "extracted_data.contact.phone",
              original: originalPhone,
              corrected: extracted.contact.phone,
              reason: `Normalized to E.164 format (detected country: ${country})`,
            });
          }
          break;
        }
      }

      if (!validPhone) {
        flaggedFields.push("phone");
        warnings.push(`Phone "${extracted.contact.phone}" format not recognized - kept for manual review`);
      }
    } catch {
      flaggedFields.push("phone");
    }
  }

  extracted.experience = extracted.experience.filter((exp) => {
    if (exp.evidence.length === 0) {
      flaggedFields.push("experience");
      return false;
    }
    return true;
  });

  extracted.education = extracted.education.filter((edu) => {
    if (edu.evidence.length === 0) {
      flaggedFields.push("education");
      return false;
    }
    return true;
  });

  extracted.skills = extracted.skills.filter((skill) => skill.evidence.length > 0);
  extracted.languages = extracted.languages.filter((lang) => lang.evidence.length > 0);

  const thoughtLower = data._thought_process.toLowerCase();
  const implicitMappingKeywords = ["ethnicity", "herkunft", "staatsangehörigkeit", "origin"];
  const hasImplicitMapping = implicitMappingKeywords.some((kw) => thoughtLower.includes(kw));
  
  if (hasImplicitMapping && !extracted.nationality) {
    warnings.push("Thought process mentions ethnicity/origin but nationality is null. May need manual review.");
  }

  return {
    valid: true,
    data,
    errors: [],
    warnings,
    flaggedFields,
    autoCorrections,
  };
}

export const COGNITIVE_JSON_SCHEMA = {
  type: "object",
  required: ["_thought_process", "extracted_data", "unmapped_segments"],
  properties: {
    _thought_process: {
      type: "string",
      minLength: 1,
      description: "Complete cognitive analysis before extraction",
    },
    extracted_data: {
      type: "object",
      required: ["person", "contact", "languages", "skills", "experience", "education"],
      properties: {
        person: {
          type: "object",
          required: ["firstName", "lastName", "evidence"],
          properties: {
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            fullName: { type: ["string", "null"] },
            evidence: { type: "array" },
          },
        },
        contact: {
          type: "object",
          required: ["email", "phone", "evidence"],
          properties: {
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            linkedinUrl: { type: ["string", "null"] },
            address: { type: ["object", "null"] },
            evidence: { type: "array" },
          },
        },
        nationality: { type: ["string", "null"] },
        birthdate: { type: ["string", "null"] },
        workPermit: { type: ["string", "null"] },
        driversLicense: { type: ["string", "null"] },
        languages: { type: "array" },
        skills: { type: "array" },
        experience: { type: "array" },
        education: { type: "array" },
      },
    },
    unmapped_segments: {
      type: "array",
      items: {
        type: "object",
        required: ["original_text", "detected_type", "reason", "suggested_field", "confidence"],
        properties: {
          original_text: { type: "string" },
          detected_type: { type: "string", enum: ["date", "skill", "credential", "personal", "other"] },
          reason: { type: "string" },
          suggested_field: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          line_reference: { type: ["string", "null"] },
        },
      },
    },
    extraction_metadata: {
      type: "object",
      properties: {
        confidence_scores: { type: "object" },
        warnings: { type: "array", items: { type: "string" } },
        implicit_mappings_applied: { type: "array", items: { type: "string" } },
      },
    },
  },
};
