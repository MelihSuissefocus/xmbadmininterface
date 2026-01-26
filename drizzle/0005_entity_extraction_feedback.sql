-- Production-grade Entity Extraction Engine - Feedback & Few-Shot Storage
-- Migration for self-learning CV extraction system

-- Store successful extraction corrections as few-shot examples
CREATE TABLE IF NOT EXISTS extraction_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    
    -- The raw text context that was ambiguous/misextracted
    source_context TEXT NOT NULL,
    source_label TEXT,
    
    -- What the LLM originally extracted
    extracted_value TEXT,
    extracted_field TEXT,
    
    -- What the user corrected it to
    corrected_value TEXT NOT NULL,
    corrected_field TEXT NOT NULL,
    
    -- Reasoning for why this correction was made (for CoT)
    correction_reason TEXT,
    
    -- Embedding for semantic similarity search (for RAG few-shot)
    context_embedding VECTOR(1536),
    
    -- Metadata
    cv_hash TEXT,
    locale TEXT DEFAULT 'de',
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for fast semantic similarity search
CREATE INDEX IF NOT EXISTS idx_extraction_corrections_embedding 
    ON extraction_corrections USING ivfflat (context_embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for tenant + field lookups
CREATE INDEX IF NOT EXISTS idx_extraction_corrections_tenant_field 
    ON extraction_corrections (tenant_id, corrected_field);

-- Index for source label lookups (for synonym matching)
CREATE INDEX IF NOT EXISTS idx_extraction_corrections_source_label 
    ON extraction_corrections (tenant_id, source_label);

-- Store unmapped segments that users manually assigned
CREATE TABLE IF NOT EXISTS unmapped_segment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    
    -- The segment that couldn't be mapped
    segment_text TEXT NOT NULL,
    segment_category TEXT,
    
    -- What field the user assigned it to
    assigned_field TEXT NOT NULL,
    assigned_value TEXT,
    
    -- Context for learning
    surrounding_context TEXT,
    cv_hash TEXT,
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_unmapped_segment_assignments_tenant 
    ON unmapped_segment_assignments (tenant_id, segment_category);

-- Track extraction quality metrics per field
CREATE TABLE IF NOT EXISTS extraction_field_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    field_name TEXT NOT NULL,
    
    -- Counters
    total_extractions INTEGER DEFAULT 0,
    correct_extractions INTEGER DEFAULT 0,
    corrected_extractions INTEGER DEFAULT 0,
    null_extractions INTEGER DEFAULT 0,
    
    -- Rolling accuracy (last 100)
    recent_accuracy NUMERIC(5,4),
    
    -- Last update
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(tenant_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_extraction_field_metrics_tenant 
    ON extraction_field_metrics (tenant_id);

-- Comment for documentation
COMMENT ON TABLE extraction_corrections IS 'Stores user corrections as few-shot examples for self-learning extraction';
COMMENT ON TABLE unmapped_segment_assignments IS 'Tracks how users assign unmapped CV segments to fields';
COMMENT ON TABLE extraction_field_metrics IS 'Per-field accuracy metrics for extraction quality monitoring';

