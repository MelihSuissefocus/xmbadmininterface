
import { NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, Job } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = [
    "https://www.xmb-group.ch",
    "https://xmb-group.ch",
];

function getCorsOrigin(request: Request): string {
    const origin = request.headers.get("origin") ?? "";
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

function transformJobForApi(job: Job) {
    // Build requirements array from requirementsList, or from requiredSkills/niceToHaveSkills
    let requirements: { text: string; type: "must" | "nice" }[] = [];
    if (job.requirementsList && job.requirementsList.length > 0) {
        requirements = job.requirementsList;
    } else {
        if (job.requiredSkills) {
            requirements.push(...job.requiredSkills.map((s) => ({ text: s, type: "must" as const })));
        }
        if (job.niceToHaveSkills) {
            requirements.push(...job.niceToHaveSkills.map((s) => ({ text: s, type: "nice" as const })));
        }
    }

    // Combine skills
    const skills = [
        ...(job.requiredSkills ?? []),
        ...(job.niceToHaveSkills ?? []),
    ];

    // Map workMode
    let workMode: string = "onsite";
    if (job.remote) {
        const r = job.remote.toLowerCase();
        if (r === "remote" || r === "full remote") workMode = "remote";
        else if (r === "hybrid" || r === "flexibel") workMode = "hybrid";
    }

    // Map type
    const type = job.type === "contract" ? "freelancer" : "festanstellung";

    return {
        id: job.id,
        referenceNumber: job.referenceNumber,
        title: job.title,
        role: job.title, // use title as role since no separate role field
        description: job.description ?? "",
        requirements,
        location: job.location ?? "",
        workMode,
        workload: job.workload ?? "",
        type,
        startDate: job.startDate ?? "",
        endDate: job.endDate ?? "",
        industry: job.industry ?? "",
        skills,
        language: job.languages ?? [],
        published: true,
        publishedAt: job.publishedAt?.toISOString().split("T")[0] ?? "",
        contactPerson: job.contactPerson ?? "",
    };
}

export async function GET(request: Request) {
    try {
        const publishedJobs = await db.select().from(jobs).where(eq(jobs.status, "published")).orderBy(desc(jobs.publishedAt));

        const transformed = publishedJobs.map(transformJobForApi);
        const response = NextResponse.json(transformed);

        // Add CORS headers
        response.headers.set("Access-Control-Allow-Origin", getCorsOrigin(request));
        response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

        return response;
    } catch (error) {
        console.error("Error fetching jobs:", error);
        return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }
}

export async function OPTIONS(request: Request) {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", getCorsOrigin(request));
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    return response;
}
