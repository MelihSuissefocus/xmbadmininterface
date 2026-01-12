"use server";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function getAllEmailTemplates() {
  return db.select().from(emailTemplates).orderBy(emailTemplates.name);
}

export async function getEmailTemplateById(id: string) {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  return template;
}

export async function createEmailTemplate(data: {
  name: string;
  subject: string;
  body: string;
  description?: string;
}): Promise<ActionResult> {
  try {
    const existing = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.name, data.name))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, message: "Vorlage mit diesem Namen existiert bereits" };
    }

    const [template] = await db
      .insert(emailTemplates)
      .values(data)
      .returning();

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Vorlage erfolgreich erstellt", data: template };
  } catch (error) {
    console.error("Error creating email template:", error);
    return { success: false, message: "Fehler beim Erstellen der Vorlage" };
  }
}

export async function updateEmailTemplate(
  id: string,
  data: {
    name?: string;
    subject?: string;
    body?: string;
    description?: string;
    isActive?: number;
  }
): Promise<ActionResult> {
  try {
    if (data.name) {
      const existing = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.name, data.name))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return { success: false, message: "Vorlage mit diesem Namen existiert bereits" };
      }
    }

    await db
      .update(emailTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id));

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Vorlage erfolgreich aktualisiert" };
  } catch (error) {
    console.error("Error updating email template:", error);
    return { success: false, message: "Fehler beim Aktualisieren der Vorlage" };
  }
}

export async function deleteEmailTemplate(id: string): Promise<ActionResult> {
  try {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));

    revalidatePath("/dashboard/settings");
    return { success: true, message: "Vorlage erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting email template:", error);
    return { success: false, message: "Fehler beim Löschen der Vorlage" };
  }
}

export async function toggleEmailTemplateActive(id: string): Promise<ActionResult> {
  try {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);

    if (!template) {
      return { success: false, message: "Vorlage nicht gefunden" };
    }

    const newStatus = template.isActive === 1 ? 0 : 1;

    await db
      .update(emailTemplates)
      .set({ isActive: newStatus, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id));

    revalidatePath("/dashboard/settings");
    return {
      success: true,
      message: newStatus === 1 ? "Vorlage aktiviert" : "Vorlage deaktiviert",
    };
  } catch (error) {
    console.error("Error toggling template:", error);
    return { success: false, message: "Fehler beim Ändern des Vorlagenstatus" };
  }
}

