import { z } from "zod";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

const JOB_TITLE_PATTERNS = [
  /^system\s*engineer$/i,
  /^software\s*(developer|engineer)$/i,
  /^senior\s*(developer|engineer|consultant)$/i,
  /^junior\s*(developer|engineer)$/i,
  /^lead\s*(developer|engineer|architect)$/i,
  /^project\s*manager$/i,
  /^product\s*(manager|owner)$/i,
  /^cto$/i,
  /^ceo$/i,
  /^cfo$/i,
  /^director$/i,
  /^manager$/i,
  /^consultant$/i,
  /^analyst$/i,
  /^architect$/i,
  /^designer$/i,
  /^developer$/i,
  /^engineer$/i,
  /^specialist$/i,
  /^coordinator$/i,
  /^administrator$/i,
  /^assistant$/i,
  /^intern$/i,
  /^trainee$/i,
  /^head\s+of/i,
  /^team\s*lead/i,
  /^tech\s*lead/i,
];

const COMPANY_PATTERNS = [
  /\b(gmbh|ag|inc|ltd|llc|corp|company|co\.|sarl|sa)\b/i,
  /\b(bank|consulting|solutions|services|systems|group)\b/i,
];

export function isLikelyJobTitle(text: string): boolean {
  const normalized = text.trim();
  return JOB_TITLE_PATTERNS.some((p) => p.test(normalized));
}

export function isLikelyCompanyName(text: string): boolean {
  return COMPANY_PATTERNS.some((p) => p.test(text));
}

export function isValidPersonName(firstName: string, lastName: string): boolean {
  if (!firstName || !lastName) return false;
  if (isLikelyJobTitle(firstName) || isLikelyJobTitle(lastName)) return false;
  if (isLikelyJobTitle(`${firstName} ${lastName}`)) return false;
  if (isLikelyCompanyName(firstName) || isLikelyCompanyName(lastName)) return false;
  if (firstName.length < 2 || lastName.length < 2) return false;
  if (/\d/.test(firstName) || /\d/.test(lastName)) return false;
  return true;
}

const EvidenceSchema = z.object({
  lineId: z.string(),
  page: z.number(),
  text: z.string(),
});

export type LlmEvidence = z.infer<typeof EvidenceSchema>;

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
  evidence: z.array(EvidenceSchema).optional(),
});

const ContactSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable().optional(),
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
  evidence: z.array(EvidenceSchema),
});

