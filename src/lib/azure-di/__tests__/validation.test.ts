import { describe, it, expect } from "vitest";
import {
  validateEmail,
  normalizePhoneE164,
  normalizeCanton,
  parseCEFRLevel,
  parseDate,
} from "../validation";

describe("validateEmail", () => {
  it("validates correct email addresses", () => {
    expect(validateEmail("test@example.org").valid).toBe(true);
    expect(validateEmail("user.name@domain.co.uk").valid).toBe(true);
    expect(validateEmail("USER@DOMAIN.COM").normalized).toBe("user@domain.com");
  });

  it("rejects invalid email addresses", () => {
    expect(validateEmail("invalid").valid).toBe(false);
    expect(validateEmail("@nodomain.com").valid).toBe(false);
    expect(validateEmail("no@localhost").valid).toBe(false);
    expect(validateEmail("test@example.com").valid).toBe(false);
  });

  it("normalizes to lowercase", () => {
    const result = validateEmail("Max.Mustermann@Example.ORG");
    expect(result.normalized).toBe("max.mustermann@example.org");
  });
});

describe("normalizePhoneE164", () => {
  it("normalizes Swiss mobile numbers", () => {
    expect(normalizePhoneE164("079 123 45 67", "CH")).toEqual({
      valid: true,
      normalized: "+41791234567",
      original: "079 123 45 67",
    });
  });

  it("normalizes numbers with country code", () => {
    expect(normalizePhoneE164("+41 44 555 66 77", "CH")).toEqual({
      valid: true,
      normalized: "+41445556677",
      original: "+41 44 555 66 77",
    });
  });

  it("handles 00 prefix", () => {
    expect(normalizePhoneE164("0041 79 123 45 67", "CH")).toEqual({
      valid: true,
      normalized: "+41791234567",
      original: "0041 79 123 45 67",
    });
  });

  it("uses default region for local numbers", () => {
    expect(normalizePhoneE164("079 123 45 67", "DE").normalized).toBe("+49791234567");
  });

  it("rejects invalid phone numbers", () => {
    expect(normalizePhoneE164("123", "CH").valid).toBe(false);
    expect(normalizePhoneE164("abc", "CH").valid).toBe(false);
  });
});

describe("normalizeCanton", () => {
  it("normalizes canton abbreviations", () => {
    expect(normalizeCanton("ZH")).toBe("ZH");
    expect(normalizeCanton("zh")).toBe("ZH");
    expect(normalizeCanton("BE")).toBe("BE");
  });

  it("normalizes canton names in German", () => {
    expect(normalizeCanton("Zürich")).toBe("ZH");
    expect(normalizeCanton("Bern")).toBe("BE");
    expect(normalizeCanton("Graubünden")).toBe("GR");
  });

  it("normalizes canton names in French", () => {
    expect(normalizeCanton("Genève")).toBe("GE");
    expect(normalizeCanton("Vaud")).toBe("VD");
  });

  it("returns null for unknown cantons", () => {
    expect(normalizeCanton("Unknown")).toBeNull();
    expect(normalizeCanton("Bavaria")).toBeNull();
  });
});

describe("parseCEFRLevel", () => {
  it("extracts CEFR levels", () => {
    expect(parseCEFRLevel("B2")).toBe("B2");
    expect(parseCEFRLevel("Level C1")).toBe("C1");
    expect(parseCEFRLevel("German A2")).toBe("A2");
  });

  it("detects native language", () => {
    expect(parseCEFRLevel("Muttersprache")).toBe("native");
    expect(parseCEFRLevel("Native speaker")).toBe("native");
    expect(parseCEFRLevel("Mother tongue")).toBe("native");
  });

  it("maps descriptive levels", () => {
    expect(parseCEFRLevel("Fliessend")).toBe("C2");
    expect(parseCEFRLevel("Fluent")).toBe("C2");
    expect(parseCEFRLevel("Fortgeschritten")).toBe("C1");
    expect(parseCEFRLevel("Grundkenntnisse")).toBe("A2");
  });

  it("returns null for unknown levels", () => {
    expect(parseCEFRLevel("Unknown")).toBeNull();
    expect(parseCEFRLevel("Some text")).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses full dates", () => {
    expect(parseDate("15.06.2020")).toEqual({ year: 2020, month: 6 });
    expect(parseDate("01/03/2019")).toEqual({ year: 2019, month: 3 });
  });

  it("parses month/year", () => {
    expect(parseDate("06/2020")).toEqual({ year: 2020, month: 6 });
    expect(parseDate("12.2019")).toEqual({ year: 2019, month: 12 });
  });

  it("parses year only", () => {
    expect(parseDate("2020")).toEqual({ year: 2020 });
    expect(parseDate("Since 2018")).toEqual({ year: 2018 });
  });

  it("parses month names", () => {
    expect(parseDate("Januar 2020")).toEqual({ year: 2020, month: 1 });
    expect(parseDate("December 2019")).toEqual({ year: 2019, month: 12 });
    expect(parseDate("März 2021")).toEqual({ year: 2021, month: 3 });
  });

  it("handles present/today keywords", () => {
    const result = parseDate("heute");
    expect(result?.year).toBe(new Date().getFullYear());
  });

  it("returns null for unparseable dates", () => {
    expect(parseDate("invalid")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

