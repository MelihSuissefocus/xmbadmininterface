export const CV_EXTRACTION_VERSION = "2.0.0";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Polygon {
  points: Array<{ x: number; y: number }>;
}

export interface DocumentLine {
  text: string;
  confidence: number;
  page: number;
  polygon?: Polygon;
  boundingBox?: BoundingBox;
}

export interface DocumentPage {
  pageNumber: number;
  width: number;
  height: number;
  unit: "inch" | "pixel";
  lines: DocumentLine[];
  words?: Array<{
    text: string;
    confidence: number;
    polygon?: Polygon;
  }>;
}

export interface DocumentTable {
  rowCount: number;
  columnCount: number;
  cells: Array<{
    rowIndex: number;
    columnIndex: number;
    text: string;
    confidence: number;
    page: number;
  }>;
  boundingRegions?: Array<{
    page: number;
    polygon?: Polygon;
  }>;
}

export interface KeyValuePair {
  key: string;
  value: string;
  confidence: number;
  keyPolygon?: Polygon;
  valuePolygon?: Polygon;
  page: number;
}

export interface DetectedLanguage {
  locale: string;
  confidence: number;
  spans?: Array<{
    offset: number;
    length: number;
  }>;
}

export interface DocumentRep {
  pages: DocumentPage[];
  tables: DocumentTable[];
  keyValuePairs: KeyValuePair[];
  detectedLanguages: DetectedLanguage[];
  content: string;
  pageCount: number;
  extractedAt: string;
  provider: "azure-document-intelligence";
  modelId: string;
}

export interface FieldEvidence {
  page: number;
  polygon?: Polygon;
  boundingBox?: BoundingBox;
  exactText: string;
  confidence: number;
}

export interface ExtractedFieldWithEvidence {
  targetField: string;
  extractedValue: unknown;
  confidence: "high" | "medium" | "low";
  evidence: FieldEvidence;
}

export interface CandidateAutoFillDraftV2 {
  filledFields: ExtractedFieldWithEvidence[];
  ambiguousFields: Array<{
    extractedLabel: string;
    extractedValue: string;
    suggestedTargets: Array<{
      targetField: string;
      confidence: "high" | "medium" | "low";
      reason: string;
    }>;
    evidence: FieldEvidence;
  }>;
  unmappedItems: Array<{
    extractedLabel?: string;
    extractedValue: string;
    category?: "contact" | "date" | "text" | "skill" | "language" | "education" | "experience" | "other";
    evidence: FieldEvidence;
  }>;
  metadata: {
    fileName: string;
    fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx";
    fileSize: number;
    pageCount: number;
    processingTimeMs: number;
    timestamp: string;
  };
  extractionVersion: string;
  provider: "azure-document-intelligence";
  documentRep?: DocumentRep;
}

export type AnalysisJobStatus = "pending" | "processing" | "completed" | "failed";

export interface AnalysisJob {
  id: string;
  status: AnalysisJobStatus;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: CandidateAutoFillDraftV2;
  error?: string;
  userId: string;
}

export interface AzureDIConfig {
  endpoint: string;
  apiKey: string;
  modelId: string;
  features: {
    keyValuePairs: boolean;
    languages: boolean;
  };
  timeoutMs: number;
  maxFileSizeBytes: number;
  maxPages: number;
}

