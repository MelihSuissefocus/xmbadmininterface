export {
  CognitiveExtractionEngine,
  getExtractionEngine,
  extractWithCognitiveEngine,
  type ExtractionResult,
  type EngineConfig,
  ExtractionEngineError,
} from "./engine";

export {
  FeedbackService,
  getFeedbackService,
  type FeedbackServiceConfig,
  type CorrectionRecord,
  type SegmentAssignmentRecord,
  type FieldStats,
} from "./feedback-service";

export {
  CognitiveExtractionResponseSchema,
  validateCognitiveResponse,
  type CognitiveExtractionResponse,
  type ExtractedData,
  type UnmappedSegment,
  type Evidence,
  type ValidationResult,
} from "./schema";

export {
  COGNITIVE_EXTRACTION_SYSTEM_PROMPT,
  buildCognitiveUserPrompt,
  buildValidationRetryPrompt,
  MAX_OUTPUT_TOKENS,
  type FewShotExample,
} from "./prompts";
