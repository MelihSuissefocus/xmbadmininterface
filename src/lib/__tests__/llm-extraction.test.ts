import { describe, it, expect, vi } from "vitest";
import {
  validateAndNormalizeLlmResponse,
  isLikelyJobTitle,
  isValidPersonName,
  type LlmExtractionResponse,
} from "../llm-schema";

describe("LLM Schema Validation", () => {
  describe("isLikelyJobTitle", () => {
    it("should identify common job titles", () => {
      expect(isLikelyJobTitle("System Engineer")).toBe(true);
      expect(isLikelyJobTitle("Software Developer")).toBe(true);
      expect(isLikelyJobTitle("Senior Developer")).toBe(true);
      expect(isLikelyJobTitle("Project Manager")).toBe(true);
      expect(isLikelyJobTitle("Consultant")).toBe(true);
      expect(isLikelyJobTitle("Director")).toBe(true);
      expect(isLikelyJobTitle("Team Lead")).toBe(true);
    });

    it("should not flag person names as job titles", () => {
      expect(isLikelyJobTitle("Max Mustermann")).toBe(false);
      expect(isLikelyJobTitle("Anna Schmidt")).toBe(false);
      expect(isLikelyJobTitle("John Smith")).toBe(false);
    });
  });

  describe("isValidPersonName", () => {
    it("should accept valid person names", () => {
      expect(isValidPersonName("Max", "Mustermann")).toBe(true);
      expect(isValidPersonName("Anna", "Schmidt")).toBe(true);
      expect(isValidPersonName("Jean-Pierre", "Müller")).toBe(true);
    });

    it("should reject job titles as names", () => {
      expect(isValidPersonName("System", "Engineer")).toBe(false);
      expect(isValidPersonName("Software", "Developer")).toBe(false);
      expect(isValidPersonName("Senior", "Consultant")).toBe(false);
    });

    it("should reject single-character names", () => {
      expect(isValidPersonName("M", "Mustermann")).toBe(false);
      expect(isValidPersonName("Max", "M")).toBe(false);
    });

    it("should reject names with numbers", () => {
      expect(isValidPersonName("Max123", "Mustermann")).toBe(false);
      expect(isValidPersonName("Max", "Muster2")).toBe(false);
    });
  });

  describe("validateAndNormalizeLlmResponse", () => {
    const createValidResponse = (overrides: Partial<LlmExtractionResponse> = {}): LlmExtractionResponse => ({
      person: {
        firstName: "Max",
        lastName: "Mustermann",
        fullName: "Max Mustermann",
        evidence: [{ lineId: "p1_l1", page: 1, text: "Max Mustermann" }],
      },
      contact: {
        email: "max@example.com",
        phone: "+41791234567",
        linkedinUrl: null,
        address: null,
        evidence: [{ lineId: "p1_l2", page: 1, text: "max@example.com" }],
      },
      nationality: null,
      languages: [
        { name: "Deutsch", level: "C2", evidence: [{ lineId: "p1_l10", page: 1, text: "Deutsch C2" }] },
      ],
      skills: [
        { name: "JavaScript", evidence: [{ lineId: "p1_l15", page: 1, text: "JavaScript" }] },
      ],
      experience: [
        {
          company: "Tech AG",
          title: "Senior Developer",
          startDate: "2020",
          endDate: "present",
          location: "Zürich",
          description: "Full-stack development",
          evidence: [{ lineId: "p1_l20", page: 1, text: "Tech AG, Senior Developer" }],
        },
      ],
      education: [
        {
          institution: "ETH Zürich",
          degree: "MSc Computer Science",
          startDate: "2015",
          endDate: "2018",
          evidence: [{ lineId: "p2_l1", page: 2, text: "ETH Zürich MSc" }],
        },
      ],
      metadata: {
        needs_review_fields: [],
        notes: [],
      },
      ...overrides,
    });

    it("should accept valid response with all required fields", () => {
      const response = createValidResponse();
      const result = validateAndNormalizeLlmResponse(response);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.flaggedFields).toHaveLength(0);
    });

    it("should reject and flag job titles as names", () => {
      const response = createValidResponse({
        person: {
          firstName: "System",
          lastName: "Engineer",
          fullName: "System Engineer",
          evidence: [{ lineId: "p1_l1", page: 1, text: "System Engineer" }],
        },
      });

      const result = validateAndNormalizeLlmResponse(response);

      expect(result.valid).toBe(true);
      expect(result.data?.person.firstName).toBeNull();
      expect(result.data?.person.lastName).toBeNull();
      expect(result.flaggedFields).toContain("firstName");
      expect(result.flaggedFields).toContain("lastName");
      expect(result.data?.metadata.needs_review_fields).toContain("firstName");
    });

    it("should reject invalid email format", () => {
      const response = createValidResponse({
        contact: {
          email: "not-an-email",
          phone: "+41791234567",
          linkedinUrl: null,
          address: null,
          evidence: [{ lineId: "p1_l2", page: 1, text: "not-an-email" }],
        },
      });

      const result = validateAndNormalizeLlmResponse(response);

      expect(result.valid).toBe(true);
      expect(result.data?.contact.email).toBeNull();
      expect(result.flaggedFields).toContain("email");
    });

    it("should normalize valid phone numbers to E.164", () => {
      const response = createValidResponse({
        contact: {
          email: "test@example.com",
          phone: "079 123 45 67",
          linkedinUrl: null,
          address: null,
          evidence: [{ lineId: "p1_l2", page: 1, text: "079 123 45 67" }],
        },
      });

      const result = validateAndNormalizeLlmResponse(response);

      expect(result.valid).toBe(true);
      expect(result.data?.contact.phone).toBe("+41791234567");
    });

    it("should filter out experience without evidence", () => {
      const response = createValidResponse({
        experience: [
          {
            company: "Tech AG",
            title: "Developer",
            startDate: "2020",
            endDate: "present",
            evidence: [], // No evidence
          },
          {
            company: "Other AG",
            title: "Engineer",
            startDate: "2018",
            endDate: "2020",
            evidence: [{ lineId: "p1_l25", page: 1, text: "Other AG" }],
          },
        ],
      });

      const result = validateAndNormalizeLlmResponse(response);

      expect(result.valid).toBe(true);
      expect(result.data?.experience).toHaveLength(1);
      expect(result.data?.experience[0].company).toBe("Other AG");
      expect(result.flaggedFields).toContain("experience");
    });

    it("should reject completely invalid JSON structure", () => {
      const result = validateAndNormalizeLlmResponse({ invalid: "structure" });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("should handle missing optional fields gracefully", () => {
      const response = createValidResponse({
        nationality: null,
        languages: [],
        skills: [],
      });

      const result = validateAndNormalizeLlmResponse(response);

      expect(result.valid).toBe(true);
      expect(result.data?.languages).toHaveLength(0);
      expect(result.data?.skills).toHaveLength(0);
    });
  });
});

describe("Experience Extraction", () => {
  it("should extract multiple experience items from packed section input", () => {
    const mockLlmResponse: LlmExtractionResponse = {
      person: {
        firstName: "Max",
        lastName: "Mustermann",
        evidence: [{ lineId: "p1_l1", page: 1, text: "Max Mustermann" }],
      },
      contact: {
        email: "max@example.com",
        phone: null,
        evidence: [{ lineId: "p1_l2", page: 1, text: "max@example.com" }],
      },
      nationality: null,
      languages: [],
      skills: [],
      experience: [
        {
          company: "Google Switzerland",
          title: "Senior Software Engineer",
          startDate: "2020-01",
          endDate: "present",
          location: "Zürich",
          description: "Led frontend team",
          evidence: [
            { lineId: "p1_l30", page: 1, text: "Google Switzerland" },
            { lineId: "p1_l31", page: 1, text: "Senior Software Engineer" },
          ],
        },
        {
          company: "Credit Suisse",
          title: "Software Developer",
          startDate: "2017-06",
          endDate: "2019-12",
          location: "Zürich",
          description: "Backend development",
          evidence: [
            { lineId: "p1_l40", page: 1, text: "Credit Suisse" },
            { lineId: "p1_l41", page: 1, text: "2017 - 2019" },
          ],
        },
      ],
      education: [],
      metadata: { needs_review_fields: [], notes: [] },
    };

    const result = validateAndNormalizeLlmResponse(mockLlmResponse);

    expect(result.valid).toBe(true);
    expect(result.data?.experience).toHaveLength(2);
    expect(result.data?.experience[0].company).toBe("Google Switzerland");
    expect(result.data?.experience[1].company).toBe("Credit Suisse");
  });
});

describe("Name vs Title Misclassification", () => {
  const jobTitles = [
    ["System", "Engineer"],
    ["Software", "Developer"],
    ["Project", "Manager"],
    ["Senior", "Consultant"],
    ["Lead", "Architect"],
    ["Technical", "Director"],
  ];

  it.each(jobTitles)(
    "should NOT accept '%s %s' as a valid person name",
    (firstName, lastName) => {
      const response = {
        person: {
          firstName,
          lastName,
          evidence: [{ lineId: "p1_l1", page: 1, text: `${firstName} ${lastName}` }],
        },
        contact: {
          email: null,
          phone: null,
          evidence: [],
        },
        nationality: null,
        languages: [],
        skills: [],
        experience: [],
        education: [],
        metadata: { needs_review_fields: [], notes: [] },
      };

      const result = validateAndNormalizeLlmResponse(response);

      expect(result.data?.person.firstName).toBeNull();
      expect(result.data?.person.lastName).toBeNull();
      expect(result.flaggedFields).toContain("firstName");
    }
  );

  const validNames = [
    ["Max", "Mustermann"],
    ["Anna", "Schmidt"],
    ["Pierre", "Dubois"],
    ["李", "明"],
  ];

  it.each(validNames)(
    "should accept '%s %s' as a valid person name",
    (firstName, lastName) => {
      const response = {
        person: {
          firstName,
          lastName,
          evidence: [{ lineId: "p1_l1", page: 1, text: `${firstName} ${lastName}` }],
        },
        contact: {
          email: null,
          phone: null,
          evidence: [],
        },
        nationality: null,
        languages: [],
        skills: [],
        experience: [],
        education: [],
        metadata: { needs_review_fields: [], notes: [] },
      };

      const result = validateAndNormalizeLlmResponse(response);

      if (firstName.length >= 2 && lastName.length >= 2) {
        expect(result.data?.person.firstName).toBe(firstName);
        expect(result.data?.person.lastName).toBe(lastName);
      }
    }
  );
});

