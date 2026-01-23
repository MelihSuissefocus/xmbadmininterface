"use server";

import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface CreatePasswordResetResult {
  success: boolean;
  message: string;
  data?: {
    token: string;
    email: string | null;
    name: string | null;
  };
}

export async function createPasswordResetToken(email: string): Promise<CreatePasswordResetResult> {
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return { success: false, message: "Benutzer nicht gefunden" };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    return { 
      success: true, 
      message: "Reset-Token erstellt",
      data: { token, email: user.email, name: user.name }
    };
  } catch (error) {
    console.error("Error creating reset token:", error);
    return { success: false, message: "Fehler beim Erstellen des Reset-Tokens" };
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<ActionResult> {
  try {
    if (newPassword.length < 6) {
      return { success: false, message: "Passwort muss mindestens 6 Zeichen lang sein" };
    }

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    if (!resetToken) {
      return { success: false, message: "Ungültiger Token" };
    }

    if (resetToken.usedAt) {
      return { success: false, message: "Token wurde bereits verwendet" };
    }

    if (new Date() > resetToken.expiresAt) {
      return { success: false, message: "Token ist abgelaufen" };
    }

    const hashedPassword = await hash(newPassword, 10);

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return { success: true, message: "Passwort erfolgreich zurückgesetzt" };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { success: false, message: "Fehler beim Zurücksetzen des Passworts" };
  }
}

export async function getResetTokenInfo(token: string) {
  const [resetToken] = await db
    .select({
      token: passwordResetTokens,
      user: users,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  return resetToken;
}

