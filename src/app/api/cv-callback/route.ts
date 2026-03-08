import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cvAnalysisJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { mapMacMiniResponseToDraftV2 } from "@/lib/cv-extraction/mapper";
import type { MacMiniCvResponse } from "@/lib/cv-extraction/types";

interface CallbackBody extends MacMiniCvResponse {
  job_id: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validate API key (accept both header names)
    const apiKey = request.headers.get("X-Callback-Secret") || request.headers.get("Xmb-pdftojsonapi");
    const expectedKey = process.env.CV_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      console.log("[CV-CALLBACK] Auth failed: invalid or missing API key");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Parse body — Mac Mini sends { job_id, data: {...} } or { job_id, error: "..." }
    const body = await request.json();
    const { job_id, data: cvData, error: extractionError } = body;

    if (!job_id) {
      console.log("[CV-CALLBACK] Missing job_id in request body");
      return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
    }

    console.log(`[CV-CALLBACK] Received callback for job_id=${job_id}`);

    // 3. Find job by externalJobId
    const [job] = await db
      .select({
        id: cvAnalysisJobs.id,
        fileName: cvAnalysisJobs.fileName,
        fileType: cvAnalysisJobs.fileType,
        fileSize: cvAnalysisJobs.fileSize,
        createdAt: cvAnalysisJobs.createdAt,
      })
      .from(cvAnalysisJobs)
      .where(eq(cvAnalysisJobs.externalJobId, job_id))
      .limit(1);

    if (!job) {
      console.log(`[CV-CALLBACK] No job found for external job_id=${job_id}`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const latencyMs = job.createdAt ? Date.now() - job.createdAt.getTime() : 0;

    // 4. Handle extraction error from Mac Mini
    if (extractionError || !cvData) {
      console.log(`[CV-CALLBACK] Job ${job_id} failed: ${extractionError || "no data"}`);
      await db
        .update(cvAnalysisJobs)
        .set({
          status: "failed",
          latencyMs,
          updatedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(cvAnalysisJobs.id, job.id));
      return NextResponse.json({ success: true, status: "failed" });
    }

    // 5. Map response to draft
    const draft = mapMacMiniResponseToDraftV2(
      cvData as MacMiniCvResponse,
      job.fileName,
      job.fileType as "pdf" | "png" | "jpg" | "jpeg" | "docx",
      job.fileSize,
      latencyMs
    );

    const autofillCount = draft.filledFields?.length ?? 0;
    const reviewCount = draft.ambiguousFields?.length ?? 0;

    // 5. Update job as completed
    await db
      .update(cvAnalysisJobs)
      .set({
        status: "completed",
        result: draft as unknown as Record<string, unknown>,
        latencyMs,
        autofillFieldCount: autofillCount,
        reviewFieldCount: reviewCount,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(cvAnalysisJobs.id, job.id));

    console.log(
      `[CV-CALLBACK] Job ${job.id} completed | externalJobId=${job_id} | latency=${latencyMs}ms | fields=${autofillCount} autofill, ${reviewCount} review`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CV-CALLBACK] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
