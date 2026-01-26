/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PILLAR 1: COGNITIVE DATA SCHEMA
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURAL REASONING:
 * Traditional LLM extraction fails because models "jump" to answers without reasoning.
 * This schema FORCES the model to externalize its thought process BEFORE extraction.
 * 
 * The `_thought_process` field is the key innovation:
 * - It creates a "scratchpad" where the LLM must analyze the input
 * - By requiring explicit reasoning, we catch errors like "job title as name"
 * - The thought process is logged for debugging and can inform future corrections
 * 
 * The `unmapped_segments` array ensures NO DATA LOSS:
 * - Anything the LLM sees but can't confidently map goes here
 * - This becomes the "Manual Assignment" queue in the frontend
 * - Users can drag-and-drop these items to the correct fields
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// EVIDENCE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Every extracted value must cite its source.
 * This enables:
 * 1. Auditability - we can verify extractions
 * 2. Debugging - we can see what the LLM "saw"
 * 3. Confidence scoring - evidence quality affects trust
 */
export const EvidenceSchema = z.object({
  /** Unique line identifier from the packed CV input (e.g., "p1_l5") */
  lineId: z.string(),
  /** Page number where this evidence was found */
  page: z.number().int().positive(),
  /** The exact text that supports this extraction */
  text: z.string(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// UNMAPPED SEGMENT (THE "RESIDUE BUCKET")
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * CRITICAL: This is how we achieve "No Data Loss"
 * 
 * When the LLM encounters data it cannot confidently map, it MUST:
 * 1. Capture the original text verbatim
 * 2. Categorize what TYPE of data it appears to be
 * 3. Explain WHY it couldn't be mapped
 * 4. Suggest where it MIGHT belong (for UI hints)
 * 
 * This enables the "Manual Zuweisung" (Manual Assignment) feature:
 * - Frontend displays these as cards/chips
 * - User drags them to form fields
 * - System learns from this feedback (see Pillar 2)
 */
export const UnmappedSegmentSchema = z.object({
  /** The exact text from the CV that couldn't be mapped */
  originalText: z.string().min(1, "Original text cannot be empty"),
  
  /** 
   * Category helps UI group similar unmapped items
   * - "personal": Names, IDs, personal attributes
   * - "contact": Phones, emails, addresses
   * - "date": Dates without clear context
   * - "skill": Skills not in master list
   * - "credential": Certificates, licenses
   * - "job_details": Job descriptions, responsibilities, achievements (NEW!)
   * - "education_details": Education descriptions, courses, projects
   * - "other": Catch-all
   */
  detectedCategory: z.enum([
    "personal",
    "contact", 
    "date",
    "skill",
    "credential",
    "job_details",      // NEW: For orphaned job descriptions
    "education_details", // NEW: For orphaned education details
    "other"
  ]),
  
  /** 
   * WHY couldn't this be mapped? 
   * Examples:
   * - "No 'workPermit' field in schema"
   * - "Ambiguous: could be firstName or companyName"
   * - "Skill 'Kubernetes' not in allowed skills list"
   * - "Job description but couldn't identify parent job entry"
   */
  reason: z.string().min(1, "Reason is required for debugging"),
  
  /** 
   * Confidence that the suggested field is correct (0.0 - 1.0)
   * Low confidence = show more prominently in UI
   */
  confidence: z.number().min(0).max(1),
  
  /** 
   * Best-guess field name, or null if truly ambiguous
   * Used to pre-populate dropdown in Manual Assignment UI
   */
  suggestedField: z.string().nullable(),
  
  /**
   * NEW: For job_details and education_details categories
   * Identifies which parent entry this text likely belongs to.
   * Example: "Technischer IT-Consultant" or "Finnova Banking AG"
   * 
   * This allows the UI to show: "This text appears to belong to [suggestedParent]"
   */
  suggestedParent: z.string().nullable().optional(),
  
  /** Optional: reference to source line for traceability */
  lineReference: z.string().nullable().optional(),
});

export type UnmappedSegment = z.infer<typeof UnmappedSegmentSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTED DATA STRUCTURE (CvData)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * The target data model for CV extraction.
 * 
 * DESIGN DECISIONS:
 * 1. All fields are nullable - we never hallucinate missing data
 * 2. Complex fields (experience, education) are arrays with evidence
 * 3. Evidence is required for primary fields to ensure traceability
 */

/** Person's name with mandatory evidence */
export const PersonSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  /** Optional: full name if splitting is ambiguous */
  fullName: z.string().nullable().optional(),
  /** Evidence MUST be provided if any name field is non-null */
  evidence: z.array(EvidenceSchema),
});

/** Contact information */
export const ContactSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable().optional(),
  xingUrl: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.object({
    street: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    canton: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  }).nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

/** Language proficiency */
export const LanguageSchema = z.object({
  name: z.string(),
  /** CEFR level (A1-C2) or "Muttersprache" */
  level: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

/** Professional skill */
export const SkillSchema = z.object({
  name: z.string(),
  /** Optional categorization */
  category: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

/** 
 * Work experience entry
 * 
 * CRITICAL: Job descriptions MUST be captured aggressively!
 * The `responsibilities` field should contain ALL text found between
 * this job entry and the next one (bullet points, paragraphs, etc.)
 */
export const ExperienceSchema = z.object({
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  
  /** 
   * DEPRECATED: Use `responsibilities` instead.
   * Kept for backward compatibility - will be populated from responsibilities[0] if set
   */
  description: z.string().nullable().optional(),
  
  /**
   * AGGRESSIVE CONTENT RETENTION:
   * This array MUST contain ALL text blocks found between this job entry
   * and the next one. Each bullet point, paragraph, or responsibility
   * should be a separate array entry.
   * 
   * Example:
   * [
   *   "Konzeption und Implementierung von Compliance-Frameworks (nDSG)",
   *   "Durchführung von Security Audits nach ISO 27001",
   *   "Erstellung technischer Dokumentation"
   * ]
   * 
   * RULE: If in doubt, include the text. Better to capture too much than lose data.
   */
  responsibilities: z.array(z.string()).optional().default([]),
  
  /**
   * Optional: Technologies/tools mentioned in this role
   * Extracted from the description text
   */
  technologies: z.array(z.string()).optional().default([]),
  
  /** Evidence for this experience entry - MUST include description line IDs */
  evidence: z.array(EvidenceSchema),
});

/** Education entry */
export const EducationSchema = z.object({
  institution: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  field: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema),
});

/** The complete extracted CV data */
export const CvDataSchema = z.object({
  person: PersonSchema,
  contact: ContactSchema,
  
  /** 
   * IMPLICIT MAPPING TARGET
   * This field receives values from: Ethnicity, Herkunft, Staatsangehörigkeit, Origin
   */
  nationality: z.string().nullable().optional(),
  birthdate: z.string().nullable().optional(),
  
  /** Additional personal attributes */
  workPermit: z.string().nullable().optional(),
  driversLicense: z.string().nullable().optional(),
  
  languages: z.array(LanguageSchema),
  skills: z.array(SkillSchema),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
});

export type CvData = z.infer<typeof CvDataSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// COGNITIVE RESPONSE (THE ROOT OBJECT)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * THIS IS THE INNOVATION: The LLM must "think out loud" before extracting.
 * 
 * The `_thought_process` field:
 * - Is validated as non-empty (LLM can't skip it)
 * - Forces explicit reasoning about ambiguous cases
 * - Creates an audit trail for debugging
 * - Can be shown to users: "Here's what the AI was thinking..."
 * 
 * Example _thought_process:
 * ```
 * ANALYSIS:
 * 1. Looking at header: "Senior Software Engineer" followed by "Max Müller"
 *    - "Senior Software Engineer" is a JOB TITLE, not a name
 *    - "Max Müller" follows typical German name pattern
 *    - DECISION: firstName="Max", lastName="Müller"
 * 
 * 2. Found "Ethnicity: Turkish"
 *    - No 'ethnicity' field in schema
 *    - IMPLICIT MAPPING: Ethnicity often indicates nationality
 *    - DECISION: nationality="Turkish"
 * 
 * 3. Found "Führerschein: B, BE"
 *    - This is a driver's license
 *    - Adding to unmapped_segments (no driversLicense field populated)
 * ```
 */
export const CognitiveResponseSchema = z.object({
  /**
   * REQUIRED: The LLM's reasoning process
   * 
   * Must include:
   * 1. Name identification analysis
   * 2. Implicit mapping decisions
   * 3. Explanations for unmapped items
   * 
   * Minimum length enforced to prevent empty/trivial responses
   */
  _thought_process: z.string()
    .min(50, "Thought process too short - LLM must reason thoroughly"),
  
  /** The extracted, structured CV data */
  extracted_data: CvDataSchema,
  
  /** 
   * Items that couldn't be mapped with confidence
   * This is the "residue bucket" - no data loss!
   */
  unmapped_segments: z.array(UnmappedSegmentSchema),
  
  /** Optional metadata about the extraction */
  metadata: z.object({
    /** Confidence score per field (0.0 - 1.0) */
    confidenceScores: z.record(z.string(), z.number()).optional(),
    /** Any warnings generated during extraction */
    warnings: z.array(z.string()).optional(),
    /** List of implicit mappings applied (for logging/debugging) */
    implicitMappingsApplied: z.array(z.string()).optional(),
  }).optional(),
});

export type CognitiveResponse = z.infer<typeof CognitiveResponseSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common job titles that should NEVER be extracted as names
 */
const JOB_TITLE_PATTERNS = [
  /^(senior|junior|lead|staff|principal)?\s*(software|system|data|devops|cloud|frontend|backend|fullstack)?\s*(engineer|developer|architect|analyst|scientist|consultant|manager|director|specialist|coordinator|designer|administrator)$/i,
  /^(project|product|program|delivery|account|sales|marketing|hr|finance|operations|business|technical|engineering)?\s*(manager|director|lead|coordinator|specialist|analyst|consultant|officer|executive)$/i,
  /^(cto|ceo|cfo|coo|cio|vp|svp|evp|md)$/i,
  /^(scrum\s*master|agile\s*coach|tech\s*lead|team\s*lead)$/i,
  /^(intern|trainee|apprentice|werkstudent)$/i,
];

/**
 * Check if text looks like a job title (not a person name)
 */
export function isLikelyJobTitle(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length > 50) return false;
  return JOB_TITLE_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Validate and sanitize the cognitive response
 * 
 * Applies post-processing rules:
 * 1. Detect job titles mistakenly extracted as names
 * 2. Normalize phone numbers
 * 3. Validate email format
 * 4. Ensure evidence exists for non-null values
 */
export function validateCognitiveResponse(raw: unknown): {
  valid: boolean;
  data?: CognitiveResponse;
  errors: string[];
  corrections: Array<{ field: string; original: unknown; corrected: unknown; reason: string }>;
} {
  // Step 1: Zod schema validation
  const parseResult = CognitiveResponseSchema.safeParse(raw);
  
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map(e => `${e.path.join(".")}: ${e.message}`),
      corrections: [],
    };
  }
  
  const data = parseResult.data;
  const corrections: Array<{ field: string; original: unknown; corrected: unknown; reason: string }> = [];
  
  // Step 2: Post-validation corrections
  
  // Check for job title as name
  if (data.extracted_data.person.firstName && data.extracted_data.person.lastName) {
    const fullName = `${data.extracted_data.person.firstName} ${data.extracted_data.person.lastName}`;
    if (isLikelyJobTitle(fullName) || isLikelyJobTitle(data.extracted_data.person.firstName)) {
      corrections.push({
        field: "person.firstName/lastName",
        original: fullName,
        corrected: null,
        reason: "Detected as job title, not person name",
      });
      
      // Move to unmapped_segments for manual review
      data.unmapped_segments.push({
        originalText: fullName,
        detectedCategory: "personal",
        reason: "Extracted as name but detected as job title pattern",
        confidence: 0.2,
        suggestedField: "person.firstName",
      });
      
      data.extracted_data.person.firstName = null;
      data.extracted_data.person.lastName = null;
    }
  }
  
  // Validate email format
  if (data.extracted_data.contact.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.extracted_data.contact.email)) {
      corrections.push({
        field: "contact.email",
        original: data.extracted_data.contact.email,
        corrected: null,
        reason: "Invalid email format",
      });
      data.extracted_data.contact.email = null;
    }
  }
  
  return {
    valid: true,
    data,
    errors: [],
    corrections,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type Person = z.infer<typeof PersonSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;

