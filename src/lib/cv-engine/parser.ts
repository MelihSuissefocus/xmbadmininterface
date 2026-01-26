/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CV PARSER - THE MAIN EXTRACTION ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This is the orchestrator that brings together all three pillars:
 * 1. Schema (Pillar 1) - For validation
 * 2. Feedback (Pillar 2) - For dynamic few-shot learning
 * 3. Prompts (Pillar 3) - For LLM interaction
 * 
 * FLOW:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 1. Receive CV text                                                          │
 * │    ↓                                                                        │
 * │ 2. Load relevant corrections from FeedbackService                           │
 * │    ↓                                                                        │
 * │ 3. Build dynamic prompt with past corrections                               │
 * │    ↓                                                                        │
 * │ 4. Call Azure OpenAI with response_format: { type: "json_object" }          │
 * │    ↓                                                                        │
 * │ 5. Validate response against CognitiveResponseSchema                        │
 * │    ↓                                                                        │
 * │ 6. Apply post-processing corrections (job title detection, etc.)            │
 * │    ↓                                                                        │
 * │ 7. Return typed CognitiveResponse                                           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ERROR HANDLING:
 * - Validation failures trigger automatic retry with error context
 * - Rate limits handled with exponential backoff
 * - Timeout protection prevents hanging requests
 * - All errors are typed and actionable
 */

import "server-only";

import { AzureOpenAI } from "openai";
import { z } from "zod";
import {
  type CognitiveResponse,
  type UnmappedSegment,
  validateCognitiveResponse,
} from "./schema";
import {
  CompletenessValidator,
  buildReExtractionPrompt,
  type CompletenessReport,
} from "./completeness-validator";
import type { PackedCvInput } from "@/lib/cv-pack";
import {
  FeedbackService,
  getFeedbackService,
  type FewShotExample,
} from "./feedback";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildRetryPrompt,
  MAX_OUTPUT_TOKENS,
  TEMPERATURE,
} from "./prompts";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Azure OpenAI configuration schema
 * Uses Zod for runtime validation of environment variables
 */
const AzureConfigSchema = z.object({
  AZURE_OPENAI_ENDPOINT: z.string().url("Invalid Azure OpenAI endpoint URL"),
  AZURE_OPENAI_KEY: z.string().min(1, "Azure OpenAI key is required"),
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1, "Deployment name is required"),
  AZURE_OPENAI_API_VERSION: z.string().default("2024-12-01-preview"),
});

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

/**
 * Parser configuration options
 */
export interface ParserConfig {
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  
  /** Maximum retry attempts for failed extractions */
  maxRetries?: number;
  
  /** Initial backoff in milliseconds */
  initialBackoffMs?: number;
  
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  
  /** Enable feedback loop (few-shot learning) */
  enableFeedbackLoop?: boolean;
  
  /** Maximum few-shot examples to include */
  maxFewShotExamples?: number;
  
  /** 
   * Enable automatic re-extraction for missing data
   * If completeness check fails, triggers a second LLM call for missed lines
   */
  enableAutoReExtraction?: boolean;
  
  /** Minimum completeness percentage before triggering re-extraction (0-100) */
  reExtractionThreshold?: number;
}

