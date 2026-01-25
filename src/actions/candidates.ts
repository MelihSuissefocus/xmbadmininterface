"use server";

import { db } from "@/db";
import { candidates, NewCandidate } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function createCandidate(data: NewCandidate): Promise<ActionResult> {
  try {
    const [candidate] = await db.insert(candidates).values(data).returning();
    revalidatePath("/dashboard/candidates");
    revalidatePath("/dashboard");
    return { success: true, message: "Kandidat erfolgreich erstellt", data: candidate };
  } catch (error) {
    console.error("Error creating candidate:", error);
    return { success: false, message: "Fehler beim Erstellen des Kandidaten" };
  }
}

export async function updateCandidate(
  id: string,
  data: Partial<NewCandidate>
): Promise<ActionResult> {
  try {
    const [candidate] = await db
      .update(candidates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candidates.id, id))
      .returning();
    revalidatePath("/dashboard/candidates");
    revalidatePath(`/dashboard/candidates/${id}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Kandidat erfolgreich aktualisiert", data: candidate };
  } catch (error) {
    console.error("Error updating candidate:", error);
    return { success: false, message: "Fehler beim Aktualisieren des Kandidaten" };
  }
}

export async function deleteCandidate(id: string): Promise<ActionResult> {
  try {
    await db.delete(candidates).where(eq(candidates.id, id));
    revalidatePath("/dashboard/candidates");
    revalidatePath("/dashboard");
    return { success: true, message: "Kandidat erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting candidate:", error);
    return { success: false, message: "Fehler beim Löschen des Kandidaten" };
  }
}

export async function getCandidateById(id: string) {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, id))
    .limit(1);
  return candidate;
}

export async function getAllCandidates() {
  return db.select().from(candidates).orderBy(candidates.createdAt);
}

