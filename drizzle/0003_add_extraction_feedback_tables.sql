-- Migration: Add extraction feedback and synonym tables
-- Version: 0003

CREATE TABLE IF NOT EXISTS tenant_field_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  source_label TEXT NOT NULL,
  target_field TEXT NOT NULL,
  locale TEXT DEFAULT 'de',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_skill_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  alias TEXT NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cv_extraction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES cv_analysis_jobs(id) ON DELETE SET NULL,
  target_field TEXT NOT NULL,
  extracted_value TEXT,
  user_value TEXT,
  action TEXT NOT NULL,
  original_confidence INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_field_synonyms_lookup 
  ON tenant_field_synonyms(tenant_id, LOWER(source_label));
CREATE INDEX IF NOT EXISTS idx_tenant_skill_aliases_lookup 
  ON tenant_skill_aliases(tenant_id, LOWER(alias));
CREATE INDEX IF NOT EXISTS idx_cv_extraction_feedback_job 
  ON cv_extraction_feedback(job_id);

INSERT INTO tenant_field_synonyms (tenant_id, source_label, target_field, locale) VALUES
  ('00000000-0000-0000-0000-000000000000', 'vorname', 'firstName', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'first name', 'firstName', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'prénom', 'firstName', 'fr'),
  ('00000000-0000-0000-0000-000000000000', 'nachname', 'lastName', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'familienname', 'lastName', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'last name', 'lastName', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'surname', 'lastName', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'nom', 'lastName', 'fr'),
  ('00000000-0000-0000-0000-000000000000', 'nom de famille', 'lastName', 'fr'),
  ('00000000-0000-0000-0000-000000000000', 'email', 'email', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'e-mail', 'email', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'mail', 'email', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'telefon', 'phone', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'phone', 'phone', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'tel', 'phone', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'mobile', 'phone', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'handy', 'phone', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'téléphone', 'phone', 'fr'),
  ('00000000-0000-0000-0000-000000000000', 'adresse', 'street', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'strasse', 'street', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'straße', 'street', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'street', 'street', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'address', 'street', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'plz', 'postalCode', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'postleitzahl', 'postalCode', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'postal code', 'postalCode', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'zip', 'postalCode', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'zip code', 'postalCode', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'ort', 'city', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'stadt', 'city', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'wohnort', 'city', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'city', 'city', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'ville', 'city', 'fr'),
  ('00000000-0000-0000-0000-000000000000', 'kanton', 'canton', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'canton', 'canton', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'linkedin', 'linkedinUrl', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'linkedin url', 'linkedinUrl', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'position', 'targetRole', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'zielposition', 'targetRole', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'target role', 'targetRole', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'desired position', 'targetRole', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'beruf', 'targetRole', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'geburtsdatum', 'birthdate', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'date of birth', 'birthdate', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'birthday', 'birthdate', 'en'),
  ('00000000-0000-0000-0000-000000000000', 'nationalität', 'nationality', 'de'),
  ('00000000-0000-0000-0000-000000000000', 'nationality', 'nationality', 'en')
ON CONFLICT DO NOTHING;

