import "server-only";

import type { DocumentRep, CandidateAutoFillDraftV2, ExtractedFieldWithEvidence, FieldEvidence } from "./types";
import { CV_EXTRACTION_VERSION } from "./types";
import { packCvForLLM, type PackedCvInput, type PackedLine } from "@/lib/cv-pack";
import { extractCandidateFieldsWithLLM, isLlmEnabled, isLlmConfigured, type LlmExtractionResult } from "@/lib/azure-openai";
import { type LlmExtractionResponse, type LlmEvidence } from "@/lib/llm-schema";
import { validateEmail, normalizePhoneE164 } from "./validation";
import { defaultFactors, calculateConfidence, getConfidenceLevel } from "./confidence";
import { cvLogger } from "@/lib/logger";
import { mapLlmResponseToParsedCv, validateParsedCv, parsedCvToDraftV2 } from "@/lib/cv-parser";

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;

interface DeterministicExtraction {
  email?: { value: string; evidence: FieldEvidence };
  phone?: { value: string; evidence: FieldEvidence };
  linkedinUrl?: { value: string; evidence: FieldEvidence };
}

function extractDeterministicFields(docRep: DocumentRep): DeterministicExtraction {
  const result: DeterministicExtraction = {};

  for (const page of docRep.pages) {
    for (const line of page.lines) {
      const text = line.text;

      if (!result.email) {
        const emailMatch = text.match(EMAIL_PATTERN);
        if (emailMatch) {
          const emailResult = validateEmail(emailMatch[0]);
          if (emailResult.valid) {
            result.email = {
              value: emailResult.normalized!,
              evidence: {
                page: page.pageNumber,
                polygon: line.polygon,
                exactText: emailMatch[0],
                confidence: line.confidence,
              },
            };
          }
        }
      }

      if (!result.phone) {
        const phoneMatch = text.match(PHONE_PATTERN);
        if (phoneMatch) {
          const phoneResult = normalizePhoneE164(phoneMatch[0], "CH");
          if (phoneResult.valid) {
            result.phone = {
              value: phoneResult.normalized!,
              evidence: {
                page: page.pageNumber,
                polygon: line.polygon,
                exactText: phoneMatch[0],
                confidence: line.confidence,
              },
            };
          }
        }
      }

      if (!result.linkedinUrl && text.toLowerCase().includes("linkedin.com")) {
        const urlMatch = text.match(/https?:\/\/[^\s]+linkedin[^\s]+/i) || 
                        text.match(/linkedin\.com\/in\/[^\s]+/i);
        if (urlMatch) {
          result.linkedinUrl = {
            value: urlMatch[0],
            evidence: {
              page: page.pageNumber,
              polygon: line.polygon,
              exactText: urlMatch[0],
              confidence: line.confidence,
            },
          };
        }
      }
    }
  }

  return result;
}

function findLineFromEvidence(
  packedInput: PackedCvInput,
  evidence: LlmEvidence
): PackedLine | undefined {
  for (const hl of packedInput.header_lines) {
    if (hl.lineId === evidence.lineId) return hl;
  }
  for (const cl of packedInput.contact_lines) {
    if (cl.lineId === evidence.lineId) return cl;
  }
  for (const section of packedInput.sections) {
    for (const sl of section.lines) {
      if (sl.lineId === evidence.lineId) return sl;
    }
  }
  return undefined;
}

function llmEvidenceToFieldEvidence(
  evidence: LlmEvidence[],
  packedInput: PackedCvInput,
  baseConfidence: number
): FieldEvidence {
  if (evidence.length === 0) {
    return {
      page: 1,
      exactText: "",
      confidence: 0,
    };
  }

  const firstEvidence = evidence[0];
  const line = findLineFromEvidence(packedInput, firstEvidence);

  return {
    page: firstEvidence.page,
    exactText: firstEvidence.text || line?.text || "",
    confidence: line?.confidence ?? baseConfidence,
  };
}

function computeFieldScore(
  hasEvidence: boolean,
  evidenceCount: number,
  isFlagged: boolean,
  isValidated: boolean
): { score: number; status: "autofill" | "review" | "skip" } {
  // CRITICAL FIX: NEVER skip fields with a value!
  // Even without evidence, if we have data, it should go to review
  if (!hasEvidence) {
    // Changed from skip to review - let the user decide!
    return { score: 0.3, status: "review" };
  }

  let score = 0.75;

  if (evidenceCount > 1) {
    score += 0.05;
  }

  if (isValidated) {
    score += 0.15;
  } else {
    score -= 0.1;
  }

  if (isFlagged) {
    score = Math.min(score, 0.85);
  }

  score = Math.max(0, Math.min(1, score));

  if (score >= 0.90) {
    return { score, status: "autofill" };
  } else {
    // CRITICAL FIX: Changed threshold from 0.70 to 0.30
    // NEVER skip data - if we have it, let the user review it!
    return { score, status: "review" };
  }
}

