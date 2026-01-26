import "server-only";

import { AzureOpenAI } from "openai";
import { z } from "zod";
import { cvLogger } from "@/lib/logger";
import type { PackedCvInput, PackedLine } from "@/lib/cv-pack";
import {
  COGNITIVE_EXTRACTION_SYSTEM_PROMPT,
  buildCognitiveUserPrompt,
  buildValidationRetryPrompt,
  MAX_OUTPUT_TOKENS,
  type FewShotExample,
} from "./prompts";
import {
  validateCognitiveResponse,
  type CognitiveExtractionResponse,
  type ValidationResult,
  type UnmappedSegment,
} from "./schema";
import { FeedbackService, getFeedbackService } from "./feedback-service";
import { 
  CompletenessValidator, 
  type CompletenessReport 
} from "@/lib/cv-engine/completeness-validator";

const configSchema = z.object({
  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_KEY: z.string().min(1),
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1),
  AZURE_OPENAI_API_VERSION: z.string().default("2024-12-01-preview"),
});

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export class ExtractionEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "ExtractionEngineError";
  }
}

export interface ExtractionResult {
  success: boolean;
  thoughtProcess?: string;
  extractedData?: CognitiveExtractionResponse["extracted_data"];
  unmappedSegments: UnmappedSegment[];
  flaggedFields: string[];
  implicitMappingsApplied: string[];
  autoCorrections: Array<{
    field: string;
    original: unknown;
    corrected: unknown;
    reason: string;
  }>;
  warnings: string[];
  error?: string;
  errorCode?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  retryCount: number;
  /** Bericht über die Vollständigkeit der Extraktion */
  completenessReport?: CompletenessReport;
  /** Wurden alle Daten erfasst? */
  isDataComplete?: boolean;
}

export interface EngineConfig {
  tenantId?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  timeoutMs?: number;
  enableFeedbackLoop?: boolean;
  maxFewShotExamples?: number;
  /** Enable automatic re-extraction for missing data */
  enableAutoReExtraction?: boolean;
  /** Minimum completeness percentage before triggering re-extraction (0-100) */
  reExtractionThreshold?: number;
}

const DEFAULT_CONFIG: Required<EngineConfig> = {
  tenantId: "00000000-0000-0000-0000-000000000000",
  maxRetries: 2,
  enableAutoReExtraction: true,
  reExtractionThreshold: 95,
  initialBackoffMs: 1000,
  timeoutMs: 90000,
  enableFeedbackLoop: true,
  maxFewShotExamples: 5,
};

function getAzureConfig(): AzureOpenAIConfig | null {
  const env = configSchema.safeParse({
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
  });

  if (!env.success) {
    cvLogger.warn("Azure OpenAI config validation failed", {
      action: "getAzureConfig",
      errors: env.error.issues.map((i) => i.path.join(".")).join(", "),
    });
    return null;
  }

  return {
    endpoint: env.data.AZURE_OPENAI_ENDPOINT,
    apiKey: env.data.AZURE_OPENAI_KEY,
    deployment: env.data.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: env.data.AZURE_OPENAI_API_VERSION,
  };
}

export class CognitiveExtractionEngine {
  private config: Required<EngineConfig>;
  private azureConfig: AzureOpenAIConfig | null;
  private client: AzureOpenAI | null = null;
  private feedbackService: FeedbackService;
  private completenessValidator: CompletenessValidator;

  constructor(config: EngineConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.azureConfig = getAzureConfig();
    this.feedbackService = getFeedbackService({
      tenantId: this.config.tenantId,
      maxFewShotExamples: this.config.maxFewShotExamples,
    });
    this.completenessValidator = new CompletenessValidator();

    if (this.azureConfig) {
      this.client = new AzureOpenAI({
        endpoint: this.azureConfig.endpoint,
        apiKey: this.azureConfig.apiKey,
        apiVersion: this.azureConfig.apiVersion,
        deployment: this.azureConfig.deployment,
      });
    }
  }

  isConfigured(): boolean {
    return this.azureConfig !== null && this.client !== null;
  }

  isEnabled(): boolean {
    const enabled = process.env.CV_LLM_ENABLED;
    return enabled === "true" || enabled === "1";
  }

  getFeedbackService(): FeedbackService {
    return this.feedbackService;
  }

