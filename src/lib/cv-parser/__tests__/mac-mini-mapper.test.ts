import { describe, it, expect } from "vitest";
import { mapMacMiniResponseToParsedCv } from "../mac-mini-mapper";
import type { MacMiniCvResponse } from "@/lib/cv-extraction/types";

function createMockResponse(overrides: Partial<MacMiniCvResponse> = {}): MacMiniCvResponse {
  return {
    vorname: "Max",
    nachname: "Müller",
    kernkompetenzen: ["JavaScript", "Python", "Docker"],
    sprachen: ["Deutsch (Muttersprache)", "English - C1", "Französisch: Grundkenntnisse"],
    erfahrungen: [
      {
        zeitraum: "01/2020 - heute",
        rolle: "Senior Software Engineer",
        projekt_id: "Swisscom AG",
        aufgaben: [
          "Entwicklung von Microservices mit Node.js",
          "Design von REST APIs",
        ],
        erfolge: ["Migration auf Kubernetes abgeschlossen"],
        herausforderungen_und_learnings: [],
        tools: ["Node.js", "Kubernetes", "AWS"],
      },
      {
        zeitraum: "03/2017 - 12/2019",
        rolle: "Software Developer",
        projekt_id: "UBS AG",
        aufgaben: ["Frontend-Entwicklung mit React"],
        erfolge: ["Performance-Optimierung um 40% verbessert"],
        herausforderungen_und_learnings: ["Agile Transformation"],
        tools: ["React", "TypeScript", "PostgreSQL"],
      },
    ],
    ausbildungen: [
      {
        abschluss: "BSc Informatik",
        institution: "ETH Zürich",
      },
    ],
    weiterbildungen: ["AWS Solutions Architect (2022)", "SCRUM Master - Scrum.org"],
    unklare_inhalte: null,
    ...overrides,
  };
}

// ── Test 1: Simple German CV ──────────────────────────────────────────

