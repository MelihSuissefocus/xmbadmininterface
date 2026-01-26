import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/db/schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const run = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const newPassword = "Xmb@Secure2026!";
  const hashedPassword = await hash(newPassword, 10);

  try {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.email, "admin@xmb-group.ch"));

    console.log("✅ Admin password reset successfully");
    console.log(`📧 Email: admin@xmb-group.ch`);
    console.log(`🔑 New Password: ${newPassword}`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
};

run();


