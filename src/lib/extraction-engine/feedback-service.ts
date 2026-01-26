import "server-only";

import { db } from "@/db";
import {
  extractionCorrections,
  unmappedSegmentAssignments,
  extractionFieldMetrics,
} from "@/db/schema";
import { eq, and, sql, desc, or, ilike } from "drizzle-orm";
import { cvLogger } from "@/lib/logger";
import type { FewShotExample } from "./prompts";
import type { UnmappedSegment } from "./schema";
import crypto from "crypto";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export interface FeedbackServiceConfig {
  tenantId?: string;
  maxFewShotExamples?: number;
  similarityThreshold?: number;
  enablePersistence?: boolean;
}

export interface CorrectionRecord {
  sourceContext: string;
  sourceLabel?: string;
  wrongExtraction?: string;
  correctValue: string;
  correctField: string;
  reasoning?: string;
  cvHash?: string;
  userId?: string;
}

export interface SegmentAssignmentRecord {
  segment: UnmappedSegment;
  assignedField: string;
  assignedValue: string;
  cvHash?: string;
  userId?: string;
}

export interface FieldStats {
  fieldName: string;
  totalExtractions: number;
  correctExtractions: number;
  accuracy: number;
  isProblematic: boolean;
}

export class FeedbackService {
  private tenantId: string;
  private maxFewShotExamples: number;
  private enablePersistence: boolean;

  private memoryCache: Map<string, FewShotExample[]> = new Map();
  private fieldStatsCache: Map<string, FieldStats> = new Map();
  private lastCacheRefresh: number = 0;
  private cacheRefreshInterval: number = 60000;

  constructor(config: FeedbackServiceConfig = {}) {
    this.tenantId = config.tenantId ?? DEFAULT_TENANT_ID;
    this.maxFewShotExamples = config.maxFewShotExamples ?? 5;
    this.enablePersistence = config.enablePersistence ?? true;
  }

