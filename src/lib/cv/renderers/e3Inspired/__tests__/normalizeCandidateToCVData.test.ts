import { describe, it, expect } from "vitest";
import { normalizeCandidateToCVData } from "../normalizeCandidateToCVData";
import type { Candidate } from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal candidate stub (only required fields)
// ─────────────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    firstName: "Anna",
    lastName: "Müller",
    email: null,
    phone: null,
    street: null,
    postalCode: null,
    city: null,
    canton: null,
    birthdate: null,
    linkedinUrl: null,
    targetRole: null,
    yearsOfExperience: null,
    currentSalary: null,
    expectedSalary: null,
    availableFrom: null,
    workloadPreference: null,
    noticePeriod: null,
    desiredHourlyRate: null,
    isSubcontractor: 0,
    companyName: null,
    companyType: null,
    skills: null,
    certificates: null,
    languages: null,
    education: null,
    experience: null,
    highlights: null,
    originalCvUrl: null,
    brandedCvUrl: null,
    parsedData: null,
    notes: null,
    status: "new",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeCandidateToCVData", () => {
  it("maps minimal candidate to CVData with empty arrays", () => {
    const cv = normalizeCandidateToCVData(makeCandidate(), "customer");
    expect(cv.variant).toBe("external");
    expect(cv.personal.firstName).toBe("Anna");
    expect(cv.personal.lastName).toBe("Müller");
    expect(cv.languages).toEqual([]);
    expect(cv.skills).toEqual([]);
    expect(cv.highlights).toEqual([]);
    expect(cv.education).toEqual([]);
    expect(cv.certificates).toEqual([]);
    expect(cv.experience).toEqual([]);
  });

  it("maps variant correctly: customer → external, internal → internal", () => {
    expect(normalizeCandidateToCVData(makeCandidate(), "customer").variant).toBe("external");
    expect(normalizeCandidateToCVData(makeCandidate(), "internal").variant).toBe("internal");
  });

  it("maps personal fields including contact info", () => {
    const cv = normalizeCandidateToCVData(
      makeCandidate({
        targetRole: "Lead Developer",
        email: "anna@example.com",
        phone: "+41 79 000 00 00",
        city: "Bern",
      }),
      "internal",
    );
    expect(cv.personal.targetRole).toBe("Lead Developer");
    expect(cv.personal.email).toBe("anna@example.com");
    expect(cv.personal.phone).toBe("+41 79 000 00 00");
    expect(cv.personal.city).toBe("Bern");
  });

  it("maps education with period labels", () => {
    const cv = normalizeCandidateToCVData(
      makeCandidate({
        education: [
          {
            degree: "MSc Informatik",
            institution: "ETH Zürich",
            startMonth: "09",
            startYear: "2015",
            endMonth: "06",
            endYear: "2018",
          },
        ],
      }),
      "customer",
    );
    expect(cv.education).toHaveLength(1);
    expect(cv.education[0].periodLabel).toBe("09/2015 – 06/2018");
    expect(cv.education[0].title).toBe("MSc Informatik");
    expect(cv.education[0].institution).toBe("ETH Zürich");
  });

  it("maps experience with current flag using 'seit'", () => {
    const cv = normalizeCandidateToCVData(
      makeCandidate({
        experience: [
          {
            role: "CTO",
            company: "StartupXY",
            startMonth: "01",
            startYear: "2023",
            endMonth: "",
            endYear: "",
            current: true,
            description: "Line one\nLine two\n\nLine three",
          },
        ],
      }),
      "internal",
    );
    expect(cv.experience).toHaveLength(1);
    expect(cv.experience[0].periodLabel).toBe("seit 01/2023");
    expect(cv.experience[0].titleLine).toBe("CTO – StartupXY");
    expect(cv.experience[0].descriptionLines).toEqual([
      "Line one",
      "Line two",
      "Line three",
    ]);
  });

  it("maps skills, languages, highlights, certificates", () => {
    const cv = normalizeCandidateToCVData(
      makeCandidate({
        skills: ["Java", "Kotlin"],
        languages: [{ language: "Deutsch", level: "C2" }],
        highlights: ["10 Jahre Erfahrung"],
        certificates: [{ name: "AWS SAP", issuer: "Amazon", date: "2023" }],
      }),
      "customer",
    );
    expect(cv.skills).toEqual(["Java", "Kotlin"]);
    expect(cv.languages).toEqual([{ language: "Deutsch", level: "C2" }]);
    expect(cv.highlights).toEqual(["10 Jahre Erfahrung"]);
    expect(cv.certificates).toEqual([{ name: "AWS SAP", issuer: "Amazon", date: "2023" }]);
  });
});
