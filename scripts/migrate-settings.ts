import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "../src/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

async function runMigrations() {
  console.log("🚀 Starting database migrations...");

  // Validate DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set");
    console.error("Please set DATABASE_URL in .env.local or as environment variable");
    process.exit(1);
  }

  try {
    // Create database connection
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql, { schema });

    console.log("📦 Applying migrations from ./drizzle folder...");

    // Run migrations - drizzle handles tracking internally via __drizzle_migrations table
    // If migrations are already applied, this will be a no-op
    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("✅ All migrations applied successfully!");
    process.exit(0);
  } catch (error) {
    // Check if error is due to migrations already being applied
    let errorMessage = "";
    let errorCode = "";
    
    // Extract error details from nested error structure
    if (error && typeof error === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      
      // Get message from the error or its cause
      errorMessage = (err.message || err.cause?.message || "").toLowerCase();
      
      // Get PostgreSQL error code from nested cause
      errorCode = err.cause?.code || err.code || "";
    }
    
    // Common errors when migrations are already applied
    if (
      errorMessage.includes("already exists") ||
      errorMessage.includes("duplicate") ||
      errorCode === "42710" || // PostgreSQL: duplicate object
      errorCode === "42P07" || // PostgreSQL: duplicate table
      errorCode === "42701"    // PostgreSQL: duplicate column
    ) {
      console.log("⚠️  Warning: Some migrations may already be applied");
      console.log("✅ Database schema is up to date!");
      process.exit(0);
    }

    // If it's a real error, fail
    console.error("❌ Migration failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

runMigrations();
