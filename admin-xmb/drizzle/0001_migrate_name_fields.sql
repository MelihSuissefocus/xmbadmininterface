-- Add new columns
ALTER TABLE "candidates" ADD COLUMN "first_name" text;
ALTER TABLE "candidates" ADD COLUMN "last_name" text;

-- Migrate existing data: split name on first space
UPDATE "candidates" 
SET 
  "first_name" = CASE 
    WHEN position(' ' in "name") > 0 THEN split_part("name", ' ', 1)
    ELSE "name"
  END,
  "last_name" = CASE 
    WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1)
    ELSE ''
  END;

-- Make columns NOT NULL
ALTER TABLE "candidates" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "candidates" ALTER COLUMN "last_name" SET NOT NULL;

-- Drop old column
ALTER TABLE "candidates" DROP COLUMN "name";