const ExperienceSchema = z.object({
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

const EducationSchema = z.object({
  institution: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

const MetadataSchema = z.object({
  needs_review_fields: z.array(z.string()),
  notes: z.array(z.string()).optional(),
});

export const LlmExtractionResponseSchema = z.object({
  person: PersonSchema,
  contact: ContactSchema,
  nationality: z.string().nullable().optional(),
  languages: z.array(LanguageSchema),
  skills: z.array(SkillSchema),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  metadata: MetadataSchema,
});

export type LlmExtractionResponse = z.infer<typeof LlmExtractionResponseSchema>;

export interface ValidationResult {
  valid: boolean;
  data?: LlmExtractionResponse;
  errors?: string[];
  flaggedFields: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAndNormalizeLlmResponse(raw: unknown): ValidationResult {
  const parseResult = LlmExtractionResponseSchema.safeParse(raw);
  const flaggedFields: string[] = [];

  if (!parseResult.success) {
    const zodError = parseResult.error;
    const issues = zodError.issues || [];
    return {
      valid: false,
      errors: issues.map((e) => `${e.path.join(".")}: ${e.message}`),
      flaggedFields: ["all"],
    };
  }

  const data = parseResult.data;

  if (data.person.firstName && data.person.lastName) {
    if (!isValidPersonName(data.person.firstName, data.person.lastName)) {
      flaggedFields.push("firstName", "lastName");
      data.person.firstName = null;
      data.person.lastName = null;
      if (!data.metadata.needs_review_fields.includes("firstName")) {
        data.metadata.needs_review_fields.push("firstName");
      }
      if (!data.metadata.needs_review_fields.includes("lastName")) {
        data.metadata.needs_review_fields.push("lastName");
      }
    }
  }

  if (data.person.evidence.length === 0 && (data.person.firstName || data.person.lastName)) {
    flaggedFields.push("firstName", "lastName");
    data.person.firstName = null;
    data.person.lastName = null;
  }

  if (data.contact.email) {
    if (!EMAIL_REGEX.test(data.contact.email)) {
      flaggedFields.push("email");
      data.contact.email = null;
      if (!data.metadata.needs_review_fields.includes("email")) {
        data.metadata.needs_review_fields.push("email");
      }
    }
  }

  if (data.contact.phone) {
    try {
      if (isValidPhoneNumber(data.contact.phone, "CH")) {
        const parsed = parsePhoneNumber(data.contact.phone, "CH");
        data.contact.phone = parsed.number;
      } else {
        flaggedFields.push("phone");
        if (!data.metadata.needs_review_fields.includes("phone")) {
          data.metadata.needs_review_fields.push("phone");
        }
      }
    } catch {
      flaggedFields.push("phone");
      if (!data.metadata.needs_review_fields.includes("phone")) {
        data.metadata.needs_review_fields.push("phone");
      }
    }
  }

  if (data.contact.evidence.length === 0 && (data.contact.email || data.contact.phone)) {
    if (data.contact.email && !flaggedFields.includes("email")) {
      flaggedFields.push("email");
    }
    if (data.contact.phone && !flaggedFields.includes("phone")) {
      flaggedFields.push("phone");
    }
  }

  data.experience = data.experience.filter((exp) => {
    if (exp.evidence.length === 0) {
      flaggedFields.push("experience");
      return false;
    }
    return true;
  });

  data.education = data.education.filter((edu) => {
    if (edu.evidence.length === 0) {
      flaggedFields.push("education");
      return false;
    }
    return true;
  });

  data.skills = data.skills.filter((skill) => {
    if (skill.evidence.length === 0) {
      return false;
    }
    return true;
  });

  data.languages = data.languages.filter((lang) => {
    if (lang.evidence.length === 0) {
      return false;
    }
    return true;
  });

  return {
    valid: true,
    data,
    flaggedFields,
  };
}

export const LLM_JSON_SCHEMA = {
  type: "object",
  properties: {
    person: {
      type: "object",
      properties: {
        firstName: { type: ["string", "null"] },
        lastName: { type: ["string", "null"] },
        fullName: { type: ["string", "null"] },
        evidence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              lineId: { type: "string" },
              page: { type: "number" },
              text: { type: "string" },
            },
            required: ["lineId", "page", "text"],
          },
        },
      },
      required: ["firstName", "lastName", "evidence"],
    },
    contact: {
      type: "object",
      properties: {
        email: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        linkedinUrl: { type: ["string", "null"] },
        address: {
          type: ["object", "null"],
          properties: {
            street: { type: ["string", "null"] },
            postalCode: { type: ["string", "null"] },
            city: { type: ["string", "null"] },
            canton: { type: ["string", "null"] },
            evidence: { type: "array" },
          },
        },
        evidence: { type: "array" },
      },
      required: ["email", "phone", "evidence"],
    },
    nationality: { type: ["string", "null"] },
    languages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          level: { type: ["string", "null"] },
          evidence: { type: "array" },
        },
        required: ["name", "evidence"],
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          evidence: { type: "array" },
        },
        required: ["name", "evidence"],
      },
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          startDate: { type: ["string", "null"] },
          endDate: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          evidence: { type: "array" },
        },
        required: ["evidence"],
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: ["string", "null"] },
          degree: { type: ["string", "null"] },
          startDate: { type: ["string", "null"] },
          endDate: { type: ["string", "null"] },
          evidence: { type: "array" },
        },
        required: ["evidence"],
      },
    },
    metadata: {
      type: "object",
      properties: {
        needs_review_fields: { type: "array", items: { type: "string" } },
        notes: { type: "array", items: { type: "string" } },
      },
      required: ["needs_review_fields"],
    },
  },
  required: ["person", "contact", "languages", "skills", "experience", "education", "metadata"],
};

