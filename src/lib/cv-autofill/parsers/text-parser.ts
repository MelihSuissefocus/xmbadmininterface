/**
 * Basic Text Parser
 * Simple text extraction without external dependencies
 * NOTE: This is a basic implementation. For production, consider using pdf-parse or pdfjs-dist
 */

export interface ExtractedText {
  text: string;
  pageCount: number;
  method: "text" | "ocr";
}

/**
 * Extracts text from a file (placeholder for PDF/DOCX parsing)
 * This is a stub that would need proper PDF/DOCX libraries in production
 */
export async function extractTextFromFile(
  file: File
): Promise<ExtractedText> {
  const fileType = file.name.split('.').pop()?.toLowerCase();

  // For now, we can only handle plain text
  // TODO: Implement proper PDF/DOCX extraction with libraries
  if (fileType === "txt") {
    const text = await file.text();
    return {
      text,
      pageCount: 1,
      method: "text",
    };
  }

  // Placeholder for PDF/DOCX
  // In production, this would use pdf-parse or pdfjs-dist for PDF
  // and mammoth or docx for DOCX files
  return {
    text: "",
    pageCount: 0,
    method: "text",
  };
}

/**
 * Detects if extracted text appears to be from a scanned document (OCR candidate)
 */
export function detectIfScanned(text: string): boolean {
  // Simple heuristics:
  // - Very short text despite large file size
  // - Many OCR-typical errors (like "l" vs "I", "0" vs "O")
  // - Random characters/noise

  if (text.length < 100) {
    return true; // Suspiciously short
  }

  // Check for reasonable text density
  const wordsRegex = /\b[a-zA-Z]{2,}\b/g;
  const words = text.match(wordsRegex) || [];
  const wordDensity = words.length / text.length;

  // If less than 10% of characters form words, likely scanned poorly
  if (wordDensity < 0.1) {
    return true;
  }

  return false;
}

/**
 * Checks if page count exceeds maximum allowed
 */
export function validatePageCount(pageCount: number, maxPages: number = 20): boolean {
  return pageCount <= maxPages;
}
