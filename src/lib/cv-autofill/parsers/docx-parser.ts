/**
 * DOCX Parser - Production Implementation
 * Extracts text from DOCX files using mammoth
 */

import mammoth from "mammoth";

export interface ExtractedText {
  text: string;
  pageCount: number;
  method: "text";
}

/**
 * Extracts text from a DOCX buffer
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<ExtractedText> {
  try {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      pageCount: 1, // DOCX doesn't have reliable page count
      method: "text",
    };
  } catch (error) {
    console.error("DOCX text extraction error:", error);
    throw new Error("Failed to extract text from DOCX");
  }
}
