/**
 * PDF Parser - Production Implementation
 * Extracts text from PDF files using pdf-parse
 */

import { ensureCanvasPolyfills } from "@/lib/polyfills/dommatrix";

export interface ExtractedText {
  text: string;
  pageCount: number;
  method: "text" | "ocr";
}

/**
 * Extracts text from a PDF buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedText> {
  ensureCanvasPolyfills();
  const { PDFParse } = await import("pdf-parse");

  try {
    const data = new Uint8Array(buffer);
    const parser = new PDFParse({ data });
    const textResult = await parser.getText();

    return {
      text: textResult.text,
      pageCount: textResult.total,
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
  // Simple heuristics:
  // - Very short text despite large file
  // - Low word density
  // - Minimal alphanumeric content

  if (text.trim().length < 100) {
    return true; // Suspiciously short
  }

  // Check for reasonable text density
  const wordsRegex = /\b[a-zA-ZäöüßÄÖÜ]{2,}\b/g;
  const words = text.match(wordsRegex) || [];
  const wordDensity = words.length / Math.max(text.length, 1);

  // If less than 8% of characters form words, likely scanned poorly
  if (wordDensity < 0.08) {
    return true;
  }

  // Check for very low character diversity (common in failed OCR)
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
