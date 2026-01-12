DO $$ BEGIN
 CREATE TYPE "public"."company_type" AS ENUM('ag', 'gmbh', 'einzelunternehmen');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "candidates" ADD COLUMN "company_name" text;
ALTER TABLE "candidates" ADD COLUMN "company_type" "company_type";

