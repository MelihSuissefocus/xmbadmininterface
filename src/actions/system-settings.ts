"use server";

import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function getAllSystemSettings() {
  return db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.key);
}

export async function getSystemSettingByKey(key: string) {
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return setting;
}

export async function upsertSystemSetting(data: {
  key: string;
  value: string;
  description?: string;
  category: string;
}): Promise<ActionResult> {
  try {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, data.key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemSettings)
        .set({ value: data.value, description: data.description, updatedAt: new Date() })
        .where(eq(systemSettings.key, data.key));
    } else {
      await db.insert(systemSettings).values(data);
    }

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Einstellung erfolgreich gespeichert" };
  } catch (error) {
    console.error("Error upserting system setting:", error);
    return { success: false, message: "Fehler beim Speichern der Einstellung" };
  }
}

export async function deleteSystemSetting(id: string): Promise<ActionResult> {
  try {
    await db.delete(systemSettings).where(eq(systemSettings.id, id));

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Einstellung erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting system setting:", error);
    return { success: false, message: "Fehler beim Löschen der Einstellung" };
  }
}

