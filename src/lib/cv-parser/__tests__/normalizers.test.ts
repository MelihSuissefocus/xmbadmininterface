import { describe, it, expect } from "vitest";
import {
  parseDate,
  parsePeriod,
  calculateYearsOfExperience,
  normalizeSkill,
  normalizeAndDeduplicateSkills,
  normalizeLanguageLevel,
  normalizeLanguageName,
  parseLanguageEntry,
  detectSubcontractor,
  cleanNameFromTitles,
  normalizePhone,
  parseAddress,
  normalizeAvailableFrom,
  parseCertificate,
  filterHighlights,
} from "../normalizers";

// ============================================================================
// DATE PARSING
// ============================================================================

describe("parseDate", () => {
  it("parses MM.YYYY format", () => {
    expect(parseDate("01.2020")).toEqual({ month: 1, year: 2020 });
    expect(parseDate("12.2023")).toEqual({ month: 12, year: 2023 });
  });

  it("parses MM/YYYY format", () => {
    expect(parseDate("03/2021")).toEqual({ month: 3, year: 2021 });
  });

  it("parses YYYY-MM format", () => {
    expect(parseDate("2021-03")).toEqual({ month: 3, year: 2021 });
  });

  it("parses DD.MM.YYYY format", () => {
    expect(parseDate("15.06.2020")).toEqual({ month: 6, year: 2020 });
  });

  it("parses Month YYYY (German)", () => {
    expect(parseDate("Januar 2023")).toEqual({ month: 1, year: 2023 });
    expect(parseDate("März 2020")).toEqual({ month: 3, year: 2020 });
    expect(parseDate("Dez 2019")).toEqual({ month: 12, year: 2019 });
  });

  it("parses Month YYYY (English)", () => {
    expect(parseDate("Jan 2023")).toEqual({ month: 1, year: 2023 });
    expect(parseDate("March 2020")).toEqual({ month: 3, year: 2020 });
    expect(parseDate("December 2019")).toEqual({ month: 12, year: 2019 });
  });

  it("parses just YYYY", () => {
    expect(parseDate("2021")).toEqual({ month: null, year: 2021 });
  });

  it("parses 'seit YYYY'", () => {
    expect(parseDate("seit 2022")).toEqual({ month: null, year: 2022 });
  });

  it("parses 'seit MM/YYYY'", () => {
    expect(parseDate("seit 03/2022")).toEqual({ month: 3, year: 2022 });
  });

  it("returns null for empty/invalid input", () => {
    expect(parseDate("")).toEqual({ month: null, year: null });
    expect(parseDate(null)).toEqual({ month: null, year: null });
    expect(parseDate(undefined)).toEqual({ month: null, year: null });
    expect(parseDate("gibberish")).toEqual({ month: null, year: null });
  });
});

describe("parsePeriod", () => {
  it("parses 'MM/YYYY - MM/YYYY'", () => {
    const result = parsePeriod("01/2020 - 12/2023");
    expect(result.start).toEqual({ month: 1, year: 2020 });
    expect(result.end).toEqual({ month: 12, year: 2023 });
    expect(result.current).toBe(false);
  });

  it("parses 'MM.YYYY – heute'", () => {
    const result = parsePeriod("03.2021 – heute");
    expect(result.start).toEqual({ month: 3, year: 2021 });
    expect(result.current).toBe(true);
  });

  it("parses 'YYYY - present'", () => {
    const result = parsePeriod("2020 - present");
    expect(result.start).toEqual({ month: null, year: 2020 });
    expect(result.current).toBe(true);
  });

  it("parses 'seit 2022'", () => {
    const result = parsePeriod("seit 2022");
    expect(result.start.year).toBe(2022);
    expect(result.current).toBe(true);
  });

  it("parses 'Jan 2020 - Dez 2023'", () => {
    const result = parsePeriod("Jan 2020 - Dez 2023");
    expect(result.start).toEqual({ month: 1, year: 2020 });
    expect(result.end).toEqual({ month: 12, year: 2023 });
    expect(result.current).toBe(false);
  });

  it("returns empty for null", () => {
    const result = parsePeriod(null);
    expect(result.start).toEqual({ month: null, year: null });
    expect(result.end).toEqual({ month: null, year: null });
    expect(result.current).toBe(false);
  });
});

