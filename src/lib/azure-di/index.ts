export { analyzeDocument, extractTextContent, getKeyValuePairsMap, AzureDIError } from "./client";
export { mapDocumentToCandidate, type MapperConfig } from "./data-mapper";
export { detectSections, findSectionByType, getSectionText, type DetectedSection, type SectionType } from "./section-detector";
export { calculateConfidence, getConfidenceLevel, defaultFactors, type ConfidenceFactors, type ConfidenceResult } from "./confidence";
export { validateEmail, normalizePhoneE164, normalizeCanton, parseCEFRLevel, parseDate, validateSwissPostalCode } from "./validation";
export type {
  DocumentRep,
  DocumentPage,
  DocumentLine,
  DocumentTable,
  KeyValuePair,
  DetectedLanguage,
  FieldEvidence,
  ExtractedFieldWithEvidence,
  CandidateAutoFillDraftV2,
  AnalysisJob,
  AnalysisJobStatus,
  BoundingBox,
  Polygon,
  AzureDIConfig,
} from "./types";
export { CV_EXTRACTION_VERSION } from "./types";

