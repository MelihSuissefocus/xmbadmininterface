"use server";

import { db } from "@/db";
import { jobs, jobCandidates, candidates, NewJob } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function createJob(data: NewJob): Promise<ActionResult> {
  try {
    // Auto-generate reference number if not provided
    if (!data.referenceNumber) {
      const year = new Date().getFullYear();
      const random = Math.floor(1000 + Math.random() * 9000); // 4 digit random
      data.referenceNumber = `XMB-${year}-${random}`;
    }

    const [job] = await db.insert(jobs).values(data).returning();
    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard");
    return { success: true, message: "Stelle erfolgreich erstellt", data: job };
  } catch (error) {
    console.error("Error creating job:", error);
    return { success: false, message: "Fehler beim Erstellen der Stelle" };
  }
}

export async function updateJob(id: string, data: Partial<NewJob>): Promise<ActionResult> {
  try {
    const updateData = { ...data, updatedAt: new Date() };

    if (data.status === "published" && !data.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const [job] = await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();
    revalidatePath("/dashboard/jobs");
    revalidatePath(`/dashboard/jobs/${id}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Stelle erfolgreich aktualisiert", data: job };
  } catch (error) {
    console.error("Error updating job:", error);
    return { success: false, message: "Fehler beim Aktualisieren der Stelle" };
  }
}

export async function deleteJob(id: string): Promise<ActionResult> {
  try {
    await db.delete(jobs).where(eq(jobs.id, id));
    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard");
    return { success: true, message: "Stelle erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting job:", error);
    return { success: false, message: "Fehler beim Löschen der Stelle" };
  }
}

export async function getJobById(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return job;
}

export async function getAllJobs() {
  return db.select().from(jobs).orderBy(jobs.createdAt);
}

export async function getJobWithCandidates(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) return null;

  const assignments = await db
    .select({
      assignment: jobCandidates,
      candidate: candidates,
    })
    .from(jobCandidates)
    .innerJoin(candidates, eq(jobCandidates.candidateId, candidates.id))
    .where(eq(jobCandidates.jobId, id));

  return { job, assignments };
}

export async function assignCandidateToJob(
  jobId: string,
  candidateId: string,
  notes?: string
): Promise<ActionResult> {
  try {
    const existing = await db
      .select()
      .from(jobCandidates)
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.candidateId, candidateId)))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, message: "Kandidat ist bereits dieser Stelle zugewiesen" };
    }

    await db.insert(jobCandidates).values({
      jobId,
      candidateId,
      notes,
      status: "proposed",
    });

    revalidatePath(`/dashboard/jobs/${jobId}`);
    return { success: true, message: "Kandidat erfolgreich zugewiesen" };
  } catch (error) {
    console.error("Error assigning candidate:", error);
    return { success: false, message: "Fehler beim Zuweisen des Kandidaten" };
  }
}

export async function updateAssignmentStatus(
  jobId: string,
  candidateId: string,
  status: "proposed" | "interviewing" | "offered" | "rejected" | "placed",
  notes?: string
): Promise<ActionResult> {
  try {
    await db
      .update(jobCandidates)
      .set({ status, notes, updatedAt: new Date() })
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.candidateId, candidateId)));

    revalidatePath(`/dashboard/jobs/${jobId}`);
    return { success: true, message: "Status erfolgreich aktualisiert" };
  } catch (error) {
    console.error("Error updating assignment:", error);
    return { success: false, message: "Fehler beim Aktualisieren des Status" };
  }
}

export async function removeAssignment(jobId: string, candidateId: string): Promise<ActionResult> {
  try {
    await db
      .delete(jobCandidates)
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.candidateId, candidateId)));

    revalidatePath(`/dashboard/jobs/${jobId}`);
    return { success: true, message: "Zuweisung erfolgreich entfernt" };
  } catch (error) {
    console.error("Error removing assignment:", error);
    return { success: false, message: "Fehler beim Entfernen der Zuweisung" };
  }
}

export async function getAvailableCandidatesForJob(jobId: string) {
  const assignedIds = await db
    .select({ candidateId: jobCandidates.candidateId })
    .from(jobCandidates)
    .where(eq(jobCandidates.jobId, jobId));

  const assignedSet = new Set(assignedIds.map((a) => a.candidateId));

  const allCandidates = await db.select().from(candidates);
  return allCandidates.filter((c) => !assignedSet.has(c.id));
}