function buildDraftFromLlmResult(
  llmResult: LlmExtractionResponse,
  packedInput: PackedCvInput,
  deterministicFields: DeterministicExtraction,
  fileName: string,
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx",
  fileSize: number,
  pageCount: number,
  processingTimeMs: number
): CandidateAutoFillDraftV2 {
  // ── Step 1: Use cv-parser for normalized extraction ─────────────────
  const parsedCv = mapLlmResponseToParsedCv(llmResult);
  const { data: validated } = validateParsedCv(parsedCv);

  // ── Step 2: Build draft with evidence from LLM ──────────────────────
  const filledFields: ExtractedFieldWithEvidence[] = [];
  const ambiguousFields: CandidateAutoFillDraftV2["ambiguousFields"] = [];
  const flaggedFields = new Set(llmResult.metadata.needs_review_fields);

  // Helper to get evidence for a field
  const getEvidence = (evidenceArr: LlmEvidence[], fallbackConfidence = 0.8): FieldEvidence => {
    return llmEvidenceToFieldEvidence(evidenceArr, packedInput, fallbackConfidence);
  };

  // Helper to add a field with confidence scoring
  const addField = (
    targetField: string,
    value: unknown,
    evidenceArr: LlmEvidence[],
    isValidated = true
  ) => {
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value) && value.length === 0) return;

    const hasEvidence = evidenceArr.length > 0;
    const isFlagged = flaggedFields.has(targetField);
    const { score, status } = computeFieldScore(hasEvidence, evidenceArr.length, isFlagged, isValidated);
    const evidence = getEvidence(evidenceArr, score);

    if (status === "autofill") {
      filledFields.push({ targetField, extractedValue: value, confidence: getConfidenceLevel(score), evidence });
    } else {
      ambiguousFields.push({
        extractedLabel: targetField,
        extractedValue: typeof value === "string" ? value : JSON.stringify(value),
        suggestedTargets: [{ targetField, confidence: getConfidenceLevel(score), reason: "LLM extraction" }],
        evidence,
      });
    }
  };

  // ── Deterministic fields override LLM for email/phone/linkedin ──────
  if (deterministicFields.email) {
    filledFields.push({
      targetField: "email",
      extractedValue: deterministicFields.email.value,
      confidence: "high",
      evidence: deterministicFields.email.evidence,
    });
  } else if (validated.email) {
    addField("email", validated.email, llmResult.contact.evidence);
  }

  if (deterministicFields.phone) {
    filledFields.push({
      targetField: "phone",
      extractedValue: deterministicFields.phone.value,
      confidence: "high",
      evidence: deterministicFields.phone.evidence,
    });
  } else if (validated.phone) {
    addField("phone", validated.phone, llmResult.contact.evidence);
  }

  if (deterministicFields.linkedinUrl) {
    filledFields.push({
      targetField: "linkedinUrl",
      extractedValue: deterministicFields.linkedinUrl.value,
      confidence: "high",
      evidence: deterministicFields.linkedinUrl.evidence,
    });
  } else if (validated.linkedin_url) {
    filledFields.push({
      targetField: "linkedinUrl",
      extractedValue: validated.linkedin_url,
      confidence: "medium",
      evidence: getEvidence(llmResult.contact.evidence, 0.8),
    });
  }

  // ── Person name (with cleaned titles) ───────────────────────────────
  if (validated.first_name) {
    addField("firstName", validated.first_name, llmResult.person.evidence, !flaggedFields.has("firstName"));
  } else if (flaggedFields.has("firstName")) {
    ambiguousFields.push({
      extractedLabel: "firstName",
      extractedValue: "",
      suggestedTargets: [{ targetField: "firstName", confidence: "low", reason: "Konnte nicht ermittelt werden - bitte manuell eingeben" }],
      evidence: { page: 1, exactText: "", confidence: 0 },
    });
  }

  if (validated.last_name) {
    addField("lastName", validated.last_name, llmResult.person.evidence, !flaggedFields.has("lastName"));
  } else if (flaggedFields.has("lastName")) {
    ambiguousFields.push({
      extractedLabel: "lastName",
      extractedValue: "",
      suggestedTargets: [{ targetField: "lastName", confidence: "low", reason: "Konnte nicht ermittelt werden - bitte manuell eingeben" }],
      evidence: { page: 1, exactText: "", confidence: 0 },
    });
  }

  // ── Address (with canton normalization) ─────────────────────────────
  if (llmResult.contact.address) {
    const addrEvidence = llmResult.contact.address.evidence || llmResult.contact.evidence;
    if (validated.street) {
      filledFields.push({ targetField: "street", extractedValue: validated.street, confidence: "medium", evidence: getEvidence(addrEvidence, 0.8) });
    }
    if (validated.postal_code) {
      filledFields.push({ targetField: "postalCode", extractedValue: validated.postal_code, confidence: "medium", evidence: getEvidence(addrEvidence, 0.8) });
    }
    if (validated.city) {
      filledFields.push({ targetField: "city", extractedValue: validated.city, confidence: "medium", evidence: getEvidence(addrEvidence, 0.8) });
    }
    if (validated.canton) {
      filledFields.push({ targetField: "canton", extractedValue: validated.canton, confidence: "medium", evidence: getEvidence(addrEvidence, 0.7) });
    }
  }

  // ── Languages (with normalized levels) ──────────────────────────────
  if (validated.languages.length > 0) {
    const firstWithEvidence = llmResult.languages.find((l) => l.evidence.length > 0);
    const evidence = firstWithEvidence
      ? getEvidence(firstWithEvidence.evidence, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "languages",
      extractedValue: validated.languages,
      confidence: "medium",
      evidence,
    });
  }

  // ── Skills (normalized & deduplicated) ──────────────────────────────
  if (validated.skills.length > 0) {
    const firstWithEvidence = llmResult.skills.find((s) => s.evidence.length > 0);
    const evidence = firstWithEvidence
      ? getEvidence(firstWithEvidence.evidence, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "skills",
      extractedValue: validated.skills,
      confidence: "medium",
      evidence,
    });
  }

  // ── Work experience (with parsed dates) ─────────────────────────────
  if (validated.work_experience.length > 0) {
    const firstWithEvidence = llmResult.experience.find((e) => e.evidence.length > 0);
    const evidence = firstWithEvidence
      ? getEvidence(firstWithEvidence.evidence, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "experience",
      extractedValue: validated.work_experience,
      confidence: "medium",
      evidence,
    });
  }

  // ── Education (with parsed dates) ───────────────────────────────────
  if (validated.education.length > 0) {
    const firstWithEvidence = llmResult.education.find((e) => e.evidence.length > 0);
    const evidence = firstWithEvidence
      ? getEvidence(firstWithEvidence.evidence, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "education",
      extractedValue: validated.education,
      confidence: "medium",
      evidence,
    });
  }

  // ── Target position ─────────────────────────────────────────────────
  if (validated.target_position) {
    filledFields.push({
      targetField: "targetRole",
      extractedValue: validated.target_position,
      confidence: "medium",
      evidence: { page: 1, exactText: validated.target_position, confidence: 0.7 },
    });
  }

  // ── Years of experience (calculated) ────────────────────────────────
  if (validated.years_experience !== null && validated.years_experience > 0) {
    filledFields.push({
      targetField: "yearsOfExperience",
      extractedValue: validated.years_experience,
      confidence: "medium",
      evidence: { page: 1, exactText: `${validated.years_experience} Jahre (berechnet)`, confidence: 0.7 },
    });
  }

  // ── Highlights ──────────────────────────────────────────────────────
  if (validated.highlights.length > 0) {
    filledFields.push({
      targetField: "highlights",
      extractedValue: validated.highlights,
      confidence: "medium",
      evidence: { page: 1, exactText: `${validated.highlights.length} Highlights`, confidence: 0.7 },
    });
  }

  // ── Certifications ──────────────────────────────────────────────────
  if (validated.certifications.length > 0) {
    filledFields.push({
      targetField: "certificates",
      extractedValue: validated.certifications.map(c => ({
        name: c.name,
        issuer: c.issuer,
        date: c.year,
      })),
      confidence: "medium",
      evidence: { page: 1, exactText: `${validated.certifications.length} Zertifikate`, confidence: 0.7 },
    });
  }

  // ── Unmapped segments ───────────────────────────────────────────────
  const unmappedItems: CandidateAutoFillDraftV2["unmappedItems"] = [];

  if (llmResult.unmapped_segments && llmResult.unmapped_segments.length > 0) {
    for (const segment of llmResult.unmapped_segments) {
      const categoryMap: Record<string, CandidateAutoFillDraftV2["unmappedItems"][0]["category"]> = {
        date: "date",
        skill: "skill",
        credential: "education",
        personal: "contact",
        job_details: "experience",
        education_details: "education",
        other: "other",
      };

      const line = segment.line_reference
        ? findLineFromEvidence(packedInput, { lineId: segment.line_reference, page: 1, text: segment.original_text })
        : undefined;

      unmappedItems.push({
        extractedLabel: segment.suggested_parent || segment.suggested_field || undefined,
        extractedValue: segment.original_text,
        category: categoryMap[segment.detected_type] || "other",
        evidence: {
          page: line?.page || 1,
          exactText: segment.original_text.substring(0, 200),
          confidence: segment.confidence,
        },
      });
    }

    cvLogger.info("Unmapped segments converted", {
      action: "buildDraftFromLlmResult",
      count: unmappedItems.length,
    });
  }

  return {
    filledFields,
    ambiguousFields,
    unmappedItems,
    metadata: {
      fileName,
      fileType,
      fileSize,
      pageCount,
      processingTimeMs,
      timestamp: new Date().toISOString(),
    },
    extractionVersion: CV_EXTRACTION_VERSION + "+llm",
    provider: "azure-document-intelligence",
  };
}