// ============================================================================
// YEARS OF EXPERIENCE
// ============================================================================

describe("calculateYearsOfExperience", () => {
  it("calculates simple non-overlapping periods", () => {
    const result = calculateYearsOfExperience([
      { startYear: 2018, startMonth: 1, endYear: 2020, endMonth: 12 },
      { startYear: 2021, startMonth: 1, endYear: 2023, endMonth: 12 },
    ]);
    expect(result).toBe(5); // 3 + 3 = 6 years, floor = 5 (because month-based)
  });

  it("handles overlapping periods", () => {
    const result = calculateYearsOfExperience([
      { startYear: 2018, startMonth: 1, endYear: 2022, endMonth: 12 },
      { startYear: 2020, startMonth: 6, endYear: 2023, endMonth: 6 },
    ]);
    // Merged: 2018-01 to 2023-06 = 5.5 years = floor 5
    expect(result).toBe(5);
  });

  it("handles current positions", () => {
    const now = new Date();
    const startYear = now.getFullYear() - 3;
    const result = calculateYearsOfExperience([
      { startYear, startMonth: 1, current: true },
    ]);
    expect(result).toBeGreaterThanOrEqual(2);
  });

  it("returns 0 for empty entries", () => {
    expect(calculateYearsOfExperience([])).toBe(0);
  });

  it("handles string values for months/years", () => {
    const result = calculateYearsOfExperience([
      { startYear: "2015", startMonth: "01", endYear: "2020", endMonth: "12" },
    ]);
    expect(result).toBe(5);
  });

  it("skips invalid entries", () => {
    const result = calculateYearsOfExperience([
      { startYear: null, startMonth: null, endYear: null, endMonth: null },
      { startYear: 2020, startMonth: 1, endYear: 2022, endMonth: 12 },
    ]);
    expect(result).toBe(2);
  });
});

// ============================================================================
// SKILL NORMALIZATION
// ============================================================================

describe("normalizeSkill", () => {
  it("normalizes common aliases", () => {
    expect(normalizeSkill("JS")).toBe("JavaScript");
    expect(normalizeSkill("ts")).toBe("TypeScript");
    expect(normalizeSkill("k8s")).toBe("Kubernetes");
    expect(normalizeSkill("Postgres")).toBe("PostgreSQL");
    expect(normalizeSkill("GCP")).toBe("Google Cloud Platform");
    expect(normalizeSkill("nodejs")).toBe("Node.js");
    expect(normalizeSkill("React.js")).toBe("React");
  });

  it("preserves unknown skills", () => {
    expect(normalizeSkill("SAP HANA")).toBe("SAP HANA");
    expect(normalizeSkill("Tableau")).toBe("Tableau");
  });

  it("handles empty input", () => {
    expect(normalizeSkill("")).toBe("");
    expect(normalizeSkill("  ")).toBe("");
  });
});

describe("normalizeAndDeduplicateSkills", () => {
  it("deduplicates case-insensitively", () => {
    const result = normalizeAndDeduplicateSkills(["JavaScript", "javascript", "JAVASCRIPT"]);
    expect(result).toEqual(["JavaScript"]);
  });

  it("normalizes and deduplicates aliases", () => {
    const result = normalizeAndDeduplicateSkills(["JS", "JavaScript", "TypeScript", "TS"]);
    expect(result).toEqual(["JavaScript", "TypeScript"]);
  });

  it("filters soft skills", () => {
    const result = normalizeAndDeduplicateSkills(["Python", "teamfähig", "motiviert", "Docker"]);
    expect(result).toEqual(["Python", "Docker"]);
  });
});

// ============================================================================
// LANGUAGE NORMALIZATION
// ============================================================================

