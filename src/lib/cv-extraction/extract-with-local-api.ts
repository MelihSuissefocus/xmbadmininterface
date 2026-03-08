/**
 * CV extraction using the local Mac Mini LLM API (async submit).
 * Submits the PDF for background processing; result arrives via webhook callback.
 */

import { submitCvForExtraction } from "./client";

export async function submitToLocalApi(
  fileBytes: Buffer,
  fileName: string,
  internalJobId?: string
): Promise<{ externalJobId: string }> {
  const { jobId } = await submitCvForExtraction(fileBytes, fileName, internalJobId);
  return { externalJobId: jobId };
}
