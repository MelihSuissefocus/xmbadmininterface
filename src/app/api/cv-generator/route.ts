import { NextResponse } from "next/server";
import { z } from "zod";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { auth } from "@/auth";
import { db } from "@/db";
import { candidates, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderToPdfBuffer } from "@/lib/cv/renderers/e3Inspired/renderToPdfBuffer";
import { normalizeCandidateToCVData } from "@/lib/cv/renderers/e3Inspired/normalizeCandidateToCVData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Request validation
// ─────────────────────────────────────────────────────────────────────────────

const RequestBody = z.object({
  candidateId: z.string().uuid(),
  variant: z.enum(["customer", "internal"]),
});

/** Roles allowed to generate CVs (all roles may read/generate). */
const ALLOWED_ROLES = new Set(["admin", "recruiter", "viewer"]);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cv-generator
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── Auth ─────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Role check ──────────────────────────────────────────
  const [user] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (user.role && !ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Parse & validate body ────────────────────────────────
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

  // ── Load candidate ──────────────────────────────────────
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, body.candidateId))
    .limit(1);

  if (!candidate) {
    return NextResponse.json(
      { error: "Candidate not found" },
      { status: 404 },
    );
  }

  // ── Normalize & render ──────────────────────────────────
  const cvData = normalizeCandidateToCVData(candidate, body.variant);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToPdfBuffer(cvData);
  } catch (err) {
    console.error("CV render failed:", err);
    return NextResponse.json(
      { error: "PDF_RENDER_FAILED" },
      { status: 500 },
    );
  }

  // ── Persist to filesystem ───────────────────────────────
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\.\d+Z$/, "")
    .slice(0, 15); // yyyyMMdd-HHmmss → "20260303120000" → we format below
  const stamp = `${ts.slice(0, 8)}-${ts.slice(8)}`;
  const fileName = `${stamp}-${body.variant}.pdf`;

  const relDir = join("uploads", "cvs", body.candidateId);
  const absDir = join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  await writeFile(join(absDir, fileName), pdfBuffer);

  const pdfUrl = `/${relDir}/${fileName}`;

  // ── Update brandedCvUrl for customer variant ────────────
  if (body.variant === "customer") {
    await db
      .update(candidates)
      .set({ brandedCvUrl: pdfUrl })
      .where(eq(candidates.id, body.candidateId));
  }

  // ── Response ────────────────────────────────────────────
  return NextResponse.json({
    pdfUrl,
    createdAt: now.toISOString(),
    candidateId: body.candidateId,
    variant: body.variant,
  });
}
