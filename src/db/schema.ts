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
export const companyTypeEnum = pgEnum("company_type", ["ag", "gmbh", "einzelunternehmen"]);

export const userRoleEnum = pgEnum("user_role", ["admin", "recruiter", "viewer"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "login", "logout", "password_reset"]);
export const cvAnalysisStatusEnum = pgEnum("cv_analysis_status", ["pending", "processing", "completed", "failed"]);

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  description: text("description"),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  email: text("email"),
  phone: text("phone"),
  street: text("street"),
  postalCode: text("postal_code"),
  city: text("city"),
  country: text("country"),
  website: text("website"),
  primaryColor: text("primary_color").default("#f59e0b"),
  secondaryColor: text("secondary_color").default("#1e293b"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: auditActionEnum("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cvAnalysisJobs = pgTable("cv_analysis_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: cvAnalysisStatusEnum("status").default("pending").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

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
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  street: text("street"),
  postalCode: text("postal_code"),
  city: text("city"),
  canton: text("canton"),
  birthdate: date("birthdate"),
  linkedinUrl: text("linkedin_url"),
  targetRole: text("target_role"),
  yearsOfExperience: integer("years_of_experience"),
  currentSalary: integer("current_salary"),
  expectedSalary: integer("expected_salary"),
  availableFrom: date("available_from"),
  workloadPreference: text("workload_preference"),
  noticePeriod: text("notice_period"),
  desiredHourlyRate: integer("desired_hourly_rate"),
  isSubcontractor: integer("is_subcontractor").default(0),
  companyName: text("company_name"),
  companyType: companyTypeEnum("company_type"),
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
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
  }[]>(),
  experience: jsonb("experience").$type<{
    role: string;
    company: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
    current: boolean;
    description: string;
  }[]>(),
  highlights: jsonb("highlights").$type<string[]>(),
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
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type CvAnalysisJob = typeof cvAnalysisJobs.$inferSelect;
export type NewCvAnalysisJob = typeof cvAnalysisJobs.$inferInsert;
