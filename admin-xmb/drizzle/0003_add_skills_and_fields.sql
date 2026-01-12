-- Create skills table
CREATE TABLE "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text UNIQUE NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Add new candidate fields
ALTER TABLE "candidates" ADD COLUMN "desired_hourly_rate" integer;
ALTER TABLE "candidates" ADD COLUMN "is_subcontractor" integer DEFAULT 0;

-- No changes needed for education and experience as they are JSONB
-- The structure changes will be handled in the application layer

