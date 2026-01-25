"use server";

import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { AuthError } from "next-auth";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Minuten

interface LoginResult {
  success: boolean;
  message: string;
  locked?: boolean;
  remainingAttempts?: number;
}

export async function loginAction(
  email: string,
  password: string,
  captchaAnswer: number,
  expectedAnswer: number
): Promise<LoginResult> {
  if (captchaAnswer !== expectedAnswer) {
    return { success: false, message: "Falscher Sicherheitscode" };
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = result[0];

  if (!user) {
    return { success: false, message: "Ungültige Anmeldedaten" };
  }

  if (user.isActive === 0) {
    return {
      success: false,
      message: "Dieses Konto wurde deaktiviert. Kontaktiere einen Administrator.",
      locked: true,
    };
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return {
      success: false,
      message: `Konto gesperrt. Versuche es in ${remainingMin} Minuten erneut.`,
      locked: true,
    };
  }

  const passwordsMatch = await compare(password, user.password);

  if (!passwordsMatch) {
    const newAttempts = (user.failedAttempts ?? 0) + 1;

    if (newAttempts >= MAX_ATTEMPTS) {
      await db
        .update(users)
        .set({
          failedAttempts: newAttempts,
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        })
        .where(eq(users.id, user.id));

      return {
        success: false,
        message: "Zu viele Fehlversuche. Konto für 15 Minuten gesperrt.",
        locked: true,
      };
    }

    await db
      .update(users)
      .set({ failedAttempts: newAttempts })
      .where(eq(users.id, user.id));

    return {
      success: false,
      message: "Ungültige Anmeldedaten",
      remainingAttempts: MAX_ATTEMPTS - newAttempts,
    };
  }

  await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return { success: true, message: "Erfolgreich angemeldet" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, message: "Authentifizierungsfehler" };
    }
    throw error;
  }
}