describe("mapMacMiniResponseToParsedCv", () => {
  it("maps a complete German CV correctly", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);

    expect(result.first_name).toBe("Max");
    expect(result.last_name).toBe("Müller");
    expect(result.status).toBe("Neu");
  });

  // ── Test 2: Skills normalization & deduplication ─────────────────────

  it("normalizes and deduplicates skills from kernkompetenzen + tools", () => {
    const data = createMockResponse({
      kernkompetenzen: ["JS", "Python", "Docker", "k8s"],
      erfahrungen: [
        {
          zeitraum: "2020 - heute",
          rolle: "Dev",
          projekt_id: "Firma",
          aufgaben: [],
          erfolge: [],
          herausforderungen_und_learnings: [],
          tools: ["JavaScript", "Node.js", "Kubernetes"],
        },
      ],
    });

    const result = mapMacMiniResponseToParsedCv(data);

    // JS -> JavaScript, k8s -> Kubernetes, should be deduplicated
    expect(result.skills).toContain("JavaScript");
    expect(result.skills).toContain("Python");
    expect(result.skills).toContain("Docker");
    expect(result.skills).toContain("Kubernetes");
    expect(result.skills).toContain("Node.js");
    // No duplicates
    const unique = new Set(result.skills.map(s => s.toLowerCase()));
    expect(unique.size).toBe(result.skills.length);
  });

  // ── Test 3: Language levels ──────────────────────────────────────────

  it("parses language entries with levels", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);

    expect(result.languages).toHaveLength(3);
    expect(result.languages[0]).toEqual({ language: "Deutsch", level: "Muttersprache" });
    expect(result.languages[1]).toEqual({ language: "Englisch", level: "C1" });
    expect(result.languages[2]).toEqual({ language: "Französisch", level: "A2" });
  });

  // ── Test 4: Date parsing from zeitraum ──────────────────────────────

  it("parses dates from zeitraum field", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);

    // First experience: "01/2020 - heute"
    expect(result.work_experience[0].startMonth).toBe("01");
    expect(result.work_experience[0].startYear).toBe("2020");
    expect(result.work_experience[0].current).toBe(true);
    expect(result.work_experience[0].endMonth).toBe("");
    expect(result.work_experience[0].endYear).toBe("");

    // Second experience: "03/2017 - 12/2019"
    expect(result.work_experience[1].startMonth).toBe("03");
    expect(result.work_experience[1].startYear).toBe("2017");
    expect(result.work_experience[1].endMonth).toBe("12");
    expect(result.work_experience[1].endYear).toBe("2019");
    expect(result.work_experience[1].current).toBe(false);
  });

  // ── Test 5: Multiple roles at same company ──────────────────────────

  it("handles multiple roles at same company", () => {
    const data = createMockResponse({
      erfahrungen: [
        {
          zeitraum: "01/2022 - heute",
          rolle: "Tech Lead",
          projekt_id: "Firma AG",
          aufgaben: ["Teamführung"],
          erfolge: [],
          herausforderungen_und_learnings: [],
          tools: [],
        },
        {
          zeitraum: "06/2019 - 12/2021",
          rolle: "Senior Developer",
          projekt_id: "Firma AG",
          aufgaben: ["Backend-Entwicklung"],
          erfolge: [],
          herausforderungen_und_learnings: [],
          tools: [],
        },
      ],
    });

    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.work_experience).toHaveLength(2);
    expect(result.work_experience[0].role).toBe("Tech Lead");
    expect(result.work_experience[0].company).toBe("Firma AG");
    expect(result.work_experience[1].role).toBe("Senior Developer");
    expect(result.work_experience[1].company).toBe("Firma AG");
  });

  // ── Test 6: Missing/incomplete dates ────────────────────────────────

  it("handles missing or incomplete dates", () => {
    const data = createMockResponse({
      erfahrungen: [
        {
          zeitraum: "2020",
          rolle: "Developer",
          projekt_id: "Some Company",
          aufgaben: [],
          erfolge: [],
          herausforderungen_und_learnings: [],
          tools: [],
        },
        {
          zeitraum: "",
          rolle: "Intern",
          projekt_id: "Another Company",
          aufgaben: [],
          erfolge: [],
          herausforderungen_und_learnings: [],
          tools: [],
        },
      ],
    });

    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.work_experience[0].startYear).toBe("2020");
    expect(result.work_experience[0].startMonth).toBe("");
    expect(result.work_experience[1].startYear).toBe("");
  });

  // ── Test 7: Skills in list form ─────────────────────────────────────

  it("handles skills from kernkompetenzen as list", () => {
    const data = createMockResponse({
      kernkompetenzen: ["React", "Vue.js", "Angular", "Node.js", "Express.js", "MongoDB", "PostgreSQL"],
      erfahrungen: [],
    });

    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.skills.length).toBeGreaterThanOrEqual(7);
    expect(result.skills).toContain("React");
    expect(result.skills).toContain("Vue.js");
    expect(result.skills).toContain("Angular");
    expect(result.skills).toContain("MongoDB");
    expect(result.skills).toContain("PostgreSQL");
  });

  // ── Test 8: CV without address (no crash) ───────────────────────────

  it("handles CV without address info", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);
    // Mac Mini API doesn't provide address data
    expect(result.street).toBe("");
    expect(result.postal_code).toBe("");
    expect(result.city).toBe("");
    expect(result.canton).toBe("");
  });

  // ── Test 9: CV without salary info ──────────────────────────────────

  it("does not hallucinate salary data", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.current_salary_chf).toBeNull();
    expect(result.expected_salary_chf).toBeNull();
    expect(result.desired_hourly_rate_chf).toBeNull();
  });

  // ── Test 10: Freelancer detection ───────────────────────────────────

  it("detects freelancer/contractor from role text", () => {
    const data = createMockResponse({
      erfahrungen: [
        {
          zeitraum: "2020 - heute",
          rolle: "Freelancer / IT Consultant",
          projekt_id: "Eigene Firma GmbH",
          aufgaben: ["Consulting"],
          erfolge: [],
          herausforderungen_und_learnings: [],
          tools: [],
        },
      ],
    });

    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.is_subcontractor).toBe(true);
  });

  // ── Test: Certifications from weiterbildungen ───────────────────────

  it("parses certifications from weiterbildungen", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);

    expect(result.certifications).toHaveLength(2);
    expect(result.certifications[0].name).toContain("AWS Solutions Architect");
    expect(result.certifications[0].year).toBe("2022");
    expect(result.certifications[1].name).toContain("SCRUM Master");
  });

  // ── Test: Years of experience calculation ───────────────────────────

  it("calculates years of experience from work entries", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);
    // 2017-03 to 2019-12 + 2020-01 to now (merged overlap check)
    expect(result.years_experience).toBeGreaterThanOrEqual(5);
  });

  // ── Test: Highlights from erfolge ───────────────────────────────────

  it("extracts highlights from erfolge", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);
    // "Performance-Optimierung um 40% verbessert" should be a highlight
    expect(result.highlights.length).toBeGreaterThanOrEqual(1);
  });

  // ── Test: Target position from most recent role ─────────────────────

  it("derives target position from most recent role", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.target_position).toBe("Senior Software Engineer");
  });

  // ── Test: Name cleaning (academic titles) ───────────────────────────

  it("removes academic titles from names", () => {
    const data = createMockResponse({
      vorname: "Dr. Max",
      nachname: "Müller",
    });
    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.first_name).toBe("Max");
    expect(result.last_name).toBe("Müller");
  });

  // ── Test: Internal notes always empty ───────────────────────────────

  it("never populates internal notes", () => {
    const data = createMockResponse();
    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.internal_notes).toBe("");
  });

  // ── Test: Empty/minimal CV doesn't crash ────────────────────────────

  it("handles empty/minimal CV data", () => {
    const data: MacMiniCvResponse = {
      vorname: "",
      nachname: "",
      kernkompetenzen: [],
      sprachen: [],
      erfahrungen: [],
      ausbildungen: [],
      weiterbildungen: [],
      unklare_inhalte: null,
    };

    const result = mapMacMiniResponseToParsedCv(data);
    expect(result.first_name).toBe("");
    expect(result.last_name).toBe("");
    expect(result.skills).toEqual([]);
    expect(result.languages).toEqual([]);
    expect(result.work_experience).toEqual([]);
    expect(result.education).toEqual([]);
    expect(result.certifications).toEqual([]);
    expect(result.status).toBe("Neu");
    expect(result.years_experience).toBe(0);
  });
});
