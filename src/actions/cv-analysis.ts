"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { cvAnalysisJobs, cvAnalyticsDaily, tenantQuotaConfig, users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { analyzeDocument, AzureDIError } from "@/lib/azure-di/client";
import { mapDocumentToCandidate, type MapperConfig } from "@/lib/azure-di/data-mapper";
import type { CandidateAutoFillDraftV2 } from "@/lib/azure-di/types";
import { validateFileMagicBytes, sanitizeFilename, validateFileSize, getMimeTypeFromExtension } from "@/lib/file-validation";
import { checkRateLimit, checkDailyQuota, checkTenantQuota, CV_ANALYSIS_RATE_LIMIT, CV_DAILY_QUOTA, DEFAULT_TENANT_DAILY_QUOTA } from "@/lib/rate-limit";
import { computeFileHash, getCachedResult, setCachedResult, DEDUPE_TTL_MS } from "@/lib/dedupe";
import { cvLogger } from "@/lib/logger";
import { metrics, CV_METRICS } from "@/lib/metrics";
import { CVError, wrapError, isCVError } from "@/lib/cv-errors";
import { CV_AUTOFILL_CONFIG } from "@/lib/constants";
import { getExtractionConfigForJob } from "./extraction-config";

const OVERALL_ANALYSIS_TIMEOUT_MS = 30000;
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  code?: string;
  retryable?: boolean;
  data?: T;
}

interface CreateJobResult {
  jobId: string;
  cached?: boolean;
}

interface JobStatusResult {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: CandidateAutoFillDraftV2;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  createdAt: Date;
  completedAt?: Date | null;
}

async function requireAuth(): Promise<{ userId: string; tenantId: string } | null> {
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

  return { userId: user.id, tenantId: DEFAULT_TENANT_ID };
}

async function getTenantQuota(tenantId: string): Promise<number> {
  const [config] = await db
    .select({ dailyAnalysisQuota: tenantQuotaConfig.dailyAnalysisQuota })
    .from(tenantQuotaConfig)
    .where(eq(tenantQuotaConfig.tenantId, tenantId))
    .limit(1);

  return config?.dailyAnalysisQuota ?? DEFAULT_TENANT_DAILY_QUOTA;
}

async function recordAnalytics(
  tenantId: string,
  success: boolean,
  timeout: boolean,
  dedupe: boolean,
  latencyMs: number,
  pages: number,
  autofillFields: number,
  reviewFields: number
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  try {
    const [existing] = await db
      .select()
      .from(cvAnalyticsDaily)
      .where(and(eq(cvAnalyticsDaily.tenantId, tenantId), eq(cvAnalyticsDaily.date, today)))
      .limit(1);

    if (existing) {
      await db
        .update(cvAnalyticsDaily)
        .set({
          successCount: success ? sql`${cvAnalyticsDaily.successCount} + 1` : cvAnalyticsDaily.successCount,
          failureCount: !success && !timeout ? sql`${cvAnalyticsDaily.failureCount} + 1` : cvAnalyticsDaily.failureCount,
          timeoutCount: timeout ? sql`${cvAnalyticsDaily.timeoutCount} + 1` : cvAnalyticsDaily.timeoutCount,
          dedupeHitCount: dedupe ? sql`${cvAnalyticsDaily.dedupeHitCount} + 1` : cvAnalyticsDaily.dedupeHitCount,
          totalLatencyMs: sql`${cvAnalyticsDaily.totalLatencyMs} + ${latencyMs}`,
          totalPages: sql`${cvAnalyticsDaily.totalPages} + ${pages}`,
          totalAutofillFields: sql`${cvAnalyticsDaily.totalAutofillFields} + ${autofillFields}`,
          totalReviewFields: sql`${cvAnalyticsDaily.totalReviewFields} + ${reviewFields}`,
        })
        .where(eq(cvAnalyticsDaily.id, existing.id));
    } else {
      await db.insert(cvAnalyticsDaily).values({
        tenantId,
        date: today,
        successCount: success ? 1 : 0,
        failureCount: !success && !timeout ? 1 : 0,
        timeoutCount: timeout ? 1 : 0,
        dedupeHitCount: dedupe ? 1 : 0,
        totalLatencyMs: latencyMs,
        totalPages: pages,
        totalAutofillFields: autofillFields,
        totalReviewFields: reviewFields,
      });
    }
  } catch (err) {
    cvLogger.warn("Failed to record analytics", { action: "recordAnalytics" });
  }
}

