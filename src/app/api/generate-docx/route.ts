import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { candidates, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { mapCandidateToDocxData } from "@/lib/cv-docx/map-candidate";
import { renderDocx } from "@/lib/cv-docx/render-docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // LLM calls may take time

const RequestBody = z.object({
  candidateId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db
      .select({ role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Parse body ───────────────────────────────────────────
    let body: z.infer<typeof RequestBody>;
    try {
      const raw = await request.json();
      body = RequestBody.parse(raw);
    } catch (err) {
      const message =
        err instanceof z.ZodError
          ? err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
          : "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // ── Load candidate ───────────────────────────────────────
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, body.candidateId))
      .limit(1);

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // ── Map data (includes LLM calls for projekte) ───────────
    const templateData = await mapCandidateToDocxData(candidate);

    // ── Render DOCX ──────────────────────────────────────────
    const docxBuffer = await renderDocx(templateData);

    const fileName = `CV_${candidate.firstName}_${candidate.lastName}.docx`;

    return new Response(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(docxBuffer.length),
      },
    });
  } catch (err) {
    console.error("DOCX generation failed:", err);
    return NextResponse.json(
      {
        error: "DOCX_GENERATION_FAILED",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
