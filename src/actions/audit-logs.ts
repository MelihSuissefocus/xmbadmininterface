"use server";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function getAllAuditLogs(limit = 100) {
  return db
    .select({
      log: auditLogs,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function createAuditLog(data: {
  userId?: string;
  action: "create" | "update" | "delete" | "login" | "logout" | "password_reset";
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(auditLogs).values(data);
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
}

