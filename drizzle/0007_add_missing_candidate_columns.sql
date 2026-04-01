-- Add missing columns to candidates table
-- These columns were added to the Drizzle schema but never migrated to the database

-- Address fields (replacing old "location" column)
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "street" text;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "postal_code" text;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "canton" text;

-- Personal info
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "nationality" text;

-- Compensation & availability
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "desired_hourly_rate" integer;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "industry_experience" text;

-- Subcontractor fields
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "is_subcontractor" integer DEFAULT 0;
CREATE TYPE "public"."company_type" AS ENUM('ag', 'gmbh', 'einzelunternehmen');
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "company_name" text;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "company_type" "company_type";

-- CV highlights
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "highlights" jsonb;
