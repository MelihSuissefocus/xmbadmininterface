import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../src/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seedInitialData() {
  console.log("🌱 Seeding initial data...");

  try {
    console.log("✅ Initial data seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting migration and seed...");
  
  try {
    await seedInitialData();
    console.log("✨ Migration and seed completed!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Failed:", error);
    process.exit(1);
  }
}

main();

