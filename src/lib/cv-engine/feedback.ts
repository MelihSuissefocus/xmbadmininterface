/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PILLAR 2: SELF-LEARNING FEEDBACK LOOP (RAG-Based)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURAL REASONING:
 * Fine-tuning LLMs is expensive and slow. Instead, we implement "Dynamic Few-Shot"
 * where corrections are stored and injected into prompts at runtime.
 * 
 * HOW IT WORKS:
 * 1. User corrects an extraction error in the UI
 * 2. Correction is saved as a "CorrectionVector" with context
 * 3. Before next extraction, we query for relevant past corrections
 * 4. Corrections are formatted as few-shot examples in the prompt
 * 5. LLM sees: "REMEMBER: When you see 'Ethnicity: X', map to nationality='X'"
 * 
 * BENEFITS:
 * - Zero fine-tuning cost
 * - Instant learning (next CV benefits immediately)
 * - Tenant-specific (each customer's corrections are isolated)
 * - Explainable (we can show users what the system learned)
 * 
 * FUTURE ENHANCEMENT:
 * Replace simple keyword matching with vector embeddings for semantic similarity.
 * For now, we use efficient text-based matching to stay cost-effective.
 */

import { db } from "@/db";
import {
  extractionCorrections,
  unmappedSegmentAssignments,
  extractionFieldMetrics,
} from "@/db/schema";
import { eq, and, sql, desc, or } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A correction vector captures everything needed to learn from a user correction
 */
export interface CorrectionVector {
  /** Unique identifier */
  id?: string;
  
  /** The text context where the error occurred */
  sourceContext: string;
  
  /** The label/field name seen in the CV (e.g., "Ethnicity") */
  sourceLabel?: string;
  
  /** What the LLM originally extracted (wrong) */
  wrongExtraction?: string;
  
  /** What the user corrected it to (right) */
  correctValue: string;
  
  /** Which field it should map to */
  correctField: string;
  
  /** User's explanation (optional, helps LLM understand) */
  reasoning?: string;
  
  /** Hash of CV for deduplication */
  cvHash?: string;
  
  /** User who made the correction */
  userId?: string;
  
  /** How many times this correction has been used in prompts */
  usageCount?: number;
}

/**
 * A formatted few-shot example ready for prompt injection
 */
export interface FewShotExample {
  /** The context where this pattern appears */
  context: string;
  
  /** What was wrong */
  wrong: string;
  
  /** What is correct */
  correct: string;
  
  /** The target field */
  field: string;
  
  /** Explanation for the LLM */
  explanation: string;
}

/**
 * Configuration for the FeedbackService
 */
export interface FeedbackServiceConfig {
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Maximum number of few-shot examples to inject */
  maxExamples?: number;
  
  /** Whether to persist to database (false for testing) */
  persistToDb?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK SERVICE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export class FeedbackService {
  private tenantId: string;
  private maxExamples: number;
  private persistToDb: boolean;
  
  /**
   * In-memory cache for frequently used corrections
   * Reduces DB queries for hot paths
   */
  private correctionCache: Map<string, CorrectionVector[]> = new Map();
  private cacheExpiry: number = 0;
  private cacheTTL: number = 60000; // 1 minute
  
  constructor(config: FeedbackServiceConfig = {}) {
    this.tenantId = config.tenantId ?? DEFAULT_TENANT_ID;
    this.maxExamples = config.maxExamples ?? 5;
    this.persistToDb = config.persistToDb ?? true;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SAVE CORRECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Save a user correction for future learning
   * 
   * This is called when:
   * 1. User edits an auto-filled field
   * 2. User drags an unmapped segment to a field
   * 3. User rejects an extraction and provides correct value
   * 
   * @param correction The correction data
   * @returns The saved correction ID, or null if save failed
   */
  async saveCorrection(correction: CorrectionVector): Promise<string | null> {
    // Invalidate cache when new correction is added
    this.cacheExpiry = 0;
    
    if (!this.persistToDb) {
      console.log("[FeedbackService] Mock save:", correction);
      return "mock-id-" + Date.now();
    }
    
    try {
      const [inserted] = await db
        .insert(extractionCorrections)
        .values({
          tenantId: this.tenantId,
          sourceContext: correction.sourceContext,
          sourceLabel: correction.sourceLabel ?? null,
          extractedValue: correction.wrongExtraction ?? null,
          extractedField: correction.correctField,
          correctedValue: correction.correctValue,
          correctedField: correction.correctField,
          correctionReason: correction.reasoning ?? null,
          cvHash: correction.cvHash ?? null,
          createdBy: correction.userId ?? null,
        })
        .returning({ id: extractionCorrections.id });
      
      // Also update field metrics to track accuracy
      await this.updateFieldAccuracy(correction.correctField, false);
      
      console.log(`[FeedbackService] Saved correction for field: ${correction.correctField}`);
      return inserted.id;
    } catch (error) {
      console.error("[FeedbackService] Failed to save correction:", error);
      return null;
    }
  }
  
  /**
   * Save when user assigns an unmapped segment to a field
   * This teaches the system how to handle similar unmapped items
   */
  async saveUnmappedAssignment(
    originalText: string,
    category: string,
    assignedField: string,
    assignedValue: string,
    userId?: string
  ): Promise<string | null> {
    if (!this.persistToDb) {
      console.log("[FeedbackService] Mock unmapped assignment:", { originalText, assignedField });
      return "mock-id-" + Date.now();
    }
    
    try {
      const [inserted] = await db
        .insert(unmappedSegmentAssignments)
        .values({
          tenantId: this.tenantId,
          segmentText: originalText,
          segmentCategory: category,
          assignedField,
          assignedValue,
          createdBy: userId ?? null,
        })
        .returning({ id: unmappedSegmentAssignments.id });
      
      return inserted.id;
    } catch (error) {
      console.error("[FeedbackService] Failed to save unmapped assignment:", error);
      return null;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RETRIEVE CORRECTIONS (FOR PROMPT INJECTION)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get relevant corrections to inject into the prompt
   * 
   * RETRIEVAL STRATEGY:
   * 1. First, get corrections for "problem fields" (low accuracy)
   * 2. Then, get corrections with similar context (keyword matching)
   * 3. Finally, pad with high-value generic corrections
   * 
   * @param cvContext The CV text being processed (for similarity matching)
   * @param targetFields Optional: prioritize corrections for these fields
   * @returns Array of formatted few-shot examples
   */
  async getRelevantCorrections(
    cvContext: string,
    targetFields?: string[]
  ): Promise<FewShotExample[]> {
    const examples: FewShotExample[] = [];
    const seenIds = new Set<string>();
    
    try {
      // Strategy 1: Get corrections for critical fields
      const criticalFields = targetFields ?? ["firstName", "lastName", "nationality", "email"];
      const fieldCorrections = await this.getCorrectionsForFields(criticalFields);
      
      for (const corr of fieldCorrections) {
        if (examples.length >= this.maxExamples) break;
        if (seenIds.has(corr.sourceContext)) continue;
        
        seenIds.add(corr.sourceContext);
        examples.push(this.formatCorrection(corr));
      }
      
      // Strategy 2: Get corrections with similar context
      if (examples.length < this.maxExamples) {
        const similarCorrections = await this.getCorrectionsWithSimilarContext(cvContext);
        
        for (const corr of similarCorrections) {
          if (examples.length >= this.maxExamples) break;
          if (seenIds.has(corr.sourceContext)) continue;
          
          seenIds.add(corr.sourceContext);
          examples.push(this.formatCorrection(corr));
        }
      }
      
      // Strategy 3: Add builtin high-value examples
      if (examples.length < this.maxExamples) {
        const builtins = this.getBuiltinExamples();
        
        for (const ex of builtins) {
          if (examples.length >= this.maxExamples) break;
          if (seenIds.has(ex.context)) continue;
          
          seenIds.add(ex.context);
          examples.push(ex);
        }
      }
    } catch (error) {
      console.error("[FeedbackService] Error retrieving corrections, using builtins:", error);
      return this.getBuiltinExamples().slice(0, this.maxExamples);
    }
    
    return examples;
  }
  
  /**
   * Get corrections for specific fields
   */
  private async getCorrectionsForFields(fields: string[]): Promise<CorrectionVector[]> {
    if (!this.persistToDb) {
      return [];
    }
    
    const results = await db
      .select({
        id: extractionCorrections.id,
        sourceContext: extractionCorrections.sourceContext,
        sourceLabel: extractionCorrections.sourceLabel,
        wrongExtraction: extractionCorrections.extractedValue,
        correctValue: extractionCorrections.correctedValue,
        correctField: extractionCorrections.correctedField,
        reasoning: extractionCorrections.correctionReason,
        usageCount: extractionCorrections.usageCount,
      })
      .from(extractionCorrections)
      .where(
        and(
          eq(extractionCorrections.tenantId, this.tenantId),
          sql`${extractionCorrections.correctedField} = ANY(ARRAY[${sql.join(
            fields.map(f => sql`${f}`),
            sql`, `
          )}]::text[])`
        )
      )
      .orderBy(desc(extractionCorrections.usageCount))
      .limit(this.maxExamples * 2);
    
    return results.map(r => ({
      id: r.id,
      sourceContext: r.sourceContext,
      sourceLabel: r.sourceLabel ?? undefined,
      wrongExtraction: r.wrongExtraction ?? undefined,
      correctValue: r.correctValue,
      correctField: r.correctField,
      reasoning: r.reasoning ?? undefined,
      usageCount: r.usageCount ?? 0,
    }));
  }
  
  /**
   * Get corrections with similar context (keyword-based)
   */
  private async getCorrectionsWithSimilarContext(context: string): Promise<CorrectionVector[]> {
    if (!this.persistToDb) {
      return [];
    }
    
    // Extract meaningful keywords from context
    const keywords = this.extractKeywords(context);
    if (keywords.length === 0) return [];
    
    // Build regex pattern for matching
    const pattern = keywords.slice(0, 5).join("|");
    
    const results = await db
      .select({
        id: extractionCorrections.id,
        sourceContext: extractionCorrections.sourceContext,
        sourceLabel: extractionCorrections.sourceLabel,
        wrongExtraction: extractionCorrections.extractedValue,
        correctValue: extractionCorrections.correctedValue,
        correctField: extractionCorrections.correctedField,
        reasoning: extractionCorrections.correctionReason,
      })
      .from(extractionCorrections)
      .where(
        and(
          eq(extractionCorrections.tenantId, this.tenantId),
          sql`${extractionCorrections.sourceContext} ~* ${pattern}`
        )
      )
      .limit(this.maxExamples);
    
    return results.map(r => ({
      id: r.id,
      sourceContext: r.sourceContext,
      sourceLabel: r.sourceLabel ?? undefined,
      wrongExtraction: r.wrongExtraction ?? undefined,
      correctValue: r.correctValue,
      correctField: r.correctField,
      reasoning: r.reasoning ?? undefined,
    }));
  }
  
  /**
   * Extract meaningful keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "have", "has",
      "und", "der", "die", "das", "ein", "eine", "ist", "sind", "von", "mit",
      "für", "auf", "bei", "nach", "zu", "zur", "zum", "in", "im", "an", "am",
    ]);
    
    return text
      .toLowerCase()
      .replace(/[^\w\sÄÖÜäöüß]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 20);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FORMATTING FOR PROMPT INJECTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Format a correction as a few-shot example
   */
  private formatCorrection(corr: CorrectionVector): FewShotExample {
    return {
      context: corr.sourceContext,
      wrong: corr.wrongExtraction ?? "null/missing",
      correct: corr.correctValue,
      field: corr.correctField,
      explanation: corr.reasoning ?? `User corrected this mapping`,
    };
  }
  
  /**
   * Format all examples into a string for prompt injection
   * 
   * Output format is designed to be clear and actionable for the LLM:
   * ```
   * ┌─────────────────────────────────────────────────────────────────────────────┐
   * │ CORRECTION #1                                                               │
   * ├─────────────────────────────────────────────────────────────────────────────┤
   * │ Context: "Senior Engineer\nMax Müller"                                      │
   * │ ❌ Wrong: "Senior Engineer" as firstName                                    │
   * │ ✅ Correct: firstName="Max", lastName="Müller"                              │
   * │ Reason: "Senior Engineer" is a job title, not a name                        │
   * └─────────────────────────────────────────────────────────────────────────────┘
   * ```
   */
  formatExamplesForPrompt(examples: FewShotExample[]): string {
    if (examples.length === 0) return "";
    
    let output = `
═══════════════════════════════════════════════════════════════════════════════
⚡ LEARNING FROM PAST CORRECTIONS - APPLY THESE PATTERNS! ⚡
═══════════════════════════════════════════════════════════════════════════════

The following corrections were made by users. You MUST apply these patterns:

`;
    
    for (let i = 0; i < examples.length; i++) {
      const ex = examples[i];
      output += `┌─────────────────────────────────────────────────────────────────────────────┐
│ CORRECTION #${i + 1}                                                               
├─────────────────────────────────────────────────────────────────────────────┤
│ Context: "${ex.context.substring(0, 60)}${ex.context.length > 60 ? "..." : ""}"
│ ❌ Wrong: ${ex.wrong}
│ ✅ Correct: ${ex.field}="${ex.correct}"
│ Reason: ${ex.explanation}
└─────────────────────────────────────────────────────────────────────────────┘

`;
    }
    
    return output;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FIELD ACCURACY TRACKING
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Update accuracy metrics for a field
   */
  private async updateFieldAccuracy(fieldName: string, wasCorrect: boolean): Promise<void> {
    if (!this.persistToDb) return;
    
    try {
      const existing = await db
        .select()
        .from(extractionFieldMetrics)
        .where(
          and(
            eq(extractionFieldMetrics.tenantId, this.tenantId),
            eq(extractionFieldMetrics.fieldName, fieldName)
          )
        )
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(extractionFieldMetrics).values({
          tenantId: this.tenantId,
          fieldName,
          totalExtractions: 1,
          correctExtractions: wasCorrect ? 1 : 0,
          correctedExtractions: wasCorrect ? 0 : 1,
        });
      } else {
        await db
          .update(extractionFieldMetrics)
          .set({
            totalExtractions: sql`${extractionFieldMetrics.totalExtractions} + 1`,
            correctExtractions: wasCorrect
              ? sql`${extractionFieldMetrics.correctExtractions} + 1`
              : extractionFieldMetrics.correctExtractions,
            correctedExtractions: !wasCorrect
              ? sql`${extractionFieldMetrics.correctedExtractions} + 1`
              : extractionFieldMetrics.correctedExtractions,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(extractionFieldMetrics.tenantId, this.tenantId),
              eq(extractionFieldMetrics.fieldName, fieldName)
            )
          );
      }
    } catch (error) {
      console.error("[FeedbackService] Failed to update field accuracy:", error);
    }
  }
  
  /**
   * Get fields with low accuracy (for prioritizing in prompts)
   */
  async getProblematicFields(): Promise<string[]> {
    if (!this.persistToDb) return ["firstName", "lastName", "nationality"];
    
    try {
      const metrics = await db
        .select({
          fieldName: extractionFieldMetrics.fieldName,
          total: extractionFieldMetrics.totalExtractions,
          correct: extractionFieldMetrics.correctExtractions,
        })
        .from(extractionFieldMetrics)
        .where(eq(extractionFieldMetrics.tenantId, this.tenantId));
      
      return metrics
        .filter(m => {
          const total = m.total ?? 0;
          const correct = m.correct ?? 0;
          return total >= 5 && (correct / total) < 0.8;
        })
        .map(m => m.fieldName);
    } catch (error) {
      return ["firstName", "lastName", "nationality"];
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BUILTIN EXAMPLES (ALWAYS AVAILABLE)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * High-value examples that are always available
   * These encode our most important extraction rules
   */
  private getBuiltinExamples(): FewShotExample[] {
    return [
      {
        context: "Senior Software Engineer\nMax Müller\nmax.mueller@example.com",
        wrong: "firstName='Senior', lastName='Software Engineer'",
        correct: "Max",
        field: "firstName",
        explanation: "'Senior Software Engineer' is a JOB TITLE, not a name. The actual name 'Max Müller' appears on the next line. Split as firstName='Max', lastName='Müller'.",
      },
      {
        context: "Ethnicity: Turkish\nLanguages: German (native), Turkish (fluent)",
        wrong: "nationality=null (field not found)",
        correct: "Turkish",
        field: "nationality",
        explanation: "IMPLICIT MAPPING: 'Ethnicity: Turkish' strongly implies Turkish nationality. When you see Ethnicity, map the value to nationality.",
      },
      {
        context: "Staatsangehörigkeit: Deutsch\nGeburtsdatum: 15.03.1990",
        wrong: "nationality=null",
        correct: "German",
        field: "nationality",
        explanation: "'Staatsangehörigkeit' is German for 'nationality'. This is a direct translation mapping.",
      },
      {
        context: "Herkunft: Italien\nWohnort: Zürich, Schweiz",
        wrong: "nationality=null",
        correct: "Italian",
        field: "nationality",
        explanation: "'Herkunft' (origin) from Italy implies Italian nationality. This is an implicit mapping.",
      },
      {
        context: "Name: Ali Yilmaz\nBeruf: DevOps Engineer\nEmail: ali@example.com",
        wrong: "firstName='Ali Yilmaz'",
        correct: "Ali",
        field: "firstName",
        explanation: "Full name must be split. 'Ali' is the first name (given name), 'Yilmaz' is the last name (family name).",
      },
    ];
  }
  
  /**
   * Record that an extraction was correct (no correction needed)
   * This helps improve accuracy metrics
   */
  async recordCorrectExtraction(fieldName: string): Promise<void> {
    await this.updateFieldAccuracy(fieldName, true);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let feedbackServiceInstance: FeedbackService | null = null;

/**
 * Get the singleton FeedbackService instance
 */
export function getFeedbackService(config?: FeedbackServiceConfig): FeedbackService {
  if (!feedbackServiceInstance) {
    feedbackServiceInstance = new FeedbackService(config);
  }
  return feedbackServiceInstance;
}

/**
 * Create a new FeedbackService instance (for testing)
 */
export function createFeedbackService(config?: FeedbackServiceConfig): FeedbackService {
  return new FeedbackService(config);
}

