/**
 * Mac Mini LLM CV Extraction Client
 * Sends PDF files to local 14B model via ngrok tunnel for async extraction
 */

import type { MacMiniSubmitResponse } from "./types";

// Timeout only for the HTTP submit (upload + immediate async response).
// The actual LLM processing happens in the background on Mac Mini.
const CV_API_TIMEOUT_MS = 15_000;

export class CvExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: "AUTH_FAILED" | "INVALID_PDF" | "TIMEOUT" | "API_ERROR" | "CONFIG_ERROR",
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "CvExtractionError";
  }
}

function getConfig() {
  let url = process.env.CV_API_URL;
  const key = process.env.CV_API_KEY;

  if (!url || !key) {
    throw new CvExtractionError(
      "CV_API_URL oder CV_API_KEY ist nicht konfiguriert.",
      "CONFIG_ERROR"
    );
  }

  // Ensure protocol is present
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return { url, key };
}

/**
 * Submits a PDF buffer to the Mac Mini LLM API for async extraction.
 * Returns the external job_id for tracking via webhook callback.
 */
export async function submitCvForExtraction(
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ jobId: string }> {
  const { url, key } = getConfig();

  // Clean URL joining: ensure base URL ends with /, endpoint starts without /
  const baseUrl = url.endsWith("/") ? url : `${url}/`;
  const endpoint = `${baseUrl}extract-cv/`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("file", blob, fileName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CV_API_TIMEOUT_MS);

  try {
    console.log(`[CV-API] POST ${endpoint} | file=${fileName} | size=${pdfBuffer.length} bytes`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Xmb-pdftojsonapi": key,
        "accept": "application/json",
      },
      body: formData,
      signal: controller.signal,
    });

    console.log(`[CV-API] Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[CV-API] Error body: ${body}`);

      if (response.status === 403) {
        throw new CvExtractionError(
          `Zugriff verweigert (403). API-Key ungültig. Response: ${body}`,
          "AUTH_FAILED",
          403
        );
      }
      if (response.status === 422) {
        throw new CvExtractionError(
          `Datei konnte nicht verarbeitet werden (422). Response: ${body}`,
          "INVALID_PDF",
          422
        );
      }
      if (response.status === 502) {
        throw new CvExtractionError(
          `Mac Mini Server nicht erreichbar (502 Bad Gateway). Ist der Python-Server auf localhost:8000 gestartet?`,
          "API_ERROR",
          502
        );
      }
      throw new CvExtractionError(
        `CV-API Status ${response.status}: ${body}`,
        "API_ERROR",
        response.status
      );
    }

    const data: MacMiniSubmitResponse = await response.json();
    console.log(`[CV-API] Job submitted: job_id=${data.job_id}, status=${data.status}`);
    return { jobId: data.job_id };
  } catch (error) {
    if (error instanceof CvExtractionError) {
      console.error(`[CV-API] CvExtractionError: ${error.code} - ${error.message}`);
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      console.error(`[CV-API] Timeout nach ${CV_API_TIMEOUT_MS}ms — Mac Mini hat nicht rechtzeitig geantwortet`);
      throw new CvExtractionError(
        "Mac Mini hat nicht rechtzeitig geantwortet (Timeout). Ist der Server erreichbar?",
        "TIMEOUT"
      );
    }

    console.error(`[CV-API] Unerwarteter Fehler:`, error);
    throw new CvExtractionError(
      `Verbindung zur CV-Analyse API fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      "API_ERROR"
    );
  } finally {
    clearTimeout(timeout);
  }
}