  async extract(packedInput: PackedCvInput): Promise<ExtractionResult> {
    const startTime = Date.now();
    let retryCount = 0;

    if (!this.isEnabled()) {
      return this.errorResult("LLM extraction is disabled", "LLM_DISABLED", startTime, 0);
    }

    if (!this.isConfigured() || !this.client || !this.azureConfig) {
      return this.errorResult("Azure OpenAI not configured", "LLM_NOT_CONFIGURED", startTime, 0);
    }

    let fewShotExamples: FewShotExample[] = [];
    let fieldAccuracies: Record<string, number> = {};
    let problemFields: string[] = [];

    if (this.config.enableFeedbackLoop) {
      try {
        const cvText = packedInput.sections.map((s) => s.lines.map((l) => l.text).join(" ")).join("\n");
        
        [fewShotExamples, fieldAccuracies, problemFields] = await Promise.all([
          this.feedbackService.getRelevantFewShotExamples(cvText),
          this.feedbackService.getFieldAccuracies(),
          this.feedbackService.getProblematicFields(),
        ]);

        cvLogger.info("Loaded feedback context", {
          action: "extract",
          fewShotCount: fewShotExamples.length,
          problemFieldsCount: problemFields.length,
          fieldAccuraciesCount: Object.keys(fieldAccuracies).length,
        });
      } catch (err) {
        cvLogger.warn("Failed to load feedback context, continuing without", {
          action: "extract",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const cvContent = JSON.stringify(packedInput, null, 2);
    const systemPrompt = COGNITIVE_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildCognitiveUserPrompt(cvContent, fewShotExamples, fieldAccuracies, problemFields);

    cvLogger.info("Starting cognitive extraction", {
      action: "extract",
      inputTokensEst: packedInput.estimated_tokens,
      sectionsCount: packedInput.sections.length,
      fewShotExamples: fewShotExamples.length,
      problemFields,
    });

    let lastError: Error | null = null;
    let lastResponse: string | null = null;
    let lastValidation: ValidationResult | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      retryCount = attempt;

      if (attempt > 0) {
        const backoff = this.config.initialBackoffMs * Math.pow(2, attempt - 1);
        cvLogger.info("Retrying extraction", { action: "extract", attempt, backoffMs: backoff });
        await this.sleep(backoff);
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const isValidationRetry =
          attempt > 0 && lastValidation && !lastValidation.valid && lastResponse;

        const messages: Array<{ role: "system" | "user"; content: string }> = [
          { role: "system", content: systemPrompt },
        ];

        if (isValidationRetry && lastResponse && lastValidation?.errors) {
          messages.push({ role: "user", content: userPrompt });
          messages.push({
            role: "user",
            content: buildValidationRetryPrompt(
              lastResponse,
              lastValidation.errors,
              lastValidation.warnings
            ),
          });
        } else {
          messages.push({ role: "user", content: userPrompt });
        }

        const response = await this.client.chat.completions.create(
          {
            model: this.azureConfig.deployment,
            messages,
            temperature: 0,
            max_tokens: MAX_OUTPUT_TOKENS,
            response_format: { type: "json_object" },
          },
          { signal: controller.signal }
        );

        clearTimeout(timeout);

        const content = response.choices[0]?.message?.content;
        const promptTokens = response.usage?.prompt_tokens;
        const completionTokens = response.usage?.completion_tokens;

        cvLogger.info("LLM response received", {
          action: "extract",
          attempt,
          promptTokens,
          completionTokens,
          durationMs: Date.now() - startTime,
        });

        if (!content) {
          lastError = new ExtractionEngineError("Empty response from LLM", "EMPTY_RESPONSE", true);
          continue;
        }

        lastResponse = content;

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          cvLogger.error("Failed to parse LLM JSON", {
            action: "extract",
            responseLength: content.length,
            preview: content.substring(0, 300),
          });
          lastError = new ExtractionEngineError("Invalid JSON response", "INVALID_JSON", true);
          continue;
        }

        const validation = validateCognitiveResponse(parsed);
        lastValidation = validation;

        if (!validation.valid || !validation.data) {
          cvLogger.warn("Validation failed", {
            action: "extract",
            attempt,
            errors: validation.errors,
          });

          if (attempt < this.config.maxRetries) {
            continue;
          }

          return {
            success: false,
            unmappedSegments: [],
            flaggedFields: validation.flaggedFields,
            implicitMappingsApplied: [],
            autoCorrections: [],
            warnings: validation.warnings,
            error: validation.errors.join("; "),
            errorCode: "VALIDATION_FAILED",
            promptTokens,
            completionTokens,
            latencyMs: Date.now() - startTime,
            retryCount,
          };
        }

        let data = validation.data;
        let totalPromptTokens = promptTokens;
        let totalCompletionTokens = completionTokens;

        // ───────────────────────────────────────────────────────────────────
        // COMPLETENESS VALIDATION & AUTO RE-EXTRACTION
        // ───────────────────────────────────────────────────────────────────
        
        const completenessReport = this.completenessValidator.validate(packedInput, data);
        let isDataComplete = completenessReport.isComplete;
        
        cvLogger.info("Completeness check", {
          action: "extract",
          completenessPercentage: completenessReport.completenessPercentage,
          missingLinesCount: completenessReport.missingLines.length,
          isComplete: isDataComplete,
        });
        
        // Auto Re-Extraction if enabled and needed
        const shouldReExtract = 
          this.config.enableAutoReExtraction &&
          !isDataComplete &&
          completenessReport.completenessPercentage < this.config.reExtractionThreshold &&
          completenessReport.missingLines.length > 0;
        
        if (shouldReExtract && this.client && this.azureConfig) {
          cvLogger.info("Starting auto re-extraction", {
            action: "extract",
            missingLinesCount: completenessReport.missingLines.length,
          });
          
          const reExtractResult = await this.performReExtraction(
            completenessReport.missingLines,
            data,
            systemPrompt
          );
          
          if (reExtractResult.success && reExtractResult.mergedData) {
            data = reExtractResult.mergedData;
            totalPromptTokens = (promptTokens ?? 0) + (reExtractResult.promptTokens ?? 0);
            totalCompletionTokens = (completionTokens ?? 0) + (reExtractResult.completionTokens ?? 0);
            
            // Re-validate completeness
            const newReport = this.completenessValidator.validate(packedInput, data);
            isDataComplete = newReport.isComplete;
            
            cvLogger.info("Re-extraction completed", {
              action: "extract",
              newCompletenessPercentage: newReport.completenessPercentage,
              isComplete: isDataComplete,
            });
          }
        }

        const thoughtPreview = data._thought_process.substring(0, 200);
        cvLogger.info("Cognitive extraction successful", {
          action: "extract",
          hasThoughtProcess: data._thought_process.length > 0,
          thoughtPreview: thoughtPreview + (data._thought_process.length > 200 ? "..." : ""),
          unmappedCount: data.unmapped_segments.length,
          implicitMappings: data.extraction_metadata?.implicit_mappings_applied || [],
          completenessPercentage: completenessReport.completenessPercentage,
        });

        const warnings = [
          ...validation.warnings,
          ...(data.extraction_metadata?.warnings || []),
        ];
        
        if (!isDataComplete) {
          warnings.push(`⚠️ ${completenessReport.missingLines.length} Zeilen wurden nicht verarbeitet`);
        }
        if (completenessReport.tokenLimitReached) {
          warnings.push(`⚠️ Token-Limit erreicht - prüfen Sie auf abgeschnittene Daten`);
        }

        return {
          success: true,
          thoughtProcess: data._thought_process,
          extractedData: data.extracted_data,
          unmappedSegments: data.unmapped_segments,
          flaggedFields: validation.flaggedFields,
          implicitMappingsApplied: data.extraction_metadata?.implicit_mappings_applied || [],
          autoCorrections: validation.autoCorrections,
          warnings,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          latencyMs: Date.now() - startTime,
          retryCount,
          completenessReport,
          isDataComplete,
        };
      } catch (error) {
        lastError = error as Error;
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes("abort") || message.includes("timeout")) {
          cvLogger.warn("Request timeout", { action: "extract", attempt });
          continue;
        }

        if (message.includes("429") || message.includes("rate limit")) {
          cvLogger.warn("Rate limited", { action: "extract", attempt });
          continue;
        }

        if (message.includes("401") || message.includes("403")) {
          cvLogger.error("Auth failed", { action: "extract" });
          return this.errorResult("Authentication failed", "LLM_AUTH_FAILED", startTime, retryCount);
        }

        if (error instanceof ExtractionEngineError && error.retryable) {
          continue;
        }

        break;
      }
    }

    cvLogger.error("Extraction failed after retries", {
      action: "extract",
      lastError: lastError?.message,
      retryCount,
    });

    return this.errorResult(
      "Extraction failed after retries",
      "LLM_FAILED",
      startTime,
      retryCount
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RE-EXTRACTION LOGIC
  // ─────────────────────────────────────────────────────────────────────────────

  private async performReExtraction(
    missingLines: CompletenessReport["missingLines"],
    originalData: CognitiveExtractionResponse,
    systemPrompt: string
  ): Promise<{
    success: boolean;
    mergedData?: CognitiveExtractionResponse;
    promptTokens?: number;
    completionTokens?: number;
    error?: string;
  }> {
    if (!this.client || !this.azureConfig) {
      return { success: false, error: "Client not configured" };
    }

    try {
      const reExtractionPrompt = this.buildReExtractionPrompt(missingLines);

      cvLogger.info("Performing re-extraction", {
        action: "performReExtraction",
        missingLinesCount: missingLines.length,
      });

      const response = await this.client.chat.completions.create({
        model: this.azureConfig.deployment,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: reExtractionPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { success: false, error: "Empty response" };
      }

      const parsed = JSON.parse(content);
      const mergedData = this.mergeExtractionResults(originalData, parsed);

      return {
        success: true,
        mergedData,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cvLogger.error("Re-extraction failed", {
        action: "performReExtraction",
        error: message,
      });
      return { success: false, error: message };
    }
  }

  private buildReExtractionPrompt(missingLines: CompletenessReport["missingLines"]): string {
    let prompt = `
═══════════════════════════════════════════════════════════════════════════════
⚠️ NACHEXTRAKTION - FEHLENDE DATEN
═══════════════════════════════════════════════════════════════════════════════

Bei der ersten Extraktion wurden die folgenden ${missingLines.length} Zeilen NICHT verarbeitet.
Analysiere sie JETZT und ordne sie entweder einem Feld zu oder füge sie zu unmapped_segments hinzu.

FEHLENDE ZEILEN:
`;

    for (const line of missingLines) {
      prompt += `\n[${line.lineId}] (Seite ${line.page}): "${line.text}"`;
      prompt += `\n  → Möglicher Grund: ${line.possibleReason}`;
    }

    prompt += `

═══════════════════════════════════════════════════════════════════════════════
ANWEISUNGEN:
═══════════════════════════════════════════════════════════════════════════════

1. Analysiere JEDE der oben genannten Zeilen in _thought_process
2. Für jede Zeile:
   - Wenn sie einem Feld zugeordnet werden kann → füge sie zu extracted_data hinzu (mit evidence)
   - Wenn nicht → füge sie zu unmapped_segments hinzu (mit lineReference!)
3. Gib NUR die neuen/zusätzlichen Extraktionen zurück

WICHTIG: JEDE der ${missingLines.length} Zeilen MUSS verarbeitet werden!

Antworte im JSON-Format mit _thought_process, extracted_data (nur neue), und unmapped_segments (nur neue).
`;

    return prompt;
  }

  private mergeExtractionResults(
    original: CognitiveExtractionResponse,
    reExtraction: Partial<CognitiveExtractionResponse>
  ): CognitiveExtractionResponse {
    const merged = structuredClone(original);

    // Append thought process
    if (reExtraction._thought_process) {
      merged._thought_process += `\n\n[RE-EXTRACTION]\n${reExtraction._thought_process}`;
    }

    // Merge unmapped segments
    if (reExtraction.unmapped_segments && Array.isArray(reExtraction.unmapped_segments)) {
      const existingLineRefs = new Set(
        merged.unmapped_segments.map((s) => s.line_reference).filter(Boolean)
      );

      for (const segment of reExtraction.unmapped_segments) {
        if (!segment.line_reference || !existingLineRefs.has(segment.line_reference)) {
          merged.unmapped_segments.push(segment);
        }
      }
    }

    // Merge extracted data
    if (reExtraction.extracted_data) {
      const reData = reExtraction.extracted_data;

      // Merge person evidence
      if (reData.person?.evidence) {
        const existingIds = new Set(merged.extracted_data.person.evidence.map((e) => e.lineId));
        for (const ev of reData.person.evidence) {
          if (!existingIds.has(ev.lineId)) {
            merged.extracted_data.person.evidence.push(ev);
          }
        }
        if (!merged.extracted_data.person.firstName && reData.person.firstName) {
          merged.extracted_data.person.firstName = reData.person.firstName;
        }
        if (!merged.extracted_data.person.lastName && reData.person.lastName) {
          merged.extracted_data.person.lastName = reData.person.lastName;
        }
      }

      // Merge contact evidence
      if (reData.contact?.evidence) {
        const existingIds = new Set(merged.extracted_data.contact.evidence.map((e) => e.lineId));
        for (const ev of reData.contact.evidence) {
          if (!existingIds.has(ev.lineId)) {
            merged.extracted_data.contact.evidence.push(ev);
          }
        }
        if (!merged.extracted_data.contact.email && reData.contact.email) {
          merged.extracted_data.contact.email = reData.contact.email;
        }
        if (!merged.extracted_data.contact.phone && reData.contact.phone) {
          merged.extracted_data.contact.phone = reData.contact.phone;
        }
      }

      // Merge languages
      if (reData.languages && Array.isArray(reData.languages)) {
        const existingLangs = new Set(
          merged.extracted_data.languages.map((l) => l.name.toLowerCase())
        );
        for (const lang of reData.languages) {
          if (!existingLangs.has(lang.name.toLowerCase())) {
            merged.extracted_data.languages.push(lang);
          }
        }
      }

      // Merge skills
      if (reData.skills && Array.isArray(reData.skills)) {
        const existingSkills = new Set(
          merged.extracted_data.skills.map((s) => s.name.toLowerCase())
        );
        for (const skill of reData.skills) {
          if (!existingSkills.has(skill.name.toLowerCase())) {
            merged.extracted_data.skills.push(skill);
          }
        }
      }

      // Merge experience
      if (reData.experience && Array.isArray(reData.experience)) {
        const existingKeys = new Set(
          merged.extracted_data.experience.map(
            (e) => `${(e.company || "").toLowerCase()}_${(e.title || "").toLowerCase()}`
          )
        );
        for (const exp of reData.experience) {
          const key = `${(exp.company || "").toLowerCase()}_${(exp.title || "").toLowerCase()}`;
          if (!existingKeys.has(key)) {
            merged.extracted_data.experience.push(exp);
          }
        }
      }

      // Merge education
      if (reData.education && Array.isArray(reData.education)) {
        const existingKeys = new Set(
          merged.extracted_data.education.map(
            (e) => `${(e.institution || "").toLowerCase()}_${(e.degree || "").toLowerCase()}`
          )
        );
        for (const edu of reData.education) {
          const key = `${(edu.institution || "").toLowerCase()}_${(edu.degree || "").toLowerCase()}`;
          if (!existingKeys.has(key)) {
            merged.extracted_data.education.push(edu);
          }
        }
      }
    }

    // Update metadata
    if (!merged.extraction_metadata) {
      merged.extraction_metadata = {};
    }
    merged.extraction_metadata.warnings = [
      ...(merged.extraction_metadata.warnings ?? []),
      "Re-extraction was performed to capture missing data",
    ];

    return merged;
  }

  private errorResult(
    message: string,
    code: string,
    startTime: number,
    retryCount: number
  ): ExtractionResult {
    return {
      success: false,
      unmappedSegments: [],
      flaggedFields: ["all"],
      implicitMappingsApplied: [],
      autoCorrections: [],
      warnings: [],
      error: message,
      errorCode: code,
      latencyMs: Date.now() - startTime,
      retryCount,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let engineInstance: CognitiveExtractionEngine | null = null;

export function getExtractionEngine(config?: EngineConfig): CognitiveExtractionEngine {
  if (!engineInstance) {
    engineInstance = new CognitiveExtractionEngine(config);
  }
  return engineInstance;
}

export async function extractWithCognitiveEngine(
  packedInput: PackedCvInput,
  config?: EngineConfig
): Promise<ExtractionResult> {
  const engine = getExtractionEngine(config);
  return engine.extract(packedInput);
}
