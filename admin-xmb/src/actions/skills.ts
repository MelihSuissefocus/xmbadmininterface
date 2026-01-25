"use server";

import { db } from "@/db";
import { skills, NewSkill } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function createSkill(data: NewSkill): Promise<ActionResult> {
  try {
    const [skill] = await db.insert(skills).values(data).returning();
    revalidatePath("/dashboard/settings");
    return { success: true, message: "Skill erfolgreich erstellt", data: skill };
  } catch (error) {
    console.error("Error creating skill:", error);
    return { success: false, message: "Fehler beim Erstellen des Skills" };
  }
}

export async function deleteSkill(id: string): Promise<ActionResult> {
  try {
    await db.delete(skills).where(eq(skills.id, id));
    revalidatePath("/dashboard/settings");
    return { success: true, message: "Skill erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting skill:", error);
    return { success: false, message: "Fehler beim Löschen des Skills" };
  }
}

export async function getAllSkills() {
  return db.select().from(skills).orderBy(skills.name);
}

