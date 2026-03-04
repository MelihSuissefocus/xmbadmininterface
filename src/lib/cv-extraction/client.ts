/**
 * Mac Mini LLM CV Extraction Client
 * Sends PDF files to local 14B model via ngrok tunnel for structured extraction
 */

import type { MacMiniCvResponse } from "./types";

const CV_API_TIMEOUT_MS = 60_000;

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
  const url = process.env.CV_API_URL;
  const key = process.env.CV_API_KEY;

  if (!url || !key) {
    throw new CvExtractionError(
      "CV_API_URL oder CV_API_KEY ist nicht konfiguriert.",
      "CONFIG_ERROR"
    );
  }

  return { url, key };
}

/**
 * Sends a PDF buffer to the Mac Mini LLM API and returns structured CV data.
 */
export async function extractCvFromPdf(
  pdfBuffer: Buffer,
  fileName: string
): Promise<MacMiniCvResponse> {
  const { url, key } = getConfig();

  // Clean URL joining: ensure base URL ends with /, endpoint starts without /
  const baseUrl = url.endsWith("/") ? url : `${url}/`;
  const endpoint = `${baseUrl}extract-cv/`;

  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  formData.append("file", blob, fileName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CV_API_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "accept": "application/json",
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new CvExtractionError(
          "Zugriff verweigert. Der API-Schlüssel ist ungültig oder abgelaufen.",
          "AUTH_FAILED",
          403
        );
      }
      if (response.status === 422) {
        throw new CvExtractionError(
          "Die hochgeladene Datei konnte nicht verarbeitet werden. Bitte stelle sicher, dass es sich um ein gültiges PDF handelt.",
          "INVALID_PDF",
          422
        );
      }
      throw new CvExtractionError(
        `Die CV-Analyse API hat mit Status ${response.status} geantwortet.`,
        "API_ERROR",
        response.status
      );
    }

    const data: MacMiniCvResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof CvExtractionError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CvExtractionError(
        "Die CV-Analyse hat zu lange gedauert (Timeout nach 60 Sekunden). Das lokale LLM ist möglicherweise überlastet.",
        "TIMEOUT"
      );
    }

    throw new CvExtractionError(
      `Verbindung zur CV-Analyse API fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      "API_ERROR"
    );
  } finally {
    clearTimeout(timeout);
  }
}
