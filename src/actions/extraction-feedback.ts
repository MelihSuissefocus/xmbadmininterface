"use server";

import { auth } from "@/auth";
import {
  FeedbackService,
  getFeedbackService,
  type CorrectionRecord,
  type UnmappedSegment,
} from "@/lib/extraction-engine";
import { cvLogger } from "@/lib/logger";
import { z } from "zod";

const CorrectionSchema = z.object({
  sourceContext: z.string().min(1, "Source context is required"),
  sourceLabel: z.string().nullable().optional(),
  wrongExtraction: z.string().nullable().optional(),
  correctValue: z.string().min(1, "Correct value is required"),
  correctField: z.string().min(1, "Correct field is required"),
  reasoning: z.string().nullable().optional(),
  cvHash: z.string().nullable().optional(),
});

const SegmentAssignmentSchema = z.object({
  segment: z.object({
    original_text: z.string().min(1),
    detected_type: z.enum(["date", "skill", "credential", "personal", "other"]),
    reason: z.string(),
    suggested_field: z.string().nullable(),
    confidence: z.number(),
    line_reference: z.string().nullable().optional(),
  }),
  assignedField: z.string().min(1),
  assignedValue: z.string().min(1),
  cvHash: z.string().nullable().optional(),
});

const FieldValidationSchema = z.object({
  fieldName: z.string().min(1),
  wasCorrect: z.boolean(),
});

const BatchCorrectionSchema = z.object({
  corrections: z.array(CorrectionSchema).min(1),
});

export interface FeedbackActionResult {
  success: boolean;
  message: string;
  id?: string;
  count?: number;
}

export async function saveExtractionCorrection(
  input: z.infer<typeof CorrectionSchema>
): Promise<FeedbackActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Nicht authentifiziert" };
    }

    const parsed = CorrectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: `Ungültige Eingabe: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const feedbackService = getFeedbackService();
    
    const record: CorrectionRecord = {
      sourceContext: parsed.data.sourceContext,
      sourceLabel: parsed.data.sourceLabel ?? undefined,
      wrongExtraction: parsed.data.wrongExtraction ?? undefined,
      correctValue: parsed.data.correctValue,
      correctField: parsed.data.correctField,
      reasoning: parsed.data.reasoning ?? undefined,
      cvHash: parsed.data.cvHash ?? undefined,
      userId: session.user.id,
    };

    const id = await feedbackService.recordCorrection(record);

    if (!id) {
      return { success: false, message: "Fehler beim Speichern der Korrektur" };
    }

    cvLogger.info("Extraction correction saved via action", {
      action: "saveExtractionCorrection",
      correctedField: parsed.data.correctField,
      userId: session.user.id,
    });

    return {
      success: true,
      message: "Korrektur gespeichert – das System lernt aus diesem Feedback",
      id,
    };
  } catch (error) {
    cvLogger.error("Failed to save extraction correction", {
      action: "saveExtractionCorrection",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: "Interner Fehler beim Speichern" };
  }
}

export async function saveSegmentAssignment(
  input: z.infer<typeof SegmentAssignmentSchema>
): Promise<FeedbackActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Nicht authentifiziert" };
    }

    const parsed = SegmentAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: `Ungültige Eingabe: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const feedbackService = getFeedbackService();
    
    const id = await feedbackService.recordSegmentAssignment({
      segment: parsed.data.segment as UnmappedSegment,
      assignedField: parsed.data.assignedField,
      assignedValue: parsed.data.assignedValue,
      cvHash: parsed.data.cvHash ?? undefined,
      userId: session.user.id,
    });

    if (!id) {
      return { success: false, message: "Fehler beim Speichern der Zuweisung" };
    }

    cvLogger.info("Segment assignment saved via action", {
      action: "saveSegmentAssignment",
      assignedField: parsed.data.assignedField,
      segmentType: parsed.data.segment.detected_type,
      userId: session.user.id,
    });

    return {
      success: true,
      message: "Zuweisung gespeichert – ähnliche Segmente werden zukünftig vorgeschlagen",
      id,
    };
  } catch (error) {
    cvLogger.error("Failed to save segment assignment", {
      action: "saveSegmentAssignment",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: "Interner Fehler beim Speichern" };
  }
}

export async function recordFieldValidation(
  input: z.infer<typeof FieldValidationSchema>
): Promise<FeedbackActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Nicht authentifiziert" };
    }

    const parsed = FieldValidationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: `Ungültige Eingabe: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const feedbackService = getFeedbackService();

    if (parsed.data.wasCorrect) {
      await feedbackService.recordSuccessfulExtraction(parsed.data.fieldName);
    }

    return {
      success: true,
      message: "Feedback aufgezeichnet",
    };
  } catch (error) {
    cvLogger.error("Failed to record field validation", {
      action: "recordFieldValidation",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: "Interner Fehler" };
  }
}

export async function batchSaveCorrections(
  input: z.infer<typeof BatchCorrectionSchema>
): Promise<FeedbackActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Nicht authentifiziert" };
    }

    const parsed = BatchCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: `Ungültige Eingabe: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const feedbackService = getFeedbackService();
    const userId = session.user.id;
    
    const records: CorrectionRecord[] = parsed.data.corrections.map((c) => ({
      sourceContext: c.sourceContext,
      sourceLabel: c.sourceLabel ?? undefined,
      wrongExtraction: c.wrongExtraction ?? undefined,
      correctValue: c.correctValue,
      correctField: c.correctField,
      reasoning: c.reasoning ?? undefined,
      cvHash: c.cvHash ?? undefined,
      userId,
    }));

    const savedCount = await feedbackService.batchRecordCorrections(records);

    cvLogger.info("Batch corrections saved", {
      action: "batchSaveCorrections",
      total: records.length,
      saved: savedCount,
      userId,
    });

    return {
      success: savedCount > 0,
      message: `${savedCount} von ${records.length} Korrekturen gespeichert`,
      count: savedCount,
    };
  } catch (error) {
    cvLogger.error("Failed to batch save corrections", {
      action: "batchSaveCorrections",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: "Interner Fehler beim Speichern" };
  }
}

export async function getExtractionMetrics(): Promise<{
  success: boolean;
  data?: {
    fieldAccuracies: Record<string, number>;
    problematicFields: string[];
  };
  message?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Nicht authentifiziert" };
    }

    const feedbackService = getFeedbackService();
    
    const [fieldAccuracies, problematicFields] = await Promise.all([
      feedbackService.getFieldAccuracies(),
      feedbackService.getProblematicFields(),
    ]);

    return {
      success: true,
      data: {
        fieldAccuracies,
        problematicFields,
      },
    };
  } catch (error) {
    cvLogger.error("Failed to get extraction metrics", {
      action: "getExtractionMetrics",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: "Fehler beim Laden der Metriken" };
  }
}

export async function getSuggestionsForUnmapped(segment: UnmappedSegment): Promise<{
  success: boolean;
  suggestions?: Array<{ field: string; confidence: number; reason: string }>;
  message?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Nicht authentifiziert" };
    }

    const feedbackService = getFeedbackService();
    const suggestions = await feedbackService.getSuggestionsForUnmapped(segment);

    return {
      success: true,
      suggestions,
    };
  } catch (error) {
    cvLogger.error("Failed to get suggestions for unmapped segment", {
      action: "getSuggestionsForUnmapped",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: "Fehler beim Laden der Vorschläge" };
  }
}
