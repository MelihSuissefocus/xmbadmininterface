-- Migration: Add cv_analysis_jobs table for async CV processing
-- Version: 0002

DO $$ BEGIN
  CREATE TYPE cv_analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS cv_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status cv_analysis_status NOT NULL DEFAULT 'pending',
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cv_analysis_jobs_user_id ON cv_analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_analysis_jobs_status ON cv_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cv_analysis_jobs_created_at ON cv_analysis_jobs(created_at DESC);

