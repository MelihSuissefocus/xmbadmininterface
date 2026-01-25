/**
 * OCR Parser - Production Implementation
 * Extracts text from images using Tesseract.js
 */

import { createWorker } from "tesseract.js";

export interface ExtractedText {
  text: string;
  pageCount: number;
  method: "ocr";
  confidence?: number;
}

/**
 * Extracts text from an image buffer using OCR
 */
export async function extractTextFromImage(
  buffer: Buffer,
  timeoutMs: number = 60000
): Promise<ExtractedText> {
  const worker = await createWorker("eng+deu+fra+ita", 1, {
    errorHandler: (err) => console.error("Tesseract error:", err),
  });

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OCR timeout")), timeoutMs);
    });

    // Race between OCR and timeout
    const result = await Promise.race([
      worker.recognize(buffer),
      timeoutPromise,
    ]);

    const text = result.data.text;
    const confidence = result.data.confidence;

    await worker.terminate();

    return {
      text,
      pageCount: 1,
      method: "ocr",
      confidence,
    };
  } catch (error) {
    await worker.terminate();
    console.error("OCR extraction error:", error);
    throw new Error("Failed to extract text via OCR");
  }
}

/**
 * Extracts text from multiple image buffers (for multi-page scanned PDFs)
 */
export async function extractTextFromImages(
  buffers: Buffer[],
  maxPages: number = 2,
  timeoutMs: number = 60000
): Promise<ExtractedText> {
  const pagesToProcess = buffers.slice(0, maxPages);
  const texts: string[] = [];
  let totalConfidence = 0;

  for (let i = 0; i < pagesToProcess.length; i++) {
    try {
      const result = await extractTextFromImage(pagesToProcess[i], timeoutMs);
      texts.push(result.text);
      totalConfidence += result.confidence || 0;
    } catch (error) {
      console.error(`Failed to OCR page ${i + 1}:`, error);
      // Continue with other pages
    }
  }

  if (texts.length === 0) {
    throw new Error("Failed to extract text from any page via OCR");
  }

  return {
    text: texts.join("\n\n"),
    pageCount: texts.length,
    method: "ocr",
    confidence: totalConfidence / texts.length,
  };
}
