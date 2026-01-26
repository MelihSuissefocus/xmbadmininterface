/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CV ENGINE - SELF-CORRECTING ENTITY EXTRACTION
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * A production-grade CV parsing system built on three pillars:
 * 
 * 1. COGNITIVE SCHEMA (schema.ts)
 *    - Forces LLM to reason before extracting (_thought_process)
 *    - Captures unmapped data in residue bucket
 *    - Strict Zod validation
 * 
 * 2. SELF-LEARNING FEEDBACK (feedback.ts)
 *    - Stores user corrections
 *    - Injects past corrections as few-shot examples
 *    - Tracks per-field accuracy
 * 
 * 3. ADVANCED PROMPTING (prompts.ts)
 *    - Implicit mapping matrix (Ethnicity → nationality)
 *    - Dynamic prompt construction
 *    - Retry with error context
 * 
 * USAGE:
 * ```typescript
 * import { parseCv, getFeedbackService } from "@/lib/cv-engine";
 * 
 * // Parse a CV
 * const result = await parseCv(cvText);
 * 
 * if (result.success) {
 *   console.log("Thought process:", result.thoughtProcess);
 *   console.log("Extracted data:", result.extractedData);
 *   console.log("Unmapped items:", result.unmappedSegments);
 * }
 * 
 * // Save a user correction for future learning
 * const feedback = getFeedbackService();
 * await feedback.saveCorrection({
 *   sourceContext: "Ethnicity: Turkish",
 *   correctValue: "Turkish",
 *   correctField: "nationality",
 *   reasoning: "Ethnicity indicates nationality"
 * });
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA EXPORTS (PILLAR 1)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Schemas
  EvidenceSchema,
  UnmappedSegmentSchema,
  PersonSchema,
  ContactSchema,
  LanguageSchema,
  SkillSchema,
  ExperienceSchema,
  EducationSchema,
  CvDataSchema,
  CognitiveResponseSchema,
  
  // Types
  type Evidence,
  type UnmappedSegment,
  type CvData,
  type CognitiveResponse,
  type Person,
  type Contact,
  type Language,
  type Skill,
  type Experience,
  type Education,
  
  // Utilities
  isLikelyJobTitle,
  validateCognitiveResponse,
} from "./schema";

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK EXPORTS (PILLAR 2)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Classes
  FeedbackService,
  
  // Factory functions
  getFeedbackService,
  createFeedbackService,
  
  // Types
  type CorrectionVector,
  type FewShotExample,
  type FeedbackServiceConfig,
} from "./feedback";

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT EXPORTS (PILLAR 3)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  buildSystemPrompt,
  buildUserPrompt,
  buildRetryPrompt,
  MAX_OUTPUT_TOKENS,
  TEMPERATURE,
} from "./prompts";

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER EXPORTS (ORCHESTRATOR)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Classes
  CvParser,
  ParserError,
  
  // Factory functions
  getCvParser,
  createCvParser,
  parseCv,
  
  // Types
  type ParserConfig,
  type ParseResult,
  type ParseSuccess,
  type ParseFailure,
} from "./parser";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETENESS VALIDATOR EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Classes
  CompletenessValidator,
  
  // Factory functions
  getCompletenessValidator,
  validateCompleteness,
  buildReExtractionPrompt,
  
  // Types
  type CompletenessReport,
  type ValidatorConfig,
  type GenericExtractionResponse,
} from "./completeness-validator";

