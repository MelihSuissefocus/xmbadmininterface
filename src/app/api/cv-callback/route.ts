import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cvAnalysisJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { mapMacMiniToAutoFillDraft, type MacMiniCVData } from "@/lib/cv/mac-mini-mapper";

const CV_CALLBACK_SECRET = process.env.CV_CALLBACK_SECRET;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via shared secret
    const secret = req.headers.get("x-callback-secret");
    if (!CV_CALLBACK_SECRET || secret !== CV_CALLBACK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const { job_id, data } = body as { job_id?: string; data?: MacMiniCVData };

    if (!job_id || !data) {
      return NextResponse.json(
        { error: "Missing job_id or data" },
        { status: 400 }
      );
    }

    // 3. Find the job in DB
    const [job] = await db
      .select({
        id: cvAnalysisJobs.id,
        status: cvAnalysisJobs.status,
        fileName: cvAnalysisJobs.fileName,
        fileType: cvAnalysisJobs.fileType,
        fileSize: cvAnalysisJobs.fileSize,
        createdAt: cvAnalysisJobs.createdAt,
      })
      .from(cvAnalysisJobs)
      .where(eq(cvAnalysisJobs.id, job_id))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status === "completed") {
      return NextResponse.json({ status: "already_completed" }, { status: 200 });
    }

    // 4. Map Mac Mini CVData → CandidateAutoFillDraftV2
    const now = new Date();
    const latencyMs = job.createdAt ? now.getTime() - job.createdAt.getTime() : 0;

    const result = mapMacMiniToAutoFillDraft(data, {
      fileName: job.fileName || "cv.pdf",
      fileType: job.fileType || "pdf",
      fileSize: job.fileSize || 0,
      jobId: job_id,
    });

    // Set actual processing time
    result.metadata.processingTimeMs = latencyMs;

    const autofillCount = result.filledFields.length;
    const reviewCount = result.ambiguousFields.length;

    // 5. Update job in DB
    await db
      .update(cvAnalysisJobs)
      .set({
        status: "completed",
        result: result as unknown as Record<string, unknown>,
        latencyMs,
        autofillFieldCount: autofillCount,
        reviewFieldCount: reviewCount,
        updatedAt: now,
        completedAt: now,
      })
      .where(eq(cvAnalysisJobs.id, job_id));

    return NextResponse.json({ status: "ok", job_id }, { status: 200 });
  } catch (error) {
    console.error("cv-callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