export async function createCvAnalysisJob(
  base64: string,
  fileName: string,
  fileExtension: string,
  fileSize: number
): Promise<ActionResult<CreateJobResult>> {
  const startTime = Date.now();

  try {
    const authResult = await requireAuth();
    if (!authResult) {
      metrics.increment(CV_METRICS.ANALYSIS_FAILED, 1, { reason: "auth" });
      return new CVError("AUTH_REQUIRED").toUserResponse();
    }

    const { userId, tenantId } = authResult;

    cvLogger.info("CV analysis requested", { userId, action: "createCvAnalysisJob" });

    const rateLimit = checkRateLimit(userId, "cv-analysis", CV_ANALYSIS_RATE_LIMIT);
    if (!rateLimit.allowed) {
      metrics.increment(CV_METRICS.ANALYSIS_RATE_LIMITED);
      cvLogger.warn("Rate limit exceeded", { userId, action: "createCvAnalysisJob" });
      return new CVError("RATE_LIMITED").toUserResponse();
    }

    const dailyQuota = checkDailyQuota(userId, CV_DAILY_QUOTA);
    if (!dailyQuota.allowed) {
      metrics.increment(CV_METRICS.ANALYSIS_QUOTA_EXCEEDED, 1, { type: "user" });
      cvLogger.warn("Daily user quota exceeded", { userId, action: "createCvAnalysisJob" });
      return new CVError("DAILY_QUOTA_EXCEEDED").toUserResponse();
    }

    const tenantLimit = await getTenantQuota(tenantId);
    const tenantQuota = checkTenantQuota(tenantId, tenantLimit);
    if (!tenantQuota.allowed) {
      metrics.increment(CV_METRICS.ANALYSIS_QUOTA_EXCEEDED, 1, { type: "tenant" });
      cvLogger.warn("Tenant quota exceeded", { userId, action: "createCvAnalysisJob" });
      return new CVError("TENANT_QUOTA_EXCEEDED").toUserResponse();
    }

    const sizeValidation = validateFileSize(fileSize, CV_AUTOFILL_CONFIG.MAX_FILE_SIZE_MB);
    if (!sizeValidation.valid) {
      return new CVError("FILE_TOO_LARGE").toUserResponse();
    }

    const mimeType = getMimeTypeFromExtension(fileExtension);
    if (!mimeType) {
      return new CVError("FILE_INVALID_TYPE").toUserResponse();
    }

    const fileBytes = Buffer.from(base64, "base64");
    const magicValidation = validateFileMagicBytes(new Uint8Array(fileBytes), mimeType);
    if (!magicValidation.valid) {
      cvLogger.warn("Magic byte mismatch", { userId, action: "createCvAnalysisJob" });
      return new CVError("FILE_MAGIC_MISMATCH").toUserResponse();
    }

    const safeFileName = sanitizeFilename(fileName);
    const fileHash = computeFileHash(fileBytes);

    const cachedResult = getCachedResult(fileHash, userId);
    if (cachedResult) {
      metrics.increment(CV_METRICS.ANALYSIS_DEDUPE_HIT);
      cvLogger.info("Dedupe cache hit", { userId, jobId: (cachedResult as CreateJobResult).jobId, action: "createCvAnalysisJob" });

      await recordAnalytics(tenantId, true, false, true, Date.now() - startTime, 0, 0, 0);

      return {
        success: true,
        message: "Analyse aus Cache geladen",
        data: { jobId: (cachedResult as CreateJobResult).jobId, cached: true },
      };
    }

    metrics.increment(CV_METRICS.ANALYSIS_STARTED);

    const [job] = await db
      .insert(cvAnalysisJobs)
      .values({
        userId,
        tenantId,
        status: "pending",
        fileName: safeFileName,
        fileType: fileExtension,
        fileSize,
        fileHash,
      })
      .returning();

    cvLogger.info("Analysis job created", { userId, jobId: job.id, action: "createCvAnalysisJob" });

    processCvAnalysisJob(job.id, fileBytes, mimeType, safeFileName, fileExtension, fileSize, tenantId).catch(() => {});

    return {
      success: true,
      message: "Analyse gestartet",
      data: { jobId: job.id },
    };
  } catch (error) {
    const cvError = wrapError(error);
    cvLogger.error("Failed to create analysis job", { action: "createCvAnalysisJob" });
    return cvError.toUserResponse();
  }
}

