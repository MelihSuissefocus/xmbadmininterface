"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function getAllUsers() {
  return db.select().from(users).orderBy(users.createdAt);
}

export async function getUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "recruiter" | "viewer";
}): Promise<ActionResult> {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, message: "E-Mail existiert bereits" };
    }

    const hashedPassword = await hash(data.password, 10);

    const [user] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        isActive: 1,
      })
      .returning();

    revalidatePath("/dashboard/users");
    return { success: true, message: "Benutzer erfolgreich erstellt", data: user };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, message: "Fehler beim Erstellen des Benutzers" };
  }
}

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; role?: "admin" | "recruiter" | "viewer" }
): Promise<ActionResult> {
  try {
    if (data.email) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return { success: false, message: "E-Mail wird bereits verwendet" };
      }
    }

    await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id));

    revalidatePath("/dashboard/users");
    return { success: true, message: "Benutzer erfolgreich aktualisiert" };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, message: "Fehler beim Aktualisieren des Benutzers" };
  }
}

export async function changePassword(
  id: string,
  newPassword: string
): Promise<ActionResult> {
  try {
    if (newPassword.length < 6) {
      return { success: false, message: "Passwort muss mindestens 6 Zeichen lang sein" };
    }

    const hashedPassword = await hash(newPassword, 10);

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id));

    revalidatePath("/dashboard/users");
    return { success: true, message: "Passwort erfolgreich geändert" };
  } catch (error) {
    console.error("Error changing password:", error);
    return { success: false, message: "Fehler beim Ändern des Passworts" };
  }
}

export async function resetPassword(id: string): Promise<ActionResult> {
  try {
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hash(tempPassword, 10);

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id));

    revalidatePath("/dashboard/users");
    return {
      success: true,
      message: `Passwort zurückgesetzt. Neues Passwort: ${tempPassword}`,
      data: { tempPassword },
    };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { success: false, message: "Fehler beim Zurücksetzen des Passworts" };
  }
}

export async function toggleUserActive(id: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (session?.user?.id === id) {
      return { success: false, message: "Du kannst dich nicht selbst deaktivieren" };
    }

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      return { success: false, message: "Benutzer nicht gefunden" };
    }

    const newStatus = user.isActive === 1 ? 0 : 1;

    await db
      .update(users)
      .set({
        isActive: newStatus,
        lockedUntil: newStatus === 0 ? null : user.lockedUntil,
        failedAttempts: newStatus === 1 ? 0 : user.failedAttempts,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    revalidatePath("/dashboard/users");
    return {
      success: true,
      message: newStatus === 1 ? "Benutzer aktiviert" : "Benutzer deaktiviert",
    };
  } catch (error) {
    console.error("Error toggling user:", error);
    return { success: false, message: "Fehler beim Ändern des Benutzerstatus" };
  }
}

export async function unlockUser(id: string): Promise<ActionResult> {
  try {
    await db
      .update(users)
      .set({
        lockedUntil: null,
        failedAttempts: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    revalidatePath("/dashboard/users");
    return { success: true, message: "Benutzer entsperrt" };
  } catch (error) {
    console.error("Error unlocking user:", error);
    return { success: false, message: "Fehler beim Entsperren des Benutzers" };
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (session?.user?.id === id) {
      return { success: false, message: "Du kannst dich nicht selbst löschen" };
    }

    await db.delete(users).where(eq(users.id, id));

    revalidatePath("/dashboard/users");
    return { success: true, message: "Benutzer erfolgreich gelöscht" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, message: "Fehler beim Löschen des Benutzers" };
  }
}

