/**
 * PDF Parser - Production Implementation
 * Extracts text from PDF files using pdf2json (Node-safe, no workers/canvas)
 */

export interface ExtractedText {
  text: string;
  pageCount: number;
  method: "text" | "ocr";
}

/**
 * Extracts text from a PDF buffer using pdf2json (pure JS, no pdfjs/canvas dependencies)
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedText> {
  try {
    // Dynamically import pdf2json to avoid SSR issues
    const PDFParser = (await import("pdf2json")).default;

    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(); // Create parser with default options

      let pageCount = 0;
      let extractedText = "";

      // Handle data event - fired when PDF is parsed
      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        try {
          // Extract text from all pages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = pdfData as any;
          if (data.Pages && Array.isArray(data.Pages)) {
            pageCount = data.Pages.length;

            for (const page of data.Pages) {
              if (page.Texts && Array.isArray(page.Texts)) {
                for (const textItem of page.Texts) {
                  if (textItem.R && Array.isArray(textItem.R)) {
                    for (const run of textItem.R) {
                      if (run.T) {
                        // Decode URI-encoded text with error handling
                        try {
                          const decodedText = decodeURIComponent(run.T);
                          extractedText += decodedText + " ";
                        } catch {
                          // If decoding fails, use the raw text
                          extractedText += run.T.replace(/%20/g, " ") + " ";
                        }
                      }
                    }
                  }
                }
                extractedText += "\n"; // New line after each page
              }
            }
          }

          resolve({
            text: extractedText.trim(),
            pageCount: pageCount || 1,
            method: "text",
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse PDF data: ${parseError}`));
        }
      });

      // Handle error event
      pdfParser.on("pdfParser_dataError", (error) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        reject(new Error(`PDF parsing error: ${errorMsg}`));
      });

      // Parse the buffer
      pdfParser.parseBuffer(buffer);
    });
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
