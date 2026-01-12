CREATE TYPE "public"."assignment_status" AS ENUM('proposed', 'interviewing', 'offered', 'rejected', 'placed');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('new', 'reviewed', 'rejected', 'placed');--> statement-breakpoint
CREATE TYPE "public"."contract_billing" AS ENUM('payroll', 'company', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('contract', 'permanent');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'recruiter', 'viewer');--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"location" text,
	"birthdate" date,
	"linkedin_url" text,
	"target_role" text,
	"years_of_experience" integer,
	"current_salary" integer,
	"expected_salary" integer,
	"available_from" date,
	"workload_preference" text,
	"notice_period" text,
	"skills" jsonb,
	"certificates" jsonb,
	"languages" jsonb,
	"education" jsonb,
	"experience" jsonb,
	"original_cv_url" text,
	"branded_cv_url" text,
	"parsed_data" jsonb,
	"notes" text,
	"status" "candidate_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_candidates" (
	"job_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'proposed' NOT NULL,
	"notes" text,
	"assigned_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_candidates_job_id_candidate_id_pk" PRIMARY KEY("job_id","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" "job_type" NOT NULL,
	"description" text,
	"requirements" text,
	"benefits" text,
	"workload" text,
	"location" text,
	"remote" text,
	"salary_min" integer,
	"salary_max" integer,
	"contract_billing" "contract_billing",
	"rate_payroll" integer,
	"rate_company" integer,
	"start_date" date,
	"duration" text,
	"required_skills" jsonb,
	"nice_to_have_skills" jsonb,
	"contact_person" text,
	"client_company" text,
	"internal_notes" text,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" "user_role" DEFAULT 'admin',
	"is_active" integer DEFAULT 1,
	"failed_attempts" integer DEFAULT 0,
	"locked_until" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "job_candidates" ADD CONSTRAINT "job_candidates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_candidates" ADD CONSTRAINT "job_candidates_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;