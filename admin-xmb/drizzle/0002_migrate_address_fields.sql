-- Add new address columns
ALTER TABLE "candidates" ADD COLUMN "street" text;
ALTER TABLE "candidates" ADD COLUMN "postal_code" text;
ALTER TABLE "candidates" ADD COLUMN "city" text;
ALTER TABLE "candidates" ADD COLUMN "canton" text;

-- Migrate existing location data to city field
UPDATE "candidates" 
SET "city" = "location"
WHERE "location" IS NOT NULL;

-- Drop old location column
ALTER TABLE "candidates" DROP COLUMN "location";

