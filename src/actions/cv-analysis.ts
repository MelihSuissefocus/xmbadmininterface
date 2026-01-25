"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { cvAnalysisJobs, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { analyzeDocument, AzureDIError } from "@/lib/azure-di/client";
import { mapDocumentToCandidate } from "@/lib/azure-di/data-mapper";
import type { CandidateAutoFillDraftV2 } from "@/lib/azure-di/types";
import {
  validateFileMagicBytes,
  sanitizeFilename,
  validateFileSize,
  getMimeTypeFromExtension,
} from "@/lib/file-validation";
import { checkRateLimit, CV_ANALYSIS_RATE_LIMIT } from "@/lib/rate-limit";
import { CV_AUTOFILL_CONFIG } from "@/lib/constants";

interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

interface CreateJobResult {
  jobId: string;
}

interface JobStatusResult {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: CandidateAutoFillDraftV2;
  error?: string;
  createdAt: Date;
  completedAt?: Date | null;
}

async function requireAuth(): Promise<{ userId: string } | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || !["admin", "recruiter"].includes(user.role || "")) {
    return null;
  }

  return { userId: user.id };
}

export async function createCvAnalysisJob(
  base64: string,
  fileName: string,
  fileExtension: string,
  fileSize: number
): Promise<ActionResult<CreateJobResult>> {
  const authResult = await requireAuth();
  if (!authResult) {
    return { success: false, message: "Nicht autorisiert" };
  }

  const rateLimit = checkRateLimit(authResult.userId, "cv-analysis", CV_ANALYSIS_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return {
      success: false,
      message: `Zu viele Anfragen. Versuchen Sie es in ${Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)} Sekunden erneut.`,
    };
  }

  const sizeValidation = validateFileSize(fileSize, CV_AUTOFILL_CONFIG.MAX_FILE_SIZE_MB);
  if (!sizeValidation.valid) {
    return { success: false, message: sizeValidation.error || "Datei zu groß" };
  }

  const mimeType = getMimeTypeFromExtension(fileExtension);
  if (!mimeType) {
    return { success: false, message: "Nicht unterstützter Dateityp" };
  }

  const fileBytes = Buffer.from(base64, "base64");
  const magicValidation = validateFileMagicBytes(new Uint8Array(fileBytes), mimeType);
  if (!magicValidation.valid) {
    return { success: false, message: magicValidation.error || "Ungültige Datei" };
  }

  const safeFileName = sanitizeFilename(fileName);

  const [job] = await db
    .insert(cvAnalysisJobs)
    .values({
      userId: authResult.userId,
      status: "pending",
      fileName: safeFileName,
      fileType: fileExtension,
      fileSize,
    })
    .returning();

  processCvAnalysisJob(job.id, fileBytes, mimeType, safeFileName, fileExtension, fileSize).catch(
    () => {}
  );

  return {
    success: true,
    message: "Analyse gestartet",
    data: { jobId: job.id },
  };
}

async function processCvAnalysisJob(
  jobId: string,
  fileBytes: Buffer,
  mimeType: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<void> {
  const startTime = Date.now();

  await db
    .update(cvAnalysisJobs)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(cvAnalysisJobs.id, jobId));

  try {
    const docRep = await analyzeDocument(new Uint8Array(fileBytes), mimeType);

    if (docRep.pageCount > CV_AUTOFILL_CONFIG.MAX_PAGE_COUNT) {
      throw new AzureDIError(
        `Dokument hat ${docRep.pageCount} Seiten, maximal ${CV_AUTOFILL_CONFIG.MAX_PAGE_COUNT} erlaubt`,
        "TOO_MANY_PAGES"
      );
    }

    const processingTimeMs = Date.now() - startTime;
    const result = mapDocumentToCandidate(
      docRep,
      fileName,
      fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx",
      fileSize,
      processingTimeMs
    );

    await db
      .update(cvAnalysisJobs)
      .set({
        status: "completed",
        result: result as unknown as Record<string, unknown>,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(cvAnalysisJobs.id, jobId));
  } catch (error) {
    const errorMessage =
      error instanceof AzureDIError
        ? error.message
        : "Analyse fehlgeschlagen";

    await db
      .update(cvAnalysisJobs)
      .set({
        status: "failed",
        error: errorMessage,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(cvAnalysisJobs.id, jobId));
  }
}

export async function getCvAnalysisJobStatus(
  jobId: string
): Promise<ActionResult<JobStatusResult>> {
  const authResult = await requireAuth();
  if (!authResult) {
    return { success: false, message: "Nicht autorisiert" };
  }

  const [job] = await db
    .select()
    .from(cvAnalysisJobs)
    .where(
      and(eq(cvAnalysisJobs.id, jobId), eq(cvAnalysisJobs.userId, authResult.userId))
    )
    .limit(1);

  if (!job) {
    return { success: false, message: "Job nicht gefunden" };
  }

  return {
    success: true,
    message: "OK",
    data: {
      id: job.id,
      status: job.status,
      result: job.result as CandidateAutoFillDraftV2 | undefined,
      error: job.error || undefined,
      createdAt: job.createdAt!,
      completedAt: job.completedAt,
    },
  };
}

export async function getLatestCvAnalysisJobs(
  limit: number = 5
): Promise<ActionResult<JobStatusResult[]>> {
  const authResult = await requireAuth();
  if (!authResult) {
    return { success: false, message: "Nicht autorisiert" };
  }

  const jobs = await db
    .select()
    .from(cvAnalysisJobs)
    .where(eq(cvAnalysisJobs.userId, authResult.userId))
    .orderBy(desc(cvAnalysisJobs.createdAt))
    .limit(limit);

  return {
    success: true,
    message: "OK",
    data: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      result: job.result as CandidateAutoFillDraftV2 | undefined,
      error: job.error || undefined,
      createdAt: job.createdAt!,
      completedAt: job.completedAt,
    })),
  };
}

export async function deleteCvAnalysisJob(jobId: string): Promise<ActionResult> {
  const authResult = await requireAuth();
  if (!authResult) {
    return { success: false, message: "Nicht autorisiert" };
  }

  await db
    .delete(cvAnalysisJobs)
    .where(
      and(eq(cvAnalysisJobs.id, jobId), eq(cvAnalysisJobs.userId, authResult.userId))
    );

  return { success: true, message: "Job gelöscht" };
}

