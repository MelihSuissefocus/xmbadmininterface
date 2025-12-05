import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const jobTypeEnum = pgEnum("job_type", ["contract", "permanent"]);
export const jobStatusEnum = pgEnum("job_status", ["draft", "published", "archived"]);
export const candidateStatusEnum = pgEnum("candidate_status", ["new", "reviewed", "rejected", "placed"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["proposed", "interviewing", "offered", "rejected", "placed"]);
export const contractBillingEnum = pgEnum("contract_billing", ["payroll", "company", "hybrid"]);

export const userRoleEnum = pgEnum("user_role", ["admin", "recruiter", "viewer"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").default("admin"),
  isActive: integer("is_active").default(1),
  failedAttempts: integer("failed_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  type: jobTypeEnum("type").notNull(),
  description: text("description"),
  requirements: text("requirements"),
  benefits: text("benefits"),
  workload: text("workload"),
  location: text("location"),
  remote: text("remote"),
  // Festanstellung: Gehalt
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  // Contracting: Raten & Abrechnungsmodell
  contractBilling: contractBillingEnum("contract_billing"),
  ratePayroll: integer("rate_payroll"),
  rateCompany: integer("rate_company"),
  startDate: date("start_date"),
  duration: text("duration"),
  requiredSkills: jsonb("required_skills").$type<string[]>(),
  niceToHaveSkills: jsonb("nice_to_have_skills").$type<string[]>(),
  contactPerson: text("contact_person"),
  clientCompany: text("client_company"),
  internalNotes: text("internal_notes"),
  status: jobStatusEnum("status").default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  birthdate: date("birthdate"),
  linkedinUrl: text("linkedin_url"),
  targetRole: text("target_role"),
  yearsOfExperience: integer("years_of_experience"),
  currentSalary: integer("current_salary"),
  expectedSalary: integer("expected_salary"),
  availableFrom: date("available_from"),
  workloadPreference: text("workload_preference"),
  noticePeriod: text("notice_period"),
  skills: jsonb("skills").$type<string[]>(),
  certificates: jsonb("certificates").$type<{
    name: string;
    issuer: string;
    date: string;
  }[]>(),
  languages: jsonb("languages").$type<{
    language: string;
    level: string;
  }[]>(),
  education: jsonb("education").$type<{
    degree: string;
    institution: string;
    year: string;
  }[]>(),
  experience: jsonb("experience").$type<{
    role: string;
    company: string;
    from: string;
    to: string;
    description: string;
  }[]>(),
  originalCvUrl: text("original_cv_url"),
  brandedCvUrl: text("branded_cv_url"),
  parsedData: jsonb("parsed_data"),
  notes: text("notes"),
  status: candidateStatusEnum("status").default("new").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Junction table for Job-Candidate assignments
export const jobCandidates = pgTable(
  "job_candidates",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    status: assignmentStatusEnum("status").default("proposed").notNull(),
    notes: text("notes"),
    assignedAt: timestamp("assigned_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.candidateId] })]
);

// Relations
export const jobsRelations = relations(jobs, ({ many }) => ({
  jobCandidates: many(jobCandidates),
}));

export const candidatesRelations = relations(candidates, ({ many }) => ({
  jobCandidates: many(jobCandidates),
}));

export const jobCandidatesRelations = relations(jobCandidates, ({ one }) => ({
  job: one(jobs, {
    fields: [jobCandidates.jobId],
    references: [jobs.id],
  }),
  candidate: one(candidates, {
    fields: [jobCandidates.candidateId],
    references: [candidates.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
export type JobCandidate = typeof jobCandidates.$inferSelect;
export type NewJobCandidate = typeof jobCandidates.$inferInsert;
