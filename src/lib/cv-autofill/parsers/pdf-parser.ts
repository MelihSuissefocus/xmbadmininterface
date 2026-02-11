/**
 * PDF Parser - Production Implementation
 * Extracts text from PDF files using pdf-parse (Node-safe, no workers/canvas/DOMMatrix)
 */

export interface ExtractedText {
  text: string;
  pageCount: number;
  method: "text" | "ocr";
}

/**
 * Extracts text from a PDF buffer using pdf-parse (pure JS, no pdfjs worker or canvas)
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedText> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (
      dataBuffer: Buffer,
      options?: { max?: number }
    ) => Promise<{ numpages: number; text: string }>;

    const result = await pdfParse(buffer);

    return {
      text: result.text.trim(),
      pageCount: result.numpages || 1,
      method: "text",
    };
  } catch (error) {
    console.error("PDF text extraction error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Detects if extracted text appears to be from a scanned document (OCR candidate)
 */
export function detectIfScanned(text: string): boolean {
  if (text.trim().length < 100) {
    return true;
  }

  const wordsRegex = /\b[a-zA-ZäöüßÄÖÜ]{2,}\b/g;
  const words = text.match(wordsRegex) || [];
  const wordDensity = words.length / Math.max(text.length, 1);

  if (wordDensity < 0.08) {
    return true;
  }

  const uniqueChars = new Set(text.toLowerCase().split("")).size;
  if (uniqueChars < 20) {
    return true;
  }

  return false;
}

/**
 * Validates page count against maximum allowed
 */
export function validatePageCount(pageCount: number, maxPages: number = 20): boolean {
  return pageCount > 0 && pageCount <= maxPages;
}