describe("normalizeLanguageLevel", () => {
  it("maps German descriptors", () => {
    expect(normalizeLanguageLevel("Muttersprache")).toBe("Muttersprache");
    expect(normalizeLanguageLevel("verhandlungssicher")).toBe("C1");
    expect(normalizeLanguageLevel("fliessend")).toBe("C1");
    expect(normalizeLanguageLevel("Gute Kenntnisse")).toBe("B2");
    expect(normalizeLanguageLevel("Grundkenntnisse")).toBe("A2");
  });

  it("maps English descriptors", () => {
    expect(normalizeLanguageLevel("native")).toBe("Muttersprache");
    expect(normalizeLanguageLevel("fluent")).toBe("C1");
    expect(normalizeLanguageLevel("basic")).toBe("A1");
    expect(normalizeLanguageLevel("advanced")).toBe("C1");
  });

  it("passes through CEFR levels", () => {
    expect(normalizeLanguageLevel("A1")).toBe("A1");
    expect(normalizeLanguageLevel("B2")).toBe("B2");
    expect(normalizeLanguageLevel("C2")).toBe("C2");
  });

  it("returns empty for unknown levels", () => {
    expect(normalizeLanguageLevel("")).toBe("");
    expect(normalizeLanguageLevel(null)).toBe("");
    expect(normalizeLanguageLevel("xyz123")).toBe("");
  });
});

describe("normalizeLanguageName", () => {
  it("maps English to German names", () => {
    expect(normalizeLanguageName("German")).toBe("Deutsch");
    expect(normalizeLanguageName("English")).toBe("Englisch");
    expect(normalizeLanguageName("French")).toBe("Französisch");
  });

  it("normalizes German names", () => {
    expect(normalizeLanguageName("deutsch")).toBe("Deutsch");
    expect(normalizeLanguageName("Englisch")).toBe("Englisch");
  });

  it("preserves unknown languages", () => {
    expect(normalizeLanguageName("Suaheli")).toBe("Suaheli");
  });
});

describe("parseLanguageEntry", () => {
  it("parses 'Deutsch (Muttersprache)'", () => {
    const result = parseLanguageEntry("Deutsch (Muttersprache)");
    expect(result.language).toBe("Deutsch");
    expect(result.level).toBe("Muttersprache");
  });

  it("parses 'English - C1'", () => {
    const result = parseLanguageEntry("English - C1");
    expect(result.language).toBe("Englisch");
    expect(result.level).toBe("C1");
  });

  it("parses 'Französisch: Grundkenntnisse'", () => {
    const result = parseLanguageEntry("Französisch: Grundkenntnisse");
    expect(result.language).toBe("Französisch");
    expect(result.level).toBe("A2");
  });

  it("parses just a language name", () => {
    const result = parseLanguageEntry("Spanisch");
    expect(result.language).toBe("Spanisch");
    expect(result.level).toBe("");
  });
});

// ============================================================================
// SUBCONTRACTOR DETECTION
// ============================================================================

describe("detectSubcontractor", () => {
  it("detects freelancer keywords", () => {
    expect(detectSubcontractor(["Freelancer", "Software Developer"])).toBe(true);
    expect(detectSubcontractor(["Selbstständiger IT-Berater"])).toBe(true);
    expect(detectSubcontractor(["Inhaber", "IT Solutions GmbH"])).toBe(true);
  });

  it("returns false for normal employment", () => {
    expect(detectSubcontractor(["Senior Developer", "Swisscom AG"])).toBe(false);
    expect(detectSubcontractor(["Project Manager", "UBS"])).toBe(false);
  });
});

// ============================================================================
// NAME CLEANING
// ============================================================================

