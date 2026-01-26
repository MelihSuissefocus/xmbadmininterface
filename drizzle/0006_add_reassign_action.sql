-- Migration: Add support for field reassignment in extraction feedback
-- Version: 0006
-- Description: Documents the addition of 'reassign' action type to cv_extraction_feedback
--              When action = 'reassign', the user_value column contains the new target field
--              formatted as 'REASSIGN:{newFieldName}'

-- The cv_extraction_feedback.action column already supports TEXT type,
-- so we can add 'reassign' as a new valid value without schema changes.

-- Add a comment to document the action column values
COMMENT ON COLUMN cv_extraction_feedback.action IS 
  'Action taken by user: confirm, edit, reject, or reassign. 
   For reassign: user_value contains REASSIGN:{newTargetField}';

-- Add an index to help query reassignment patterns for learning
CREATE INDEX IF NOT EXISTS idx_cv_extraction_feedback_reassign 
  ON cv_extraction_feedback(target_field, action) 
  WHERE action = 'reassign';
