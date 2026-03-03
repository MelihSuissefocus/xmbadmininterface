import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Candidate } from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks – declared before import so vi.mock hoisting works
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/db", () => {
  const selectResult = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      select: vi.fn().mockReturnValue(selectResult),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
  };
});

vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocks are declared)
// ─────────────────────────────────────────────────────────────────────────────

import { POST } from "@/app/api/cv-generator/route";
import { auth } from "@/auth";
import { db } from "@/db";

const CANDIDATE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: CANDIDATE_ID,
    firstName: "Max",
    lastName: "Mustermann",
    email: "max@example.com",
    phone: "+41 79 123 45 67",
    street: null,
    postalCode: null,
    city: "Zürich",
    canton: null,
    birthdate: null,
    linkedinUrl: null,
    targetRole: "IT Consultant",
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
    skills: ["Java", "Spring Boot"],
    certificates: null,
    languages: [{ language: "Deutsch", level: "Muttersprache" }],
    education: null,
    experience: [
      {
        role: "Developer",
        company: "Firma AG",
        startMonth: "01",
        startYear: "2020",
        endMonth: "12",
        endYear: "2023",
        current: false,
        description: "Backend-Entwicklung",
      },
    ],
    highlights: ["10 Jahre Erfahrung"],
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

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/cv-generator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers to configure mock chains per test
// ─────────────────────────────────────────────────────────────────────────────

function mockAuth(session: unknown) {
  vi.mocked(auth).mockResolvedValue(session as Awaited<ReturnType<typeof auth>>);
}

/** Sets up the db.select() chain so the Nth call returns `rows`. */
function mockSelectChain(calls: unknown[][]) {
  let callIdx = 0;
  const makeLimitFn = (rows: unknown[]) => vi.fn().mockResolvedValue(rows);
  const makeChain = (rows: unknown[]) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: makeLimitFn(rows),
      }),
    }),
  });

  vi.mocked(db.select).mockImplementation((..._args: unknown[]) => {
    const rows = calls[callIdx] ?? [];
    callIdx++;
    return makeChain(rows) as ReturnType<typeof db.select>;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/cv-generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth(null);
    const res = await POST(makeRequest({ candidateId: CANDIDATE_ID, variant: "customer" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid body (missing variant)", async () => {
    mockAuth({ user: { id: "u1" } });
    mockSelectChain([[{ role: "admin", isActive: 1 }]]);

    const res = await POST(makeRequest({ candidateId: CANDIDATE_ID }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("variant");
  });

  it("returns 400 for invalid candidateId (not a uuid)", async () => {
    mockAuth({ user: { id: "u1" } });
    mockSelectChain([[{ role: "admin", isActive: 1 }]]);

    const res = await POST(makeRequest({ candidateId: "not-a-uuid", variant: "customer" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is inactive", async () => {
    mockAuth({ user: { id: "u1" } });
    mockSelectChain([[{ role: "admin", isActive: 0 }]]);

    const res = await POST(makeRequest({ candidateId: CANDIDATE_ID, variant: "customer" }));
    expect(res.status).toBe(403);
  });

  it("returns 404 when candidate is not found", async () => {
    mockAuth({ user: { id: "u1" } });
    // 1st select → user check, 2nd select → candidate lookup
    mockSelectChain([[{ role: "admin", isActive: 1 }], []]);

    const res = await POST(makeRequest({ candidateId: CANDIDATE_ID, variant: "customer" }));
    expect(res.status).toBe(404);
  });

  it("returns 200 with pdfUrl for valid request", async () => {
    mockAuth({ user: { id: "u1" } });
    mockSelectChain([[{ role: "admin", isActive: 1 }], [makeCandidate()]]);

    const res = await POST(makeRequest({ candidateId: CANDIDATE_ID, variant: "customer" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.candidateId).toBe(CANDIDATE_ID);
    expect(json.variant).toBe("customer");
    expect(json.pdfUrl).toMatch(/^\/uploads\/cvs\//);
    expect(json.pdfUrl).toMatch(/\.pdf$/);
    expect(json.createdAt).toBeTruthy();
  }, 30_000);

  it("returns 200 for internal variant", async () => {
    mockAuth({ user: { id: "u1" } });
    mockSelectChain([[{ role: "recruiter", isActive: 1 }], [makeCandidate()]]);

    const res = await POST(makeRequest({ candidateId: CANDIDATE_ID, variant: "internal" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.variant).toBe("internal");
    expect(json.pdfUrl).toContain("internal.pdf");
  }, 30_000);
});
