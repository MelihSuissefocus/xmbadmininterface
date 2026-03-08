import { NextResponse } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderToPdfBuffer } from "@/lib/cv/renderers/e3Inspired/renderToPdfBuffer";
import { normalizeCandidateToCVData } from "@/lib/cv/renderers/e3Inspired/normalizeCandidateToCVData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ candidateId: string }> }
) {
    try {
        const resolvedParams = await params;
        const candidateId = resolvedParams.candidateId;

        const { searchParams } = new URL(request.url);
        const variantRaw = searchParams.get("variant") || "customer";
        const variant = variantRaw === "internal" ? "internal" : "customer";

        const [candidate] = await db
            .select()
            .from(candidates)
            .where(eq(candidates.id, candidateId))
            .limit(1);

        if (!candidate) {
            return new NextResponse("Candidate not found", { status: 404 });
        }

        const cvData = normalizeCandidateToCVData(candidate, variant);

        const pdfBuffer = await renderToPdfBuffer(cvData);

        // Sanitize filename
        const safeFirst = candidate.firstName.replace(/[^a-zA-Z0-9-]/g, "");
        const safeLast = candidate.lastName.replace(/[^a-zA-Z0-9-]/g, "");
        const filename = `CV-${safeFirst}-${safeLast}-${variant}.pdf`;

        return new NextResponse(pdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                // Force inline display in browser for preview
                "Content-Disposition": `inline; filename="${filename}"`,
                // Ensure standard cache control (caching in browser is fine but revalidate often)
                "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
            },
        });
    } catch (err: any) {
        console.error("Dynamic CV generation failed:", err);
        return new NextResponse(`PDF Generation Failed: ${err.message || String(err)}`, { status: 500 });
    }
}
