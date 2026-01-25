-- Add production hardening columns to cv_analysis_jobs
ALTER TABLE "cv_analysis_jobs" ADD COLUMN IF NOT EXISTS "tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL;
ALTER TABLE "cv_analysis_jobs" ADD COLUMN IF NOT EXISTS "file_hash" text;
ALTER TABLE "cv_analysis_jobs" ADD COLUMN IF NOT EXISTS "error_code" text;
ALTER TABLE "cv_analysis_jobs" ADD COLUMN IF NOT EXISTS "latency_ms" integer;
ALTER TABLE "cv_analysis_jobs" ADD COLUMN IF NOT EXISTS "page_count" integer;
ALTER TABLE "cv_analysis_jobs" ADD COLUMN IF NOT EXISTS "autofill_field_count" integer;
ALTER TABLE "cv_analysis_jobs" ADD COLUMN IF NOT EXISTS "review_field_count" integer;

-- Create tenant quota configuration table
CREATE TABLE IF NOT EXISTS "tenant_quota_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL UNIQUE,
  "daily_analysis_quota" integer DEFAULT 500 NOT NULL,
  "max_file_size_mb" integer DEFAULT 10,
  "max_pages" integer DEFAULT 20,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create daily analytics table (non-PII only)
CREATE TABLE IF NOT EXISTS "cv_analytics_daily" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
  "date" date NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "timeout_count" integer DEFAULT 0 NOT NULL,
  "dedupe_hit_count" integer DEFAULT 0 NOT NULL,
  "total_latency_ms" integer DEFAULT 0 NOT NULL,
  "total_pages" integer DEFAULT 0 NOT NULL,
  "total_autofill_fields" integer DEFAULT 0 NOT NULL,
  "total_review_fields" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS "cv_analytics_daily_tenant_date_idx" ON "cv_analytics_daily" ("tenant_id", "date");
CREATE INDEX IF NOT EXISTS "cv_analysis_jobs_file_hash_idx" ON "cv_analysis_jobs" ("file_hash") WHERE "file_hash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "cv_analysis_jobs_user_created_idx" ON "cv_analysis_jobs" ("user_id", "created_at");