async function processCvAnalysisJob(
  jobId: string,
  fileBytes: Buffer,
  mimeType: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  tenantId: string
): Promise<void> {
  const startTime = Date.now();
  let isTimeout = false;
  let pageCount = 0;
  let autofillCount = 0;
  let reviewCount = 0;

  const [job] = await db
    .select({ userId: cvAnalysisJobs.userId, fileHash: cvAnalysisJobs.fileHash })
    .from(cvAnalysisJobs)
    .where(eq(cvAnalysisJobs.id, jobId))
    .limit(1);

  if (!job) {
    cvLogger.error("Job not found for processing", { jobId, action: "processCvAnalysisJob" });
    return;
  }

  await db
    .update(cvAnalysisJobs)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(cvAnalysisJobs.id, jobId));

  cvLogger.info("Processing CV analysis", { jobId, action: "processCvAnalysisJob" });

  const timeoutController = new AbortController();
  const overallTimeout = setTimeout(() => {
    isTimeout = true;
    timeoutController.abort();
  }, OVERALL_ANALYSIS_TIMEOUT_MS);

  try {
    const analysisPromise = Promise.race([
      (async () => {
        const [docRep, extractionConfig] = await Promise.all([
          analyzeDocument(new Uint8Array(fileBytes), mimeType),
          getExtractionConfigForJob(),
        ]);
        return { docRep, extractionConfig };
      })(),
      new Promise<never>((_, reject) => {
        timeoutController.signal.addEventListener("abort", () => {
          reject(new CVError("ANALYSIS_TIMEOUT"));
        });
      }),
    ]);

    const { docRep, extractionConfig } = await analysisPromise;

    pageCount = docRep.pageCount;

    if (docRep.pageCount > CV_AUTOFILL_CONFIG.MAX_PAGE_COUNT) {
      throw new CVError("FILE_TOO_MANY_PAGES", { pages: docRep.pageCount });
    }

    const latencyMs = Date.now() - startTime;

    const mapperConfig: MapperConfig = {
      synonyms: extractionConfig.synonyms,
      dbSkills: extractionConfig.dbSkills,
      skillAliases: new Map(Object.entries(extractionConfig.skillAliases)),
    };

    const result = mapDocumentToCandidate(
      docRep,
      fileName,
      fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx",
      fileSize,
      latencyMs,
      mapperConfig
    );

    autofillCount = result.filledFields?.length ?? 0;
    reviewCount = result.ambiguousFields?.length ?? 0;

    metrics.increment(CV_METRICS.ANALYSIS_SUCCESS);
    metrics.recordHistogram(CV_METRICS.ANALYSIS_LATENCY_MS, latencyMs);
    metrics.recordHistogram(CV_METRICS.ANALYSIS_PAGES, pageCount);
    metrics.increment(CV_METRICS.EXTRACTION_AUTOFILL_FIELDS, autofillCount);
    metrics.increment(CV_METRICS.EXTRACTION_REVIEW_FIELDS, reviewCount);

    await db
      .update(cvAnalysisJobs)
      .set({
        status: "completed",
        result: result as unknown as Record<string, unknown>,
        latencyMs,
        pageCount,
        autofillFieldCount: autofillCount,
        reviewFieldCount: reviewCount,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(cvAnalysisJobs.id, jobId));

    if (job.fileHash) {
      setCachedResult(job.fileHash, job.userId, { jobId }, DEDUPE_TTL_MS);
    }

    await recordAnalytics(tenantId, true, false, false, latencyMs, pageCount, autofillCount, reviewCount);

    cvLogger.info("CV analysis completed", { jobId, durationMs: latencyMs, pageCount, autofillCount, reviewCount, action: "processCvAnalysisJob" });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const cvError = isCVError(error) ? error : wrapError(error);

    if (cvError.code === "ANALYSIS_TIMEOUT") {
      isTimeout = true;
      metrics.increment(CV_METRICS.ANALYSIS_TIMEOUT);
    } else {
      metrics.increment(CV_METRICS.ANALYSIS_FAILED, 1, { code: cvError.code });
    }

    await db
      .update(cvAnalysisJobs)
      .set({
        status: "failed",
        error: cvError.userMessage,
        errorCode: cvError.code,
        latencyMs,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(cvAnalysisJobs.id, jobId));

    await recordAnalytics(tenantId, false, isTimeout, false, latencyMs, pageCount, 0, 0);

    cvLogger.error("CV analysis failed", { jobId, errorCode: cvError.code, durationMs: latencyMs, action: "processCvAnalysisJob" });
  } finally {
    clearTimeout(overallTimeout);
  }
}

export async function getCvAnalysisJobStatus(jobId: string): Promise<ActionResult<JobStatusResult>> {
  try {
    const authResult = await requireAuth();
    if (!authResult) {
      return new CVError("AUTH_REQUIRED").toUserResponse();
    }

    const [job] = await db
      .select()
      .from(cvAnalysisJobs)
      .where(and(eq(cvAnalysisJobs.id, jobId), eq(cvAnalysisJobs.userId, authResult.userId)))
      .limit(1);

    if (!job) {
      return new CVError("JOB_NOT_FOUND").toUserResponse();
    }

    const isRetryable = job.errorCode
      ? ["ANALYSIS_TIMEOUT", "ANALYSIS_FAILED", "AZURE_RATE_LIMITED"].includes(job.errorCode)
      : false;

    return {
      success: true,
      message: "OK",
      data: {
        id: job.id,
        status: job.status,
        result: job.result as CandidateAutoFillDraftV2 | undefined,
        error: job.error || undefined,
        errorCode: job.errorCode || undefined,
        retryable: isRetryable,
        createdAt: job.createdAt!,
        completedAt: job.completedAt,
      },
    };
  } catch (error) {
    const cvError = wrapError(error);
    return cvError.toUserResponse();
  }
}

export async function getLatestCvAnalysisJobs(limit: number = 5): Promise<ActionResult<JobStatusResult[]>> {
  try {
    const authResult = await requireAuth();
    if (!authResult) {
      return new CVError("AUTH_REQUIRED").toUserResponse();
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
        errorCode: job.errorCode || undefined,
        retryable: job.errorCode ? ["ANALYSIS_TIMEOUT", "ANALYSIS_FAILED", "AZURE_RATE_LIMITED"].includes(job.errorCode) : false,
        createdAt: job.createdAt!,
        completedAt: job.completedAt,
      })),
    };
  } catch (error) {
    const cvError = wrapError(error);
    return cvError.toUserResponse();
  }
}

export async function deleteCvAnalysisJob(jobId: string): Promise<ActionResult> {
  try {
    const authResult = await requireAuth();
    if (!authResult) {
      return new CVError("AUTH_REQUIRED").toUserResponse();
    }

    await db
      .delete(cvAnalysisJobs)
      .where(and(eq(cvAnalysisJobs.id, jobId), eq(cvAnalysisJobs.userId, authResult.userId)));

    cvLogger.info("Analysis job deleted", { userId: authResult.userId, jobId, action: "deleteCvAnalysisJob" });

    return { success: true, message: "Job gelöscht" };
  } catch (error) {
    const cvError = wrapError(error);
    return cvError.toUserResponse();
  }
}
