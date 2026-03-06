import { describe, it, expect } from "vitest";
import { validateParsedCv } from "../validator";
import { createEmptyParsedCv } from "../types";

describe("validateParsedCv", () => {
  it("validates a valid parsed CV without issues", () => {
    const cv = createEmptyParsedCv();
    cv.first_name = "Max";
    cv.last_name = "Müller";
    cv.email = "max@example.com";
    cv.phone = "+41 79 123 45 67";

    const { data, issues } = validateParsedCv(cv);
    expect(data.first_name).toBe("Max");
    expect(issues.length).toBe(0);
  });

  it("clears invalid email", () => {
    const cv = createEmptyParsedCv();
    cv.email = "not-an-email";

    const { data, issues } = validateParsedCv(cv);
    expect(data.email).toBe("");
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("email");
  });

  it("clears invalid LinkedIn URL", () => {
    const cv = createEmptyParsedCv();
    cv.linkedin_url = "https://www.google.com/some-random-page";

    const { data, issues } = validateParsedCv(cv);
    expect(data.linkedin_url).toBe("");
  });

  it("clears too short phone numbers", () => {
    const cv = createEmptyParsedCv();
    cv.phone = "123";

    const { data, issues } = validateParsedCv(cv);
    expect(data.phone).toBe("");
  });

  it("deduplicates skills", () => {
    const cv = createEmptyParsedCv();
    cv.skills = ["Python", "Python", "JavaScript"];

    const { data } = validateParsedCv(cv);
    expect(data.skills).toEqual(["Python", "JavaScript"]);
  });

  it("removes empty objects from arrays", () => {
    const cv = createEmptyParsedCv();
    cv.languages = [
      { language: "Deutsch", level: "C2" },
      { language: "", level: "" },
    ];
    cv.education = [
      { degree: "", institution: "", startMonth: "", startYear: "", endMonth: "", endYear: "" },
    ];

    const { data } = validateParsedCv(cv);
    expect(data.languages).toHaveLength(1);
    expect(data.education).toHaveLength(0);
  });

  it("warns about end date before start date", () => {
    const cv = createEmptyParsedCv();
    cv.work_experience = [
      {
        role: "Developer",
        company: "Firma",
        startYear: "2023",
        startMonth: "01",
        endYear: "2020",
        endMonth: "12",
        current: false,
        description: "",
      },
    ];

    const { issues } = validateParsedCv(cv);
    expect(issues.some(i => i.field === "work_experience")).toBe(true);
  });

  it("clears end dates when current=true", () => {
    const cv = createEmptyParsedCv();
    cv.work_experience = [
      {
        role: "Developer",
        company: "Firma",
        startYear: "2020",
        startMonth: "01",
        endYear: "2023",
        endMonth: "12",
        current: true,
        description: "",
      },
    ];

    const { data } = validateParsedCv(cv);
    expect(data.work_experience[0].endYear).toBe("");
    expect(data.work_experience[0].endMonth).toBe("");
  });

  it("validates month values (1-12)", () => {
    const cv = createEmptyParsedCv();
    cv.work_experience = [
      {
        role: "Dev",
        company: "Co",
        startMonth: "13",
        startYear: "2020",
        endMonth: "0",
        endYear: "2023",
        current: false,
        description: "",
      },
    ];

    const { data } = validateParsedCv(cv);
    expect(data.work_experience[0].startMonth).toBe("");
    expect(data.work_experience[0].endMonth).toBe("");
  });

  it("deduplicates work experience entries", () => {
    const cv = createEmptyParsedCv();
    cv.work_experience = [
      { role: "Dev", company: "Firma", startYear: "2020", startMonth: "", endYear: "2023", endMonth: "", current: false, description: "a" },
      { role: "Dev", company: "Firma", startYear: "2020", startMonth: "", endYear: "2023", endMonth: "", current: false, description: "b" },
    ];

    const { data } = validateParsedCv(cv);
    expect(data.work_experience).toHaveLength(1);
  });

  it("always sets status to 'Neu' if empty", () => {
    const cv = createEmptyParsedCv();
    cv.status = "";

    const { data } = validateParsedCv(cv);
    expect(data.status).toBe("Neu");
  });

  it("always clears internal notes", () => {
    const cv = createEmptyParsedCv();
    cv.internal_notes = "Some hallucinated note";

    const { data } = validateParsedCv(cv);
    expect(data.internal_notes).toBe("");
  });

  it("produces valid JSON output always", () => {
    const cv = createEmptyParsedCv();
    const { data } = validateParsedCv(cv);

    const json = JSON.stringify(data);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
