"use server";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function getOrganization() {
  const [org] = await db.select().from(organizations).limit(1);
  return org;
}

export async function upsertOrganization(data: {
  name: string;
  logo?: string;
  email?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  website?: string;
  primaryColor?: string;
  secondaryColor?: string;
}): Promise<ActionResult> {
  try {
    const existing = await db.select().from(organizations).limit(1);

    if (existing.length > 0) {
      await db
        .update(organizations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(organizations.id, existing[0].id));
    } else {
      await db.insert(organizations).values(data);
    }

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Unternehmenseinstellungen erfolgreich gespeichert" };
  } catch (error) {
    console.error("Error upserting organization:", error);
    return { success: false, message: "Fehler beim Speichern der Einstellungen" };
  }
}