describe("cleanNameFromTitles", () => {
  it("removes common titles", () => {
    expect(cleanNameFromTitles("Dr. Max Müller")).toBe("Max Müller");
    expect(cleanNameFromTitles("Prof. Anna Schmidt")).toBe("Anna Schmidt");
    expect(cleanNameFromTitles("Dipl. Ing. Peter Meier")).toBe("Peter Meier");
  });

  it("removes trailing titles", () => {
    expect(cleanNameFromTitles("Max Müller, MSc")).toBe("Max Müller");
    expect(cleanNameFromTitles("Anna Schmidt MBA")).toBe("Anna Schmidt");
  });

  it("preserves normal names", () => {
    expect(cleanNameFromTitles("Max Müller")).toBe("Max Müller");
    expect(cleanNameFromTitles("Anna")).toBe("Anna");
  });
});

// ============================================================================
// PHONE NORMALIZATION
// ============================================================================

describe("normalizePhone", () => {
  it("adds Swiss country code", () => {
    expect(normalizePhone("0791234567")).toBe("+41 791234567");
  });

  it("preserves numbers with country code", () => {
    expect(normalizePhone("+41 79 123 45 67")).toBe("+41 79 123 45 67");
  });

  it("removes labels", () => {
    expect(normalizePhone("Tel: +41 79 123 45 67")).toBe("+41 79 123 45 67");
    expect(normalizePhone("Mobile: 079 123 45 67")).toBe("+41 79 123 45 67");
  });

  it("returns empty for empty input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("  ")).toBe("");
  });
});

// ============================================================================
// ADDRESS PARSING
// ============================================================================

describe("parseAddress", () => {
  it("parses Swiss address format", () => {
    const result = parseAddress("Musterstrasse 12, 8001 Zürich");
    expect(result.street).toBe("Musterstrasse 12");
    expect(result.postalCode).toBe("8001");
    expect(result.city).toBe("Zürich");
  });

  it("parses without comma", () => {
    const result = parseAddress("Hauptgasse 5 3011 Bern");
    expect(result.postalCode).toBe("3011");
    expect(result.city).toBe("Bern");
  });

  it("handles empty input", () => {
    const result = parseAddress("");
    expect(result.street).toBe("");
    expect(result.postalCode).toBe("");
    expect(result.city).toBe("");
  });
});

// ============================================================================
// AVAILABLE FROM
// ============================================================================

describe("normalizeAvailableFrom", () => {
  it("converts 'sofort' to today's date", () => {
    const result = normalizeAvailableFrom("sofort");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("converts 'per sofort'", () => {
    const result = normalizeAvailableFrom("per sofort");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("converts date string", () => {
    expect(normalizeAvailableFrom("01.2024")).toBe("2024-01-01");
  });
});

// ============================================================================
// CERTIFICATE PARSING
// ============================================================================

describe("parseCertificate", () => {
  it("parses 'AWS Solutions Architect (2022)'", () => {
    const result = parseCertificate("AWS Solutions Architect (2022)");
    expect(result.name).toBe("AWS Solutions Architect");
    expect(result.year).toBe("2022");
  });

  it("parses 'SCRUM Master - Scrum.org, 2021'", () => {
    const result = parseCertificate("SCRUM Master - Scrum.org, 2021");
    expect(result.name).toBe("SCRUM Master");
    expect(result.issuer).toContain("Scrum.org");
  });

  it("parses simple certification name", () => {
    const result = parseCertificate("PMP Certification");
    expect(result.name).toBe("PMP Certification");
    expect(result.issuer).toBe("");
    expect(result.year).toBe("");
  });
});

// ============================================================================
// HIGHLIGHT FILTERING
// ============================================================================

describe("filterHighlights", () => {
  it("filters out generic phrases", () => {
    const result = filterHighlights([
      "Erfolgreiche Migration von 50+ Servern zu AWS Cloud-Infrastruktur",
      "teamfähig",
      "motiviert",
      "Einführung eines neuen CI/CD-Workflows mit 40% kürzerer Deployment-Zeit",
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("Migration");
    expect(result[1]).toContain("CI/CD");
  });

  it("filters out very short entries", () => {
    const result = filterHighlights(["short", "auch kurz", ""]);
    expect(result).toHaveLength(0);
  });
});
