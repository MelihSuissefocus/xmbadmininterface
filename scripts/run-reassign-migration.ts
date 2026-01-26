import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  try {
    // Create index for reassignment queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_cv_extraction_feedback_reassign 
      ON cv_extraction_feedback(target_field, action) 
      WHERE action = 'reassign'
    `;
    console.log('✅ Index idx_cv_extraction_feedback_reassign erstellt');
    
    // Add comment to document the action column
    await sql`
      COMMENT ON COLUMN cv_extraction_feedback.action IS 
      'Action taken by user: confirm, edit, reject, or reassign. For reassign: user_value contains REASSIGN:{newTargetField}'
    `;
    console.log('✅ Kommentar zur action-Spalte hinzugefügt');
    
    console.log('\n🎉 Migration erfolgreich abgeschlossen!');
  } catch (error) {
    console.error('❌ Fehler:', error);
  }
}

runMigration();
