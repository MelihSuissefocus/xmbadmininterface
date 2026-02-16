
import { NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, Job } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    const skills = [
        ...(job.requiredSkills ?? []),
        ...(job.niceToHaveSkills ?? []),
    ];

    let workMode: string = "onsite";
    if (job.remote) {
        const r = job.remote.toLowerCase();
        if (r === "remote" || r === "full remote") workMode = "remote";
        else if (r === "hybrid" || r === "flexibel") workMode = "hybrid";
    }

    const type = job.type === "contract" ? "freelancer" : "festanstellung";

    return {
        id: job.id,
        referenceNumber: job.referenceNumber,
        title: job.title,
        role: job.title,
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
        published: job.status === "published",
        publishedAt: job.publishedAt?.toISOString().split("T")[0] ?? "",
        contactPerson: job.contactPerson ?? "",
    };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const job = await db.query.jobs.findFirst({
            where: eq(jobs.id, id),
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        const response = NextResponse.json(transformJobForApi(job));

        // Add CORS headers
        response.headers.set("Access-Control-Allow-Origin", getCorsOrigin(request));
        response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

        return response;
    } catch (error) {
        console.error("Error fetching job:", error);
        return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
    }
}

export async function OPTIONS(request: Request) {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", getCorsOrigin(request));
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    return response;
}
