import { NextResponse } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data.firstName || !data.lastName) {
      return NextResponse.json(
        { error: "firstName and lastName are required" },
        { status: 400 }
      );
    }

    const [candidate] = await db
      .insert(candidates)
      .values({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        street: data.street || null,
        postalCode: data.postalCode || null,
        city: data.city || null,
        canton: data.canton || null,
        linkedinUrl: data.linkedinUrl || null,
        targetRole: data.targetRole || null,
        yearsOfExperience: data.yearsOfExperience || null,
        skills: data.skills || null,
        languages: data.languages || null,
        certificates: data.certificates || null,
        education: data.education || null,
        experience: data.experience || null,
        highlights: data.highlights || null,
        notes: data.notes || null,
        status: "new",
      })
      .returning();

    return NextResponse.json({ success: true, data: candidate });
  } catch (error) {
    console.error("Candidate creation API error:", error);
    return NextResponse.json(
      { error: "Failed to create candidate" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      const [candidate] = await db
        .select()
        .from(candidates)
        .where(eq(candidates.id, id))
        .limit(1);

      if (!candidate) {
        return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: candidate });
    }

    return NextResponse.json({ error: "id parameter required" }, { status: 400 });
  } catch (error) {
    console.error("Candidate read API error:", error);
    return NextResponse.json({ error: "Failed to read candidate" }, { status: 500 });
  }
}
