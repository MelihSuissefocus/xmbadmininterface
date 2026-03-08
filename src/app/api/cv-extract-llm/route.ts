import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { submitCvForExtraction, CvExtractionError } from "@/lib/cv-extraction/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext !== "pdf") {
      return NextResponse.json(
        { error: "Nur PDF-Dateien werden von der LLM-Analyse unterstützt." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    const { jobId } = await submitCvForExtraction(pdfBuffer, file.name, randomUUID());

    return NextResponse.json({
      status: "processing",
      job_id: jobId,
      message: "PDF submitted for async extraction. Result will arrive via webhook callback.",
    });
  } catch (error) {
    console.error("CV LLM extraction error:", error);

    if (error instanceof CvExtractionError) {
      const statusMap: Record<string, number> = {
        AUTH_FAILED: 403,
        INVALID_PDF: 422,
        TIMEOUT: 504,
        CONFIG_ERROR: 503,
        API_ERROR: 502,
      };

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 500 }
      );
    }

    return NextResponse.json(
      { error: "LLM CV-Analyse fehlgeschlagen." },
      { status: 500 }
    );
  }
}
