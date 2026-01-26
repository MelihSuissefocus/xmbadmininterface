import "server-only";

import { AzureOpenAI } from "openai";
import { z } from "zod";
import { cvLogger } from "./logger";
import type { PackedCvInput } from "./cv-pack";
import { CV_EXTRACTION_SYSTEM_PROMPT, buildUserPrompt, getMaxOutputTokens } from "./llm-prompts";
import { validateAndNormalizeLlmResponse, type LlmExtractionResponse } from "./llm-schema";

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

export class LlmExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "LlmExtractionError";
  }
}

function getConfig(): AzureOpenAIConfig | null {
  const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const rawKey = process.env.AZURE_OPENAI_KEY;
  const rawDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const rawApiVersion = process.env.AZURE_OPENAI_API_VERSION;

  cvLogger.info("Azure OpenAI env check", {
    action: "getConfig",
    hasEndpoint: !!rawEndpoint,
    endpointPreview: rawEndpoint ? rawEndpoint.substring(0, 40) + "..." : "MISSING",
    hasKey: !!rawKey,
    deployment: rawDeployment || "MISSING",
    apiVersion: rawApiVersion || "using-default",
  });

  const env = configSchema.safeParse({
    AZURE_OPENAI_ENDPOINT: rawEndpoint,
    AZURE_OPENAI_KEY: rawKey,
    AZURE_OPENAI_DEPLOYMENT: rawDeployment,
    AZURE_OPENAI_API_VERSION: rawApiVersion || "2024-12-01-preview",
  });

  if (!env.success) {
    cvLogger.warn("Azure OpenAI config validation failed", {
      action: "getConfig",
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

let clientInstance: AzureOpenAI | null = null;
let currentConfig: AzureOpenAIConfig | null = null;

function getClient(): AzureOpenAI | null {
  const config = getConfig();
  if (!config) {
    return null;
  }

  if (!clientInstance || currentConfig?.endpoint !== config.endpoint) {
    clientInstance = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
      deployment: config.deployment,
    });
    currentConfig = config;
  }

  return clientInstance;
}

export function isLlmConfigured(): boolean {
  return getConfig() !== null;
}

export function isLlmEnabled(): boolean {
  const enabled = process.env.CV_LLM_ENABLED;
  return enabled === "true" || enabled === "1";
}

const MAX_RETRIES = 1;  // Reduced to avoid Vercel function timeout
const INITIAL_BACKOFF_MS = 1000;
const TIMEOUT_MS = 60000;  // 60 seconds - Azure OpenAI can be slow on cold start

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LlmExtractionResult {
  success: boolean;
  data?: LlmExtractionResponse;
  flaggedFields: string[];
  error?: string;
  errorCode?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
}

export async function extractCandidateFieldsWithLLM(
  packedInput: PackedCvInput
): Promise<LlmExtractionResult> {
  const startTime = Date.now();

  if (!isLlmEnabled()) {
    return {
      success: false,
      flaggedFields: ["all"],
      error: "LLM extraction is disabled",
      errorCode: "LLM_DISABLED",
      latencyMs: Date.now() - startTime,
    };
  }

  const client = getClient();
  const config = getConfig();

  if (!client || !config) {
    cvLogger.error("Azure OpenAI not configured", { action: "extractCandidateFieldsWithLLM" });
    return {
      success: false,
      flaggedFields: ["all"],
      error: "Azure OpenAI not configured",
      errorCode: "LLM_NOT_CONFIGURED",
      latencyMs: Date.now() - startTime,
    };
  }

  const systemPrompt = CV_EXTRACTION_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(packedInput);

  // Log deployment info without triggering PII filter
  const deployLen = config.deployment.length;
  const deployPreview = deployLen > 4 
    ? `${config.deployment.slice(0, 3)}...${config.deployment.slice(-3)} (${deployLen} chars)` 
    : config.deployment;
  
  cvLogger.info("Starting LLM extraction", {
    action: "extractCandidateFieldsWithLLM",
    inputTokensEst: packedInput.estimated_tokens,
    sectionsCount: packedInput.sections.length,
    deploy: deployPreview,
    endpoint: new URL(config.endpoint).hostname,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      cvLogger.info("Retrying LLM extraction", { action: "extractCandidateFieldsWithLLM", attempt, backoffMs: backoff });
      await sleep(backoff);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await client.chat.completions.create(
        {
          model: config.deployment, // Pass deployment name as model for Azure OpenAI
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0,
          max_tokens: getMaxOutputTokens(),
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const content = response.choices[0]?.message?.content;
      const promptTokens = response.usage?.prompt_tokens;
      const completionTokens = response.usage?.completion_tokens;

      cvLogger.info("LLM extraction completed", {
        action: "extractCandidateFieldsWithLLM",
        promptTokens,
        completionTokens,
        durationMs: Date.now() - startTime,
      });

      if (!content) {
        throw new LlmExtractionError("Empty response from LLM", "EMPTY_RESPONSE", true);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        cvLogger.error("Failed to parse LLM JSON response", {
          action: "extractCandidateFieldsWithLLM",
          responseLength: content.length,
        });
        throw new LlmExtractionError("Invalid JSON response", "INVALID_JSON", true);
      }

      const validation = validateAndNormalizeLlmResponse(parsed);

      if (!validation.valid || !validation.data) {
        cvLogger.warn("LLM response validation failed", {
          action: "extractCandidateFieldsWithLLM",
          errors: validation.errors?.length,
        });
        return {
          success: false,
          flaggedFields: validation.flaggedFields,
          error: validation.errors?.join("; "),
          errorCode: "VALIDATION_FAILED",
          promptTokens,
          completionTokens,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        success: true,
        data: validation.data,
        flaggedFields: validation.flaggedFields,
        promptTokens,
        completionTokens,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error as Error;
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("abort") || message.includes("timeout")) {
        cvLogger.warn("LLM request timeout", { action: "extractCandidateFieldsWithLLM", attempt });
        continue;
      }

      if (message.includes("429") || message.includes("rate limit")) {
        cvLogger.warn("LLM rate limited", { action: "extractCandidateFieldsWithLLM", attempt });
        continue;
      }

      if (message.includes("401") || message.includes("403")) {
        cvLogger.error("LLM auth failed", { action: "extractCandidateFieldsWithLLM" });
        return {
          success: false,
          flaggedFields: ["all"],
          error: "Authentication failed",
          errorCode: "LLM_AUTH_FAILED",
          latencyMs: Date.now() - startTime,
        };
      }

      if (error instanceof LlmExtractionError && error.retryable) {
        continue;
      }

      break;
    }
  }

  cvLogger.error("LLM extraction failed after retries", {
    action: "extractCandidateFieldsWithLLM",
    lastError: lastError?.message,
  });

  return {
    success: false,
    flaggedFields: ["all"],
    error: "Extraction failed after retries",
    errorCode: "LLM_FAILED",
    latencyMs: Date.now() - startTime,
  };
}
