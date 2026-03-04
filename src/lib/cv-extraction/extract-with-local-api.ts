/**
 * CV extraction using the local Mac Mini LLM API.
 * Returns the same CandidateAutoFillDraftV2 format as the Azure DI + LLM pipeline.
 */

import { extractCvFromPdf } from "./client";
import { mapMacMiniResponseToDraftV2 } from "./mapper";
import type { CandidateAutoFillDraftV2 } from "@/lib/azure-di/types";

export async function extractWithLocalApi(
  fileBytes: Buffer,
  fileName: string,
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx",
  fileSize: number
): Promise<CandidateAutoFillDraftV2> {
  const startTime = Date.now();

  const macMiniResponse = await extractCvFromPdf(fileBytes, fileName);

  const processingTimeMs = Date.now() - startTime;

  return mapMacMiniResponseToDraftV2(
    macMiniResponse,
    fileName,
    fileType,
    fileSize,
    processingTimeMs
  );
}
