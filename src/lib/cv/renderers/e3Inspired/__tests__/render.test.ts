import { describe, it, expect } from "vitest";
import { renderToPdfBuffer } from "../renderToPdfBuffer";
import type { CVData } from "../types";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const candidateMinimal: CVData = {
  variant: "external",
  personal: {
    firstName: "Anna",
    lastName: "Müller",
  },
  languages: [],
  skills: [],
  highlights: [],
  education: [],
  certificates: [],
  experience: [],
};

const candidateFull: CVData = {
  variant: "internal",
  personal: {
    firstName: "Max",
    lastName: "Mustermann",
    targetRole: "Senior IT Consultant",
    email: "max.mustermann@example.com",
    phone: "+41 79 123 45 67",
    city: "Zürich",
  },
  languages: [
    { language: "Deutsch", level: "Muttersprache" },
    { language: "Englisch", level: "C1" },
    { language: "Französisch", level: "B2" },
  ],
  skills: [
    "Java",
    "Spring Boot",
    "Kubernetes",
    "AWS",
    "Terraform",
    "CI/CD",
    "PostgreSQL",
    "Docker",
    "React",
    "TypeScript",
  ],
  highlights: [
    "Über 12 Jahre Erfahrung in der Konzeption und Umsetzung komplexer IT-Lösungen",
    "Zertifizierter AWS Solutions Architect und Kubernetes-Spezialist",
    "Starke Führungskompetenz – Leitung von Teams bis 15 Personen",
  ],
  education: [
    {
      periodLabel: "2008 – 2012",
      title: "MSc Informatik",
      institution: "ETH Zürich",
    },
    {
      periodLabel: "2004 – 2008",
      title: "BSc Wirtschaftsinformatik",
      institution: "Universität Bern",
    },
  ],
  certificates: [
    { name: "AWS Solutions Architect – Professional", issuer: "Amazon", date: "2023" },
    { name: "Certified Kubernetes Administrator (CKA)", issuer: "CNCF", date: "2022" },
    { name: "ITIL 4 Foundation", issuer: "Axelos", date: "2020" },
  ],
  experience: [
    {
      periodLabel: "01/2022 – 06/2024",
      titleLine: "Lead Cloud Architect – FinCorp AG, Zürich",
      descriptionLines: [
        "Migration der On-Premise-Infrastruktur auf AWS (50+ Microservices)",
        "Aufbau und Betrieb von Kubernetes-Clustern (EKS) für hochverfügbare Dienste",
        "Einführung von Infrastructure as Code mit Terraform und GitOps",
        "Technische Leitung eines Teams von 8 Engineers",
      ],
      idNo: "P-2024-0042",
    },
    {
      periodLabel: "03/2019 – 12/2021",
      titleLine: "Senior Backend Developer – MedTech Solutions, Basel",
      descriptionLines: [
        "Entwicklung eines FHIR-konformen Datenaustausch-Gateways in Java/Spring Boot",
        "Performance-Optimierung – Reduktion der Antwortzeiten um 60 %",
        "Implementierung von CI/CD-Pipelines mit Jenkins und ArgoCD",
      ],
      idNo: "P-2021-0198",
    },
    {
      periodLabel: "07/2015 – 02/2019",
      titleLine: "IT Consultant – Consulting Group, Bern",
      descriptionLines: [
        "Beratung und Umsetzung von Digitalisierungsprojekten im Bankensektor",
        "Entwicklung von RESTful APIs und Event-Driven Architectures",
        "Durchführung von Workshops und Schulungen für Kundenteams",
      ],
    },
    {
      periodLabel: "09/2012 – 06/2015",
      titleLine: "Software Engineer – StartupXY, Zürich",
      descriptionLines: [
        "Full-Stack-Entwicklung einer SaaS-Plattform (React, Node.js, PostgreSQL)",
        "Einführung automatisierter Tests (Unit, Integration, E2E)",
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract text from PDF buffer using pdf-parse
// ─────────────────────────────────────────────────────────────────────────────

async function extractText(buf: Buffer): Promise<string> {
  const result = await pdfParse(buf);
  return result.text as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("e3Inspired PDF renderer", () => {
  it("renders candidate-minimal to a non-empty PDF buffer", async () => {
    const buf = await renderToPdfBuffer(candidateMinimal);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // PDF magic bytes: %PDF
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  }, 30_000);

  it("renders candidate-full to a non-empty PDF buffer", async () => {
    const buf = await renderToPdfBuffer(candidateFull);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  }, 30_000);

  it("candidate-full PDF contains all section texts", async () => {
    const buf = await renderToPdfBuffer(candidateFull);
    const text = await extractText(buf);

    // Personal
    expect(text).toContain("Max");
    expect(text).toContain("Mustermann");

    // Section headers (rendered uppercase via textTransform)
    expect(text).toContain("SPRACHEN");
    expect(text).toContain("KOMPETENZEN");
    expect(text).toContain("HIGHLIGHTS");
    expect(text).toContain("AUSBILDUNG");
    expect(text).toContain("ZERTIFIKATE");
    expect(text).toContain("RELEVANTE ARBEITSERFAHRUNG");
  }, 30_000);

  it("candidate-full PDF is larger than minimal", async () => {
    const bufMin = await renderToPdfBuffer(candidateMinimal);
    const bufFull = await renderToPdfBuffer(candidateFull);
    expect(bufFull.length).toBeGreaterThan(bufMin.length);
  }, 30_000);

  it("external variant omits contact details from rendered text", async () => {
    const externalData: CVData = {
      ...candidateFull,
      variant: "external",
    };
    const buf = await renderToPdfBuffer(externalData);
    const text = await extractText(buf);

    // Name should still be present
    expect(text).toContain("Max");
    expect(text).toContain("Mustermann");
    // Contact details should NOT appear in external variant
    expect(text).not.toContain("max.mustermann@example.com");
    expect(text).not.toContain("+41 79 123 45 67");
  }, 30_000);
});
