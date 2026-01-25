export { analyzeDocument, extractTextContent, getKeyValuePairsMap, AzureDIError } from "./client";
export { mapDocumentToCandidate } from "./data-mapper";
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