export interface LlmExtractionPipelineResult {
  draft: CandidateAutoFillDraftV2;
  llmUsed: boolean;
  llmSuccess: boolean;
  llmError?: string;
  llmLatencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export async function extractWithLlm(
  docRep: DocumentRep,
  fileName: string,
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx",
  fileSize: number,
  processingTimeMs: number,
  fallbackDraft: CandidateAutoFillDraftV2
): Promise<LlmExtractionPipelineResult> {
  if (!isLlmEnabled() || !isLlmConfigured()) {
    cvLogger.info("LLM extraction skipped - not enabled or configured", { action: "extractWithLlm" });
    return {
      draft: fallbackDraft,
      llmUsed: false,
      llmSuccess: false,
    };
  }

  const deterministicFields = extractDeterministicFields(docRep);
  const packedInput = packCvForLLM(docRep);

  cvLogger.info("Starting LLM extraction pipeline", {
    action: "extractWithLlm",
    estimatedTokens: packedInput.estimated_tokens,
    sectionsCount: packedInput.sections.length,
    headerLinesCount: packedInput.header_lines.length,
  });

  const llmResult = await extractCandidateFieldsWithLLM(packedInput);

  if (!llmResult.success || !llmResult.data) {
    cvLogger.warn("LLM extraction failed, using fallback", {
      action: "extractWithLlm",
      errorCode: llmResult.errorCode,
    });

    const fallbackWithDeterministic = { ...fallbackDraft };
    
    if (deterministicFields.email) {
      const emailField = fallbackWithDeterministic.filledFields.find((f) => f.targetField === "email");
      if (!emailField) {
        fallbackWithDeterministic.filledFields.push({
          targetField: "email",
          extractedValue: deterministicFields.email.value,
          confidence: "high",
          evidence: deterministicFields.email.evidence,
        });
      }
    }

    if (deterministicFields.phone) {
      const phoneField = fallbackWithDeterministic.filledFields.find((f) => f.targetField === "phone");
      if (!phoneField) {
        fallbackWithDeterministic.filledFields.push({
          targetField: "phone",
          extractedValue: deterministicFields.phone.value,
          confidence: "high",
          evidence: deterministicFields.phone.evidence,
        });
      }
    }

    for (const field of fallbackWithDeterministic.filledFields) {
      if (!["email", "phone"].includes(field.targetField)) {
        const existing = fallbackWithDeterministic.ambiguousFields.find(
          (a) => a.extractedLabel === field.targetField
        );
        if (!existing) {
          fallbackWithDeterministic.ambiguousFields.push({
            extractedLabel: field.targetField,
            extractedValue: String(field.extractedValue),
            suggestedTargets: [
              { targetField: field.targetField, confidence: "low", reason: "LLM unavailable - needs review" },
            ],
            evidence: field.evidence,
          });
        }
      }
    }

    fallbackWithDeterministic.filledFields = fallbackWithDeterministic.filledFields.filter(
      (f) => ["email", "phone"].includes(f.targetField)
    );

    return {
      draft: fallbackWithDeterministic,
      llmUsed: true,
      llmSuccess: false,
      llmError: llmResult.error,
      llmLatencyMs: llmResult.latencyMs,
    };
  }

  const draft = buildDraftFromLlmResult(
    llmResult.data,
    packedInput,
    deterministicFields,
    fileName,
    fileType,
    fileSize,
    docRep.pageCount,
    processingTimeMs + llmResult.latencyMs
  );

  cvLogger.info("LLM extraction pipeline completed", {
    action: "extractWithLlm",
    filledFieldsCount: draft.filledFields.length,
    ambiguousFieldsCount: draft.ambiguousFields.length,
    llmLatencyMs: llmResult.latencyMs,
  });

  return {
    draft,
    llmUsed: true,
    llmSuccess: true,
    llmLatencyMs: llmResult.latencyMs,
    promptTokens: llmResult.promptTokens,
    completionTokens: llmResult.completionTokens,
  };
}