  async getRelevantFewShotExamples(
    cvContext: string,
    targetFields?: string[]
  ): Promise<FewShotExample[]> {
    const examples: FewShotExample[] = [];
    const seenContexts = new Set<string>();

    try {
      const criticalFields = ["firstName", "lastName", "nationality", "email", "phone"];
      const fieldsToQuery = targetFields?.length ? targetFields : criticalFields;

      const fieldCorrections = await db
        .select({
          sourceContext: extractionCorrections.sourceContext,
          sourceLabel: extractionCorrections.sourceLabel,
          extractedValue: extractionCorrections.extractedValue,
          correctedValue: extractionCorrections.correctedValue,
          correctedField: extractionCorrections.correctedField,
          correctionReason: extractionCorrections.correctionReason,
          usageCount: extractionCorrections.usageCount,
        })
        .from(extractionCorrections)
        .where(
          and(
            eq(extractionCorrections.tenantId, this.tenantId),
            sql`${extractionCorrections.correctedField} = ANY(ARRAY[${sql.join(
              fieldsToQuery.map((f) => sql`${f}`),
              sql`, `
            )}]::text[])`
          )
        )
        .orderBy(desc(extractionCorrections.usageCount))
        .limit(this.maxFewShotExamples * 2);

      for (const corr of fieldCorrections) {
        const contextHash = this.hashContext(corr.sourceContext);
        if (!seenContexts.has(contextHash) && examples.length < this.maxFewShotExamples) {
          seenContexts.add(contextHash);
          examples.push({
            sourceContext: corr.sourceContext,
            sourceLabel: corr.sourceLabel,
            wrongExtraction: corr.extractedValue,
            correctValue: corr.correctedValue,
            correctField: corr.correctedField,
            reasoning: corr.correctionReason || "User correction",
          });
        }
      }

      if (examples.length < this.maxFewShotExamples && cvContext) {
        const keywords = this.extractKeywords(cvContext);
        
        if (keywords.length > 0) {
          const keywordPattern = keywords.slice(0, 5).join("|");
          
          const contextMatches = await db
            .select({
              sourceContext: extractionCorrections.sourceContext,
              sourceLabel: extractionCorrections.sourceLabel,
              extractedValue: extractionCorrections.extractedValue,
              correctedValue: extractionCorrections.correctedValue,
              correctedField: extractionCorrections.correctedField,
              correctionReason: extractionCorrections.correctionReason,
            })
            .from(extractionCorrections)
            .where(
              and(
                eq(extractionCorrections.tenantId, this.tenantId),
                sql`${extractionCorrections.sourceContext} ~* ${keywordPattern}`
              )
            )
            .limit(this.maxFewShotExamples - examples.length);

          for (const corr of contextMatches) {
            const contextHash = this.hashContext(corr.sourceContext);
            if (!seenContexts.has(contextHash)) {
              seenContexts.add(contextHash);
              examples.push({
                sourceContext: corr.sourceContext,
                sourceLabel: corr.sourceLabel,
                wrongExtraction: corr.extractedValue,
                correctValue: corr.correctedValue,
                correctField: corr.correctedField,
                reasoning: corr.correctionReason || "Similar context correction",
              });
            }
          }
        }
      }

      if (examples.length < 3) {
        const builtinExamples = this.getBuiltinFewShotExamples();
        for (const ex of builtinExamples) {
          if (examples.length >= this.maxFewShotExamples) break;
          const contextHash = this.hashContext(ex.sourceContext);
          if (!seenContexts.has(contextHash)) {
            seenContexts.add(contextHash);
            examples.push(ex);
          }
        }
      }

      cvLogger.debug("Retrieved few-shot examples", {
        action: "getRelevantFewShotExamples",
        count: examples.length,
        fromDb: examples.length - this.getBuiltinFewShotExamples().length,
      });

      return examples.slice(0, this.maxFewShotExamples);
    } catch (error) {
      cvLogger.error("Failed to get few-shot examples, using builtin fallback", {
        action: "getRelevantFewShotExamples",
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getBuiltinFewShotExamples().slice(0, this.maxFewShotExamples);
    }
  }

  async getFieldAccuracies(): Promise<Record<string, number>> {
    const now = Date.now();
    if (this.fieldStatsCache.size > 0 && now - this.lastCacheRefresh < this.cacheRefreshInterval) {
      const result: Record<string, number> = {};
      this.fieldStatsCache.forEach((stats, field) => {
        result[field] = stats.accuracy;
      });
      return result;
    }

    try {
      const metrics = await db
        .select({
          fieldName: extractionFieldMetrics.fieldName,
          totalExtractions: extractionFieldMetrics.totalExtractions,
          correctExtractions: extractionFieldMetrics.correctExtractions,
          correctedExtractions: extractionFieldMetrics.correctedExtractions,
        })
        .from(extractionFieldMetrics)
        .where(eq(extractionFieldMetrics.tenantId, this.tenantId));

      const accuracies: Record<string, number> = {};
      
      this.fieldStatsCache.clear();
      for (const m of metrics) {
        const total = m.totalExtractions ?? 0;
        const correct = m.correctExtractions ?? 0;
        const accuracy = total > 0 ? correct / total : 1;
        
        accuracies[m.fieldName] = accuracy;
        this.fieldStatsCache.set(m.fieldName, {
          fieldName: m.fieldName,
          totalExtractions: total,
          correctExtractions: correct,
          accuracy,
          isProblematic: accuracy < 0.8 && total >= 5,
        });
      }

      this.lastCacheRefresh = now;
      return accuracies;
    } catch (error) {
      cvLogger.error("Failed to get field accuracies", {
        action: "getFieldAccuracies",
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  async getProblematicFields(): Promise<string[]> {
    const accuracies = await this.getFieldAccuracies();
    const problematic: string[] = [];

    for (const [field, accuracy] of Object.entries(accuracies)) {
      const stats = this.fieldStatsCache.get(field);
      if (stats && stats.isProblematic) {
        problematic.push(field);
      }
    }

    const criticalFields = ["firstName", "lastName", "nationality"];
    for (const field of criticalFields) {
      if (!problematic.includes(field)) {
        const accuracy = accuracies[field];
        if (accuracy !== undefined && accuracy < 0.9) {
          problematic.push(field);
        }
      }
    }

    return problematic;
  }

  async recordCorrection(record: CorrectionRecord): Promise<string | null> {
    if (!this.enablePersistence) {
      cvLogger.debug("Persistence disabled, correction not saved", { action: "recordCorrection" });
      return null;
    }

    try {
      const [inserted] = await db
        .insert(extractionCorrections)
        .values({
          tenantId: this.tenantId,
          sourceContext: record.sourceContext,
          sourceLabel: record.sourceLabel ?? null,
          extractedValue: record.wrongExtraction ?? null,
          extractedField: record.correctField,
          correctedValue: record.correctValue,
          correctedField: record.correctField,
          correctionReason: record.reasoning ?? null,
          cvHash: record.cvHash ?? null,
          createdBy: record.userId ?? null,
        })
        .returning({ id: extractionCorrections.id });

      await this.updateFieldMetrics(record.correctField, false);

      this.lastCacheRefresh = 0;

      cvLogger.info("Correction recorded", {
        action: "recordCorrection",
        correctedField: record.correctField,
        id: inserted.id,
      });

      return inserted.id;
    } catch (error) {
      cvLogger.error("Failed to record correction", {
        action: "recordCorrection",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async recordSegmentAssignment(record: SegmentAssignmentRecord): Promise<string | null> {
    if (!this.enablePersistence) {
      return null;
    }

    try {
      const [inserted] = await db
        .insert(unmappedSegmentAssignments)
        .values({
          tenantId: this.tenantId,
          segmentText: record.segment.original_text,
          segmentCategory: record.segment.detected_type,
          assignedField: record.assignedField,
          assignedValue: record.assignedValue,
          surroundingContext: record.segment.reason,
          cvHash: record.cvHash ?? null,
          createdBy: record.userId ?? null,
        })
        .returning({ id: unmappedSegmentAssignments.id });

      cvLogger.info("Segment assignment recorded", {
        action: "recordSegmentAssignment",
        assignedField: record.assignedField,
        id: inserted.id,
      });

      return inserted.id;
    } catch (error) {
      cvLogger.error("Failed to record segment assignment", {
        action: "recordSegmentAssignment",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async recordSuccessfulExtraction(fieldName: string): Promise<void> {
    await this.updateFieldMetrics(fieldName, true);
  }

  async batchRecordCorrections(records: CorrectionRecord[]): Promise<number> {
    let successCount = 0;

    for (const record of records) {
      const id = await this.recordCorrection(record);
      if (id) successCount++;
    }

    return successCount;
  }

  async getSuggestionsForUnmapped(
    segment: UnmappedSegment
  ): Promise<Array<{ field: string; confidence: number; reason: string }>> {
    const suggestions: Array<{ field: string; confidence: number; reason: string }> = [];

    try {
      const pastAssignments = await db
        .select({
          assignedField: unmappedSegmentAssignments.assignedField,
          count: sql<number>`count(*)::int`,
        })
        .from(unmappedSegmentAssignments)
        .where(
          and(
            eq(unmappedSegmentAssignments.tenantId, this.tenantId),
            or(
              eq(unmappedSegmentAssignments.segmentCategory, segment.detected_type),
              sql`${unmappedSegmentAssignments.segmentText} % ${segment.original_text}`
            )
          )
        )
        .groupBy(unmappedSegmentAssignments.assignedField)
        .orderBy(sql`count(*) desc`)
        .limit(5);

      for (const past of pastAssignments) {
        suggestions.push({
          field: past.assignedField,
          confidence: Math.min(0.9, 0.5 + past.count * 0.1),
          reason: `Assigned ${past.count}x by users for similar segments`,
        });
      }
    } catch {
    }

    if (segment.suggested_field && !suggestions.some((s) => s.field === segment.suggested_field)) {
      suggestions.push({
        field: segment.suggested_field,
        confidence: segment.confidence,
        reason: "LLM suggestion",
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private async updateFieldMetrics(fieldName: string, wasCorrect: boolean): Promise<void> {
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
          nullExtractions: 0,
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

      this.lastCacheRefresh = 0;
    } catch (error) {
      cvLogger.error("Failed to update field metrics", {
        action: "updateFieldMetrics",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private hashContext(context: string): string {
    return crypto.createHash("md5").update(context.toLowerCase().trim()).digest("hex").substring(0, 16);
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "must", "shall", "can", "need", "dare",
      "und", "der", "die", "das", "ein", "eine", "ist", "sind", "war",
      "von", "mit", "für", "auf", "bei", "nach", "zu", "zur", "zum",
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 20);
  }

  private getBuiltinFewShotExamples(): FewShotExample[] {
    return [
      {
        sourceContext: "Senior Software Engineer\nMax Müller\nmax.mueller@email.com",
        sourceLabel: null,
        wrongExtraction: "Senior Software",
        correctValue: "Max",
        correctField: "firstName",
        reasoning: "'Senior Software Engineer' is a job title, not a name. The actual name 'Max Müller' appears on the next line.",
      },
      {
        sourceContext: "Ethnicity: Turkish\nLanguages: German (native), Turkish (native)",
        sourceLabel: "Ethnicity",
        wrongExtraction: null,
        correctValue: "Turkish",
        correctField: "nationality",
        reasoning: "Ethnicity 'Turkish' strongly implies Turkish nationality. This is an implicit mapping.",
      },
      {
        sourceContext: "Staatsangehörigkeit: Deutsch\nGeburtsdatum: 15.03.1990",
        sourceLabel: "Staatsangehörigkeit",
        wrongExtraction: null,
        correctValue: "German",
        correctField: "nationality",
        reasoning: "'Staatsangehörigkeit' is German for 'nationality'. Direct translation mapping.",
      },
      {
        sourceContext: "Name: Ali Yilmaz\nPosition: DevOps Engineer",
        sourceLabel: "Name",
        wrongExtraction: "Ali Yilmaz",
        correctValue: "Ali",
        correctField: "firstName",
        reasoning: "Full name must be split. 'Ali' is the first name, 'Yilmaz' is the last name.",
      },
      {
        sourceContext: "Herkunft: Italien\nWohnort: Zürich",
        sourceLabel: "Herkunft",
        wrongExtraction: null,
        correctValue: "Italian",
        correctField: "nationality",
        reasoning: "'Herkunft' (origin) from Italy implies Italian nationality.",
      },
    ];
  }
}

let feedbackServiceInstance: FeedbackService | null = null;

export function getFeedbackService(config?: FeedbackServiceConfig): FeedbackService {
  if (!feedbackServiceInstance) {
    feedbackServiceInstance = new FeedbackService(config);
  }
  return feedbackServiceInstance;
}

