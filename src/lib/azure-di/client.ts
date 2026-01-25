import "server-only";

import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import type { DocumentRep, DocumentPage, DocumentLine, KeyValuePair, DetectedLanguage, DocumentTable, AzureDIConfig } from "./types";
import { z } from "zod";
import { cvLogger } from "@/lib/logger";

const POLLER_MAX_WAIT_MS = 25000;

const configSchema = z.object({
  AZURE_DI_ENDPOINT: z.string().url(),
  AZURE_DI_KEY: z.string().min(1),
});

function getConfig(): AzureDIConfig {
  const env = configSchema.safeParse({
    AZURE_DI_ENDPOINT: process.env.AZURE_DI_ENDPOINT,
    AZURE_DI_KEY: process.env.AZURE_DI_KEY,
  });

  if (!env.success) {
    cvLogger.error("Azure DI configuration missing", { action: "getConfig" });
    throw new Error("Azure Document Intelligence configuration missing");
  }

  return {
    endpoint: env.data.AZURE_DI_ENDPOINT,
    apiKey: env.data.AZURE_DI_KEY,
    modelId: "prebuilt-layout",
    features: {
      keyValuePairs: true,
      languages: true,
    },
    timeoutMs: POLLER_MAX_WAIT_MS,
    maxFileSizeBytes: 10 * 1024 * 1024,
    maxPages: 20,
  };
}

let clientInstance: DocumentAnalysisClient | null = null;

function getClient(): DocumentAnalysisClient {
  if (!clientInstance) {
    const config = getConfig();
    clientInstance = new DocumentAnalysisClient(
      config.endpoint,
      new AzureKeyCredential(config.apiKey)
    );
  }
  return clientInstance;
}

function redactPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "[PHONE]")
    .replace(/\b\d{13,19}\b/g, "[CARD]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b756\.\d{4}\.\d{4}\.\d{2}\b/g, "[AHV]")
    .replace(/\b[A-Z][a-zäöüéèà]+\s+[A-Z][a-zäöüéèà]+\b/g, "[NAME]");
}

export class AzureDIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "AzureDIError";
  }
}

export async function analyzeDocument(
  fileBytes: Uint8Array,
  mimeType: string
): Promise<DocumentRep> {
  const config = getConfig();
  const client = getClient();

  if (fileBytes.length > config.maxFileSizeBytes) {
    throw new AzureDIError(
      `File exceeds maximum size of ${config.maxFileSizeBytes / 1024 / 1024}MB`,
      "FILE_TOO_LARGE"
    );
  }

  const allowedMimeTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new AzureDIError(`Unsupported file type: ${mimeType}`, "INVALID_FILE_TYPE");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    cvLogger.debug("Starting Azure DI analysis", { action: "analyzeDocument", modelId: config.modelId });

    const poller = await client.beginAnalyzeDocument(
      config.modelId,
      fileBytes,
      {
        abortSignal: controller.signal,
      }
    );

    const result = await poller.pollUntilDone();

    cvLogger.debug("Azure DI analysis complete", { action: "analyzeDocument", pageCount: result?.pages?.length });

    if (!result) {
      throw new AzureDIError("Analysis returned no result", "NO_RESULT");
    }

    if (result.pages && result.pages.length > config.maxPages) {
      throw new AzureDIError(
        `Document has ${result.pages.length} pages, maximum is ${config.maxPages}`,
        "TOO_MANY_PAGES"
      );
    }

    const pages: DocumentPage[] = (result.pages || []).map((page, idx) => {
      const lines: DocumentLine[] = (page.lines || []).map((line) => ({
        text: line.content,
        confidence: 1.0,
        page: idx + 1,
        polygon: line.polygon
          ? { points: convertPolygon(line.polygon) }
          : undefined,
      }));

      return {
        pageNumber: idx + 1,
        width: page.width || 0,
        height: page.height || 0,
        unit: page.unit === "inch" ? "inch" : "pixel",
        lines,
      };
    });

    const keyValuePairs: KeyValuePair[] = (result.keyValuePairs || [])
      .filter((kv) => kv.key && kv.value)
      .map((kv) => ({
        key: kv.key?.content || "",
        value: kv.value?.content || "",
        confidence: kv.confidence || 0,
        keyPolygon: kv.key?.boundingRegions?.[0]?.polygon
          ? { points: convertPolygon(kv.key.boundingRegions[0].polygon) }
          : undefined,
        valuePolygon: kv.value?.boundingRegions?.[0]?.polygon
          ? { points: convertPolygon(kv.value.boundingRegions[0].polygon) }
          : undefined,
        page: kv.key?.boundingRegions?.[0]?.pageNumber || 1,
      }));

    const detectedLanguages: DetectedLanguage[] = (result.languages || []).map(
      (lang) => ({
        locale: lang.locale,
        confidence: lang.confidence,
        spans: lang.spans?.map((s) => ({ offset: s.offset, length: s.length })),
      })
    );

    const tables: DocumentTable[] = (result.tables || []).map((table) => ({
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      cells: table.cells.map((cell) => ({
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        text: cell.content,
        confidence: 1.0,
        page: cell.boundingRegions?.[0]?.pageNumber || 1,
      })),
      boundingRegions: table.boundingRegions?.map((br) => ({
        page: br.pageNumber,
        polygon: br.polygon ? { points: convertPolygon(br.polygon) } : undefined,
      })),
    }));

    return {
      pages,
      tables,
      keyValuePairs,
      detectedLanguages,
      content: result.content || "",
      pageCount: pages.length,
      extractedAt: new Date().toISOString(),
      provider: "azure-document-intelligence",
      modelId: config.modelId,
    };
  } catch (error) {
    if (error instanceof AzureDIError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const redactedMessage = redactPII(message);

    if (message.includes("abort") || message.includes("timeout")) {
      throw new AzureDIError("Analysis timed out", "TIMEOUT", true);
    }

    if (message.includes("429") || message.includes("rate limit")) {
      throw new AzureDIError("Rate limit exceeded", "RATE_LIMITED", true);
    }

    if (message.includes("401") || message.includes("403")) {
      throw new AzureDIError("Authentication failed", "AUTH_FAILED");
    }

    throw new AzureDIError(redactedMessage, "ANALYSIS_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

function convertPolygon(
  polygon: Array<{ x: number; y: number }> | number[]
): Array<{ x: number; y: number }> {
  if (Array.isArray(polygon) && polygon.length > 0) {
    if (typeof polygon[0] === "number") {
      const numPolygon = polygon as number[];
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < numPolygon.length; i += 2) {
        points.push({ x: numPolygon[i], y: numPolygon[i + 1] });
      }
      return points;
    }
    return polygon as Array<{ x: number; y: number }>;
  }
  return [];
}

export function extractTextContent(docRep: DocumentRep): string {
  return docRep.content;
}

export function getKeyValuePairsMap(docRep: DocumentRep): Map<string, { value: string; confidence: number }> {
  const map = new Map<string, { value: string; confidence: number }>();
  for (const kv of docRep.keyValuePairs) {
    const normalizedKey = kv.key.toLowerCase().trim();
    map.set(normalizedKey, { value: kv.value, confidence: kv.confidence });
  }
  return map;
}