const DEFAULT_CONFIG: Required<ParserConfig> = {
  tenantId: "00000000-0000-0000-0000-000000000000",
  maxRetries: 2,
  initialBackoffMs: 1000,
  timeoutMs: 90000, // 90 seconds - Azure can be slow on cold start
  enableFeedbackLoop: true,
  maxFewShotExamples: 5,
  enableAutoReExtraction: true,  // Automatische Nachextraktion aktiviert
  reExtractionThreshold: 95,     // Unter 95% → Re-Extraction
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Successful extraction result
 */
export interface ParseSuccess {
  success: true;
  
  /** The LLM's reasoning process (for debugging/display) */
  thoughtProcess: string;
  
  /** The extracted, validated data */
  extractedData: CognitiveResponse["extracted_data"];
  
  /** Items that couldn't be mapped (for manual assignment UI) */
  unmappedSegments: UnmappedSegment[];
  
  /** Any post-processing corrections applied */
  autoCorrections: Array<{
    field: string;
    original: unknown;
    corrected: unknown;
    reason: string;
  }>;
  
  /** Implicit mappings that were applied */
  implicitMappings: string[];
  
  /** Any warnings generated */
  warnings: string[];
  
  /** Token usage stats */
  promptTokens?: number;
  completionTokens?: number;
  
  /** Total latency in milliseconds */
  latencyMs: number;
  
  /** Number of retry attempts */
  retryCount: number;
  
  /** 
   * COMPLETENESS GUARANTEE
   * Bericht über die Vollständigkeit der Extraktion
   */
  completenessReport?: CompletenessReport;
  
  /** Wurden alle Daten erfasst? */
  isDataComplete: boolean;
}

/**
 * Failed extraction result
 */
export interface ParseFailure {
  success: false;
  
  /** Error message */
  error: string;
  
  /** Error code for programmatic handling */
  errorCode: 
    | "LLM_DISABLED"
    | "LLM_NOT_CONFIGURED"
    | "VALIDATION_FAILED"
    | "LLM_AUTH_FAILED"
    | "LLM_TIMEOUT"
    | "LLM_RATE_LIMITED"
    | "LLM_ERROR";
  
  /** Validation errors if applicable */
  validationErrors?: string[];
  
  /** Fields that need manual review */
  flaggedFields: string[];
  
  /** Latency even for failures (for metrics) */
  latencyMs: number;
  
  /** Retry count at failure */
  retryCount: number;
}

export type ParseResult = ParseSuccess | ParseFailure;

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

export class ParserError extends Error {
  constructor(
    message: string,
    public readonly code: ParseFailure["errorCode"],
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "ParserError";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CV PARSER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class CvParser {
  private config: Required<ParserConfig>;
  private azureConfig: AzureConfig | null;
  private client: AzureOpenAI | null = null;
  private feedbackService: FeedbackService;
  private completenessValidator: CompletenessValidator;
  
  constructor(config: ParserConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.azureConfig = this.loadAzureConfig();
    this.feedbackService = getFeedbackService({
      tenantId: this.config.tenantId,
      maxExamples: this.config.maxFewShotExamples,
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
  
  /**
   * Load and validate Azure OpenAI configuration from environment
   */
  private loadAzureConfig(): AzureConfig | null {
    const result = AzureConfigSchema.safeParse({
      AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
      AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
      AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    });
    
    if (!result.success) {
      console.warn("[CvParser] Azure OpenAI config invalid:", result.error.issues);
      return null;
    }
    
    return {
      endpoint: result.data.AZURE_OPENAI_ENDPOINT,
      apiKey: result.data.AZURE_OPENAI_KEY,
      deployment: result.data.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: result.data.AZURE_OPENAI_API_VERSION,
    };
  }
  
  /**
   * Check if the parser is properly configured
   */
  isConfigured(): boolean {
    return this.azureConfig !== null && this.client !== null;
  }
  
  /**
   * Check if LLM extraction is enabled
   */
  isEnabled(): boolean {
    const enabled = process.env.CV_LLM_ENABLED;
    return enabled === "true" || enabled === "1";
  }
  
  /**
   * Get the feedback service for external access
   */
  getFeedbackService(): FeedbackService {
    return this.feedbackService;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN PARSE METHOD
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Parse a CV and extract structured data
   * 
   * This is the main entry point for CV extraction. It:
   * 1. Loads relevant few-shot examples from past corrections
   * 2. Builds a dynamic prompt
   * 3. Calls Azure OpenAI
   * 4. Validates and post-processes the response
   * 5. VALIDATES COMPLETENESS - ensures no data is lost!
   * 6. Returns typed, actionable results
   * 
   * @param cvText The raw CV text (or packed JSON string)
   * @param packedInput Optional: The original PackedCvInput for completeness validation
   * @returns ParseResult with either success data or failure info
   */
  async parse(cvText: string, packedInput?: PackedCvInput): Promise<ParseResult> {
    const startTime = Date.now();
    let retryCount = 0;
    
    // ─────────────────────────────────────────────────────────────────────────
    // PRE-FLIGHT CHECKS
    // ─────────────────────────────────────────────────────────────────────────
    
    if (!this.isEnabled()) {
      return this.failureResult(
        "LLM extraction is disabled (set CV_LLM_ENABLED=true)",
        "LLM_DISABLED",
        startTime,
        0
      );
    }
    
    if (!this.isConfigured() || !this.client || !this.azureConfig) {
      return this.failureResult(
        "Azure OpenAI not configured (check environment variables)",
        "LLM_NOT_CONFIGURED",
        startTime,
        0
      );
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // LOAD FEEDBACK CONTEXT (PILLAR 2)
    // ─────────────────────────────────────────────────────────────────────────
    
    let fewShotExamples: FewShotExample[] = [];
    let problematicFields: string[] = [];
    let pastCorrectionsPrompt = "";
    
    if (this.config.enableFeedbackLoop) {
      try {
        // Load relevant past corrections
        fewShotExamples = await this.feedbackService.getRelevantCorrections(cvText);
        
        // Get fields with low accuracy
        problematicFields = await this.feedbackService.getProblematicFields();
        
        // Format for prompt injection
        pastCorrectionsPrompt = this.feedbackService.formatExamplesForPrompt(fewShotExamples);
        
        console.log(`[CvParser] Loaded ${fewShotExamples.length} few-shot examples, ${problematicFields.length} problematic fields`);
      } catch (error) {
        console.warn("[CvParser] Failed to load feedback context, continuing without:", error);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // BUILD PROMPTS (PILLAR 3)
    // ─────────────────────────────────────────────────────────────────────────
    
    const systemPrompt = buildSystemPrompt(pastCorrectionsPrompt, problematicFields);
    const userPrompt = buildUserPrompt(cvText);
    
    // ─────────────────────────────────────────────────────────────────────────
    // EXTRACTION LOOP WITH RETRY
    // ─────────────────────────────────────────────────────────────────────────
    
    let lastError: Error | null = null;
    let lastResponse: string | null = null;
    let lastValidationErrors: string[] = [];
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      retryCount = attempt;
      
      // Exponential backoff for retries
      if (attempt > 0) {
        const backoff = this.config.initialBackoffMs * Math.pow(2, attempt - 1);
        console.log(`[CvParser] Retry ${attempt}, waiting ${backoff}ms`);
        await this.sleep(backoff);
      }
      
      try {
        // ───────────────────────────────────────────────────────────────────
        // CALL AZURE OPENAI
        // ───────────────────────────────────────────────────────────────────
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        
        // Build messages - include retry context if this is a retry
        const messages: Array<{ role: "system" | "user"; content: string }> = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];
        
        // If retrying due to validation error, add retry context
        if (attempt > 0 && lastResponse && lastValidationErrors.length > 0) {
          messages.push({
            role: "user",
            content: buildRetryPrompt(lastResponse, lastValidationErrors),
          });
        }
        
        const response = await this.client.chat.completions.create(
          {
            model: this.azureConfig.deployment,
            messages,
            temperature: TEMPERATURE,
            max_tokens: MAX_OUTPUT_TOKENS,
            response_format: { type: "json_object" }, // CRITICAL: Forces JSON output
          },
          { signal: controller.signal }
        );
        
        clearTimeout(timeout);
        
        const content = response.choices[0]?.message?.content;
        const promptTokens = response.usage?.prompt_tokens;
        const completionTokens = response.usage?.completion_tokens;
        
        console.log(`[CvParser] LLM response received, tokens: prompt=${promptTokens}, completion=${completionTokens}`);
        
        if (!content) {
          lastError = new ParserError("Empty response from LLM", "LLM_ERROR", true);
          continue;
        }
        
        lastResponse = content;
        
        // ───────────────────────────────────────────────────────────────────
        // PARSE JSON
        // ───────────────────────────────────────────────────────────────────
        
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch (jsonError) {
          console.error("[CvParser] JSON parse failed:", content.substring(0, 200));
          lastError = new ParserError("Invalid JSON in response", "LLM_ERROR", true);
          lastValidationErrors = ["Response is not valid JSON"];
          continue;
        }
        
        // ───────────────────────────────────────────────────────────────────
        // VALIDATE AGAINST SCHEMA (PILLAR 1)
        // ───────────────────────────────────────────────────────────────────
        
        const validation = validateCognitiveResponse(parsed);
        
        if (!validation.valid || !validation.data) {
          console.warn("[CvParser] Validation failed:", validation.errors);
          lastValidationErrors = validation.errors;
          
          // Retry if we haven't exhausted attempts
          if (attempt < this.config.maxRetries) {
            continue;
          }
          
          // Final failure
          return {
            success: false,
            error: "Response validation failed after retries",
            errorCode: "VALIDATION_FAILED",
            validationErrors: validation.errors,
            flaggedFields: ["all"],
            latencyMs: Date.now() - startTime,
            retryCount,
          };
        }
        
        // ───────────────────────────────────────────────────────────────────
        // SUCCESS! BUILD RESULT
        // ───────────────────────────────────────────────────────────────────
        
        const data = validation.data;
        
        // ───────────────────────────────────────────────────────────────────
        // COMPLETENESS VALIDATION - GARANTIE DASS KEINE DATEN VERLOREN GEHEN
        // ───────────────────────────────────────────────────────────────────
        
        let completenessReport: CompletenessReport | undefined;
        let isDataComplete = true;
        let reExtractionPerformed = false;
        let finalData = data;
        let totalPromptTokens = promptTokens;
        let totalCompletionTokens = completionTokens;
        
        if (packedInput) {
          completenessReport = this.completenessValidator.validate(packedInput, data);
          isDataComplete = completenessReport.isComplete;
          
          console.log(`[CvParser] Completeness: ${completenessReport.completenessPercentage}%`);
          
          // ───────────────────────────────────────────────────────────────────
          // AUTO RE-EXTRACTION FÜR FEHLENDE DATEN
          // ───────────────────────────────────────────────────────────────────
          
          const shouldReExtract = 
            this.config.enableAutoReExtraction &&
            !isDataComplete &&
            completenessReport.completenessPercentage < this.config.reExtractionThreshold &&
            completenessReport.missingLines.length > 0;
          
          if (shouldReExtract) {
            console.log(`[CvParser] 🔄 Starte Auto-Re-Extraction für ${completenessReport.missingLines.length} fehlende Zeilen...`);
            
            const reExtractResult = await this.performReExtraction(
              completenessReport.missingLines,
              data,
              systemPrompt
            );
            
            if (reExtractResult.success) {
              reExtractionPerformed = true;
              finalData = reExtractResult.mergedData;
              totalPromptTokens = (promptTokens ?? 0) + (reExtractResult.promptTokens ?? 0);
              totalCompletionTokens = (completionTokens ?? 0) + (reExtractResult.completionTokens ?? 0);
              
              // Re-validate completeness after re-extraction
              completenessReport = this.completenessValidator.validate(packedInput, finalData);
              isDataComplete = completenessReport.isComplete;
              
              console.log(`[CvParser] ✅ Re-Extraction abgeschlossen. Neue Vollständigkeit: ${completenessReport.completenessPercentage}%`);
            } else {
              console.warn(`[CvParser] ⚠️ Re-Extraction fehlgeschlagen: ${reExtractResult.error}`);
            }
          } else if (!isDataComplete) {
            console.warn(`[CvParser] ⚠️ UNVOLLSTÄNDIG: ${completenessReport.missingLines.length} Zeilen fehlen!`);
            console.warn(completenessReport.summary);
          }
          
          if (completenessReport.tokenLimitReached) {
            console.warn(`[CvParser] ⚠️ Token-Limit erreicht - möglicherweise Daten abgeschnitten!`);
          }
        }
        
        console.log(`[CvParser] Extraction successful!`);
        console.log(`  - Thought process: ${finalData._thought_process.substring(0, 100)}...`);
        console.log(`  - Unmapped segments: ${finalData.unmapped_segments.length}`);
        console.log(`  - Auto-corrections: ${validation.corrections.length}`);
        console.log(`  - Data complete: ${isDataComplete}`);
        console.log(`  - Re-extraction performed: ${reExtractionPerformed}`);
        
        const warnings = [
          ...(finalData.metadata?.warnings ?? []),
          ...validation.corrections.map(c => `Auto-corrected ${c.field}: ${c.reason}`),
        ];
        
        // Add completeness warnings
        if (completenessReport && !completenessReport.isComplete) {
          warnings.push(`⚠️ ${completenessReport.missingLines.length} Zeilen wurden nicht verarbeitet`);
        }
        if (completenessReport?.tokenLimitReached) {
          warnings.push(`⚠️ Token-Limit erreicht - prüfen Sie auf abgeschnittene Daten`);
        }
        if (reExtractionPerformed) {
          warnings.push(`ℹ️ Auto-Re-Extraction wurde durchgeführt`);
        }
        
        return {
          success: true,
          thoughtProcess: finalData._thought_process,
          extractedData: finalData.extracted_data,
          unmappedSegments: finalData.unmapped_segments,
          autoCorrections: validation.corrections,
          implicitMappings: finalData.metadata?.implicitMappingsApplied ?? [],
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
        
        // Handle specific error types
        if (message.includes("abort") || message.includes("timeout")) {
          console.warn("[CvParser] Request timeout");
          if (attempt < this.config.maxRetries) continue;
          return this.failureResult("Request timed out", "LLM_TIMEOUT", startTime, retryCount);
        }
        
        if (message.includes("429") || message.includes("rate limit")) {
          console.warn("[CvParser] Rate limited");
          if (attempt < this.config.maxRetries) continue;
          return this.failureResult("Rate limited", "LLM_RATE_LIMITED", startTime, retryCount);
        }
        
        if (message.includes("401") || message.includes("403")) {
          return this.failureResult("Authentication failed", "LLM_AUTH_FAILED", startTime, retryCount);
        }
        
        // Generic retryable error
        if (error instanceof ParserError && error.retryable && attempt < this.config.maxRetries) {
          continue;
        }
        
        break;
      }
    }
    
    // All retries exhausted
    return this.failureResult(
      lastError?.message ?? "Extraction failed after retries",
      "LLM_ERROR",
      startTime,
      retryCount
    );
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RE-EXTRACTION LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Re-Extraction Result Type
   */
  private async performReExtraction(
    missingLines: CompletenessReport["missingLines"],
    originalData: CognitiveResponse,
    systemPrompt: string
  ): Promise<{
    success: boolean;
    mergedData: CognitiveResponse;
    promptTokens?: number;
    completionTokens?: number;
    error?: string;
  }> {
    if (!this.client || !this.azureConfig) {
      return { success: false, mergedData: originalData, error: "Client not configured" };
    }
    
    try {
      // Build a focused prompt for just the missing lines
      const reExtractionUserPrompt = this.buildReExtractionPrompt(missingLines);
      
      console.log(`[CvParser] Re-Extraction: Verarbeite ${missingLines.length} fehlende Zeilen`);
      
      const reResponse = await this.client.chat.completions.create({
        model: this.azureConfig.deployment,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: reExtractionUserPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000, // Kleineres Limit für Nachextraktion
        response_format: { type: "json_object" },
      });
      
      const reContent = reResponse.choices[0]?.message?.content;
      if (!reContent) {
        return { success: false, mergedData: originalData, error: "Empty response" };
      }
      
      const reParsed = JSON.parse(reContent);
      const rePromptTokens = reResponse.usage?.prompt_tokens;
      const reCompletionTokens = reResponse.usage?.completion_tokens;
      
      // Merge the results
      const mergedData = this.mergeExtractionResults(originalData, reParsed);
      
      return {
        success: true,
        mergedData,
        promptTokens: rePromptTokens,
        completionTokens: reCompletionTokens,
      };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CvParser] Re-Extraction Fehler: ${message}`);
      return { success: false, mergedData: originalData, error: message };
    }
  }
  
  /**
   * Build a prompt specifically for re-extracting missing lines
   */
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
      prompt += `
[${line.lineId}] (Seite ${line.page}): "${line.text}"
  → Möglicher Grund: ${line.possibleReason}`;
    }

    prompt += `

═══════════════════════════════════════════════════════════════════════════════
ANWEISUNGEN:
═══════════════════════════════════════════════════════════════════════════════

1. Analysiere JEDE der oben genannten Zeilen in _thought_process
2. Für jede Zeile:
   - Wenn sie einem Feld zugeordnet werden kann → füge sie zu extracted_data hinzu (mit evidence)
   - Wenn nicht → füge sie zu unmapped_segments hinzu (mit lineReference!)
3. Gib NUR die neuen/zusätzlichen Extraktionen zurück, NICHT die bereits extrahierten Daten

WICHTIG: 
- JEDE der ${missingLines.length} Zeilen MUSS in deiner Antwort vorkommen
- Entweder als evidence in extracted_data ODER als lineReference in unmapped_segments
- Ignoriere KEINE Zeile!

Antworte im JSON-Format mit _thought_process, extracted_data (nur neue), und unmapped_segments (nur neue).
`;

    return prompt;
  }
  
  /**
   * Merge original extraction with re-extraction results
   */
  private mergeExtractionResults(
    original: CognitiveResponse,
    reExtraction: Partial<CognitiveResponse>
  ): CognitiveResponse {
    const merged = structuredClone(original);
    
    // Append thought process
    if (reExtraction._thought_process) {
      merged._thought_process += `\n\n[RE-EXTRACTION]\n${reExtraction._thought_process}`;
    }
    
    // Merge unmapped segments
    if (reExtraction.unmapped_segments && Array.isArray(reExtraction.unmapped_segments)) {
      const existingLineRefs = new Set(
        merged.unmapped_segments.map(s => s.lineReference).filter(Boolean)
      );
      
      for (const segment of reExtraction.unmapped_segments) {
        if (!segment.lineReference || !existingLineRefs.has(segment.lineReference)) {
          merged.unmapped_segments.push(segment);
        }
      }
    }
    
    // Merge extracted data (carefully, field by field)
    if (reExtraction.extracted_data) {
      const reData = reExtraction.extracted_data;
      
      // Merge person evidence
      if (reData.person?.evidence) {
        const existingEvidenceIds = new Set(merged.extracted_data.person.evidence.map(e => e.lineId));
        for (const ev of reData.person.evidence) {
          if (!existingEvidenceIds.has(ev.lineId)) {
            merged.extracted_data.person.evidence.push(ev);
          }
        }
        
        // Update null fields if re-extraction found values
        if (!merged.extracted_data.person.firstName && reData.person.firstName) {
          merged.extracted_data.person.firstName = reData.person.firstName;
        }
        if (!merged.extracted_data.person.lastName && reData.person.lastName) {
          merged.extracted_data.person.lastName = reData.person.lastName;
        }
      }
      
      // Merge contact evidence
      if (reData.contact?.evidence) {
        const existingEvidenceIds = new Set(merged.extracted_data.contact.evidence.map(e => e.lineId));
        for (const ev of reData.contact.evidence) {
          if (!existingEvidenceIds.has(ev.lineId)) {
            merged.extracted_data.contact.evidence.push(ev);
          }
        }
        
        // Update null fields
        if (!merged.extracted_data.contact.email && reData.contact.email) {
          merged.extracted_data.contact.email = reData.contact.email;
        }
        if (!merged.extracted_data.contact.phone && reData.contact.phone) {
          merged.extracted_data.contact.phone = reData.contact.phone;
        }
        if (!merged.extracted_data.contact.address && reData.contact.address) {
          merged.extracted_data.contact.address = reData.contact.address;
        }
      }
      
      // Merge languages (avoid duplicates)
      if (reData.languages && Array.isArray(reData.languages)) {
        const existingLangs = new Set(
          merged.extracted_data.languages.map(l => l.name.toLowerCase())
        );
        for (const lang of reData.languages) {
          if (!existingLangs.has(lang.name.toLowerCase())) {
            merged.extracted_data.languages.push(lang);
          }
        }
      }
      
      // Merge skills (avoid duplicates)
      if (reData.skills && Array.isArray(reData.skills)) {
        const existingSkills = new Set(
          merged.extracted_data.skills.map(s => s.name.toLowerCase())
        );
        for (const skill of reData.skills) {
          if (!existingSkills.has(skill.name.toLowerCase())) {
            merged.extracted_data.skills.push(skill);
          }
        }
      }
      
      // Merge experience (by company+title combination)
      if (reData.experience && Array.isArray(reData.experience)) {
        const existingExpKeys = new Set(
          merged.extracted_data.experience.map(e => 
            `${(e.company || '').toLowerCase()}_${(e.title || '').toLowerCase()}`
          )
        );
        for (const exp of reData.experience) {
          const key = `${(exp.company || '').toLowerCase()}_${(exp.title || '').toLowerCase()}`;
          if (!existingExpKeys.has(key)) {
            merged.extracted_data.experience.push(exp);
          }
        }
      }
      
      // Merge education (by institution+degree combination)
      if (reData.education && Array.isArray(reData.education)) {
        const existingEduKeys = new Set(
          merged.extracted_data.education.map(e => 
            `${(e.institution || '').toLowerCase()}_${(e.degree || '').toLowerCase()}`
          )
        );
        for (const edu of reData.education) {
          const key = `${(edu.institution || '').toLowerCase()}_${(edu.degree || '').toLowerCase()}`;
          if (!existingEduKeys.has(key)) {
            merged.extracted_data.education.push(edu);
          }
        }
      }
    }
    
    // Update metadata
    if (!merged.metadata) {
      merged.metadata = {};
    }
    merged.metadata.warnings = [
      ...(merged.metadata.warnings ?? []),
      "Re-extraction was performed to capture missing data",
    ];
    
    return merged;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Build a failure result object
   */
  private failureResult(
    error: string,
    code: ParseFailure["errorCode"],
    startTime: number,
    retryCount: number
  ): ParseFailure {
    return {
      success: false,
      error,
      errorCode: code,
      flaggedFields: ["all"],
      latencyMs: Date.now() - startTime,
      retryCount,
    };
  }
  
  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE & CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

let parserInstance: CvParser | null = null;

/**
 * Get the singleton CvParser instance
 */
export function getCvParser(config?: ParserConfig): CvParser {
  if (!parserInstance) {
    parserInstance = new CvParser(config);
  }
  return parserInstance;
}

/**
 * Convenience function to parse a CV
 * Creates/uses singleton parser internally
 * 
 * @param cvText The CV text to parse
 * @param packedInput Optional: PackedCvInput for completeness validation
 * @param config Optional: Parser configuration
 */
export async function parseCv(
  cvText: string, 
  packedInput?: PackedCvInput,
  config?: ParserConfig
): Promise<ParseResult> {
  const parser = getCvParser(config);
  return parser.parse(cvText, packedInput);
}

/**
 * Create a new parser instance (for testing or custom configs)
 */
export function createCvParser(config?: ParserConfig): CvParser {
  return new CvParser(config);
}

