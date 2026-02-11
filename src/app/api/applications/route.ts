
import { NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, jobCandidates } from "@/db/schema";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();

        // Extract text fields
        const jobId = formData.get("jobId") as string;
        const firstName = formData.get("firstName") as string;
        const lastName = formData.get("lastName") as string;
        const email = formData.get("email") as string;
        const phone = formData.get("phone") as string;
        const street = formData.get("street") as string;
        const zip = formData.get("zip") as string;
        const city = formData.get("city") as string;
        const country = formData.get("country") as string;
        const nationality = formData.get("nationality") as string;
        const permit = formData.get("permit") as string;
        const rate = formData.get("rate") as string;
        const availability = formData.get("availability") as string;
        const desiredWorkload = formData.get("desiredWorkload") as string;
        const preferredWorkMode = formData.get("preferredWorkMode") as string;
        const billing = formData.get("billing") as string;
        const companyName = formData.get("companyName") as string;
        // const companyUid = formData.get("companyUid") as string;

        // Handle File Uploads
        const uploadDir = join(process.cwd(), "public", "uploads", "applications");
        await mkdir(uploadDir, { recursive: true });

        const saveFile = async (file: File | null) => {
            if (!file || typeof file === 'string') return null;

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Simple sanitization
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const fileName = `${uuidv4()}-${safeName}`;
            const path = join(uploadDir, fileName);

            await writeFile(path, buffer);
            return `/uploads/applications/${fileName}`;
        };

        const cvFile = formData.get("cv") as File;
        const cvPath = await saveFile(cvFile);

        // Create Candidate
        const [newCandidate] = await db.insert(candidates).values({
            firstName,
            lastName,
            email,
            phone,
            street,
            postalCode: zip,
            city,
            // country, // TODO: Add to schema if needed, currently mapping to existing fields
            // nationality,
            // permit, 
            desiredHourlyRate: rate ? parseInt(rate) : null,
            availableFrom: availability || null,
            workloadPreference: desiredWorkload,
            // preferredWorkMode,
            // billing,
            companyName,
            originalCvUrl: cvPath,
            status: "new",
            // Other fields mapping...
        }).returning();

        // Link to Job
        if (jobId && newCandidate) {
            await db.insert(jobCandidates).values({
                jobId,
                candidateId: newCandidate.id,
                status: "proposed",
                notes: `Applied via Website. Billing: ${billing}`,
            });
        }

        const response = NextResponse.json({ success: true, message: "Application received" });

        // Add CORS headers
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

        return response;

    } catch (error) {
        console.error("Error processing application:", error);
        return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
    }
}

export async function OPTIONS() {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    return response;
}
