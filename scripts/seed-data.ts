import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { jobs, candidates } from "../src/db/schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const run = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const sampleJobs = [
    {
      title: "Senior React Developer",
      type: "permanent" as const,
      description: "Entwicklung moderner Web-Applikationen mit React und TypeScript",
      workload: "80-100%",
      location: "Zürich",
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      title: "DevOps Engineer",
      type: "contract" as const,
      description: "CI/CD Pipeline Optimierung und Cloud Infrastructure",
      workload: "100%",
      location: "Bern",
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      title: "Java Backend Developer",
      type: "permanent" as const,
      description: "Microservices Entwicklung mit Spring Boot",
      workload: "100%",
      location: "Basel",
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      title: "Cloud Architect",
      type: "contract" as const,
      description: "AWS/Azure Infrastruktur Design und Implementation",
      workload: "80-100%",
      location: "Zürich",
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      title: "Scrum Master",
      type: "permanent" as const,
      description: "Agile Projektleitung für IT-Teams",
      workload: "100%",
      location: "Winterthur",
      status: "draft" as const,
    },
  ];

  const sampleCandidates = [
    {
      firstName: "Max",
      lastName: "Mustermann",
      email: "max.mustermann@email.ch",
      phone: "+41 79 123 45 67",
      status: "new" as const,
      parsedData: { skills: ["React", "TypeScript", "Node.js"], experience: "5 Jahre" },
    },
    {
      firstName: "Anna",
      lastName: "Schmidt",
      email: "anna.schmidt@email.ch",
      phone: "+41 78 234 56 78",
      status: "reviewed" as const,
      parsedData: { skills: ["Java", "Spring Boot", "PostgreSQL"], experience: "8 Jahre" },
    },
    {
      firstName: "Thomas",
      lastName: "Weber",
      email: "thomas.weber@email.ch",
      phone: "+41 76 345 67 89",
      status: "new" as const,
      parsedData: { skills: ["Python", "Django", "AWS"], experience: "3 Jahre" },
    },
    {
      firstName: "Sarah",
      lastName: "Müller",
      email: "sarah.mueller@email.ch",
      phone: "+41 79 456 78 90",
      status: "placed" as const,
      parsedData: { skills: ["DevOps", "Kubernetes", "Terraform"], experience: "6 Jahre" },
    },
    {
      firstName: "Michael",
      lastName: "Keller",
      email: "michael.keller@email.ch",
      phone: "+41 78 567 89 01",
      status: "new" as const,
      parsedData: { skills: ["Angular", "C#", ".NET"], experience: "4 Jahre" },
    },
    {
      firstName: "Laura",
      lastName: "Brunner",
      email: "laura.brunner@email.ch",
      phone: "+41 76 678 90 12",
      status: "reviewed" as const,
      parsedData: { skills: ["Vue.js", "PHP", "Laravel"], experience: "7 Jahre" },
    },
  ];

  try {
    console.log("🌱 Seeding jobs...");
    await db.insert(jobs).values(sampleJobs);
    console.log("✅ Jobs created");

    console.log("🌱 Seeding candidates...");
    await db.insert(candidates).values(sampleCandidates);
    console.log("✅ Candidates created");

    console.log("🎉 Seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding:", error);
  }
};

run();

