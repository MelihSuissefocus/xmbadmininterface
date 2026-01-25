import "server-only";

import type { DocumentRep, CandidateAutoFillDraftV2, ExtractedFieldWithEvidence, FieldEvidence } from "./types";
import { CV_EXTRACTION_VERSION } from "./types";
import { packCvForLLM, type PackedCvInput, type PackedLine } from "@/lib/cv-pack";
import { extractCandidateFieldsWithLLM, isLlmEnabled, isLlmConfigured, type LlmExtractionResult } from "@/lib/azure-openai";
import { type LlmExtractionResponse, type LlmEvidence } from "@/lib/llm-schema";
import { validateEmail, normalizePhoneE164 } from "./validation";
import { defaultFactors, calculateConfidence, getConfidenceLevel } from "./confidence";
import { cvLogger } from "@/lib/logger";

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
  if (!hasEvidence) {
    return { score: 0, status: "skip" };
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
  } else if (score >= 0.70) {
    return { score, status: "review" };
  } else {
    return { score, status: "skip" };
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
  const filledFields: ExtractedFieldWithEvidence[] = [];
  const ambiguousFields: CandidateAutoFillDraftV2["ambiguousFields"] = [];
  const flaggedFields = new Set(llmResult.metadata.needs_review_fields);

  if (deterministicFields.email) {
    filledFields.push({
      targetField: "email",
      extractedValue: deterministicFields.email.value,
      confidence: "high",
      evidence: deterministicFields.email.evidence,
    });
  } else if (llmResult.contact.email) {
    const hasEvidence = llmResult.contact.evidence.length > 0;
    const { score, status } = computeFieldScore(hasEvidence, llmResult.contact.evidence.length, flaggedFields.has("email"), true);
    const evidence = llmEvidenceToFieldEvidence(llmResult.contact.evidence, packedInput, score);

    if (status === "autofill") {
      filledFields.push({
        targetField: "email",
        extractedValue: llmResult.contact.email,
        confidence: getConfidenceLevel(score),
        evidence,
      });
    } else if (status === "review") {
      ambiguousFields.push({
        extractedLabel: "email",
        extractedValue: llmResult.contact.email,
        suggestedTargets: [{ targetField: "email", confidence: getConfidenceLevel(score), reason: "LLM extraction" }],
        evidence,
      });
    }
  }

  if (deterministicFields.phone) {
    filledFields.push({
      targetField: "phone",
      extractedValue: deterministicFields.phone.value,
      confidence: "high",
      evidence: deterministicFields.phone.evidence,
    });
  } else if (llmResult.contact.phone) {
    const hasEvidence = llmResult.contact.evidence.length > 0;
    const { score, status } = computeFieldScore(hasEvidence, llmResult.contact.evidence.length, flaggedFields.has("phone"), true);
    const evidence = llmEvidenceToFieldEvidence(llmResult.contact.evidence, packedInput, score);

    if (status === "autofill") {
      filledFields.push({
        targetField: "phone",
        extractedValue: llmResult.contact.phone,
        confidence: getConfidenceLevel(score),
        evidence,
      });
    } else if (status === "review") {
      ambiguousFields.push({
        extractedLabel: "phone",
        extractedValue: llmResult.contact.phone,
        suggestedTargets: [{ targetField: "phone", confidence: getConfidenceLevel(score), reason: "LLM extraction" }],
        evidence,
      });
    }
  }

  if (llmResult.person.firstName) {
    const hasEvidence = llmResult.person.evidence.length > 0;
    const isFlagged = flaggedFields.has("firstName");
    const { score, status } = computeFieldScore(hasEvidence, llmResult.person.evidence.length, isFlagged, !isFlagged);
    const evidence = llmEvidenceToFieldEvidence(llmResult.person.evidence, packedInput, score);

    if (status === "autofill") {
      filledFields.push({
        targetField: "firstName",
        extractedValue: llmResult.person.firstName,
        confidence: getConfidenceLevel(score),
        evidence,
      });
    } else if (status === "review") {
      ambiguousFields.push({
        extractedLabel: "firstName",
        extractedValue: llmResult.person.firstName,
        suggestedTargets: [{ targetField: "firstName", confidence: getConfidenceLevel(score), reason: "LLM extraction - needs verification" }],
        evidence,
      });
    }
  } else if (flaggedFields.has("firstName")) {
    ambiguousFields.push({
      extractedLabel: "firstName",
      extractedValue: "",
      suggestedTargets: [{ targetField: "firstName", confidence: "low", reason: "Could not determine - please enter manually" }],
      evidence: { page: 1, exactText: "", confidence: 0 },
    });
  }

  if (llmResult.person.lastName) {
    const hasEvidence = llmResult.person.evidence.length > 0;
    const isFlagged = flaggedFields.has("lastName");
    const { score, status } = computeFieldScore(hasEvidence, llmResult.person.evidence.length, isFlagged, !isFlagged);
    const evidence = llmEvidenceToFieldEvidence(llmResult.person.evidence, packedInput, score);

    if (status === "autofill") {
      filledFields.push({
        targetField: "lastName",
        extractedValue: llmResult.person.lastName,
        confidence: getConfidenceLevel(score),
        evidence,
      });
    } else if (status === "review") {
      ambiguousFields.push({
        extractedLabel: "lastName",
        extractedValue: llmResult.person.lastName,
        suggestedTargets: [{ targetField: "lastName", confidence: getConfidenceLevel(score), reason: "LLM extraction - needs verification" }],
        evidence,
      });
    }
  } else if (flaggedFields.has("lastName")) {
    ambiguousFields.push({
      extractedLabel: "lastName",
      extractedValue: "",
      suggestedTargets: [{ targetField: "lastName", confidence: "low", reason: "Could not determine - please enter manually" }],
      evidence: { page: 1, exactText: "", confidence: 0 },
    });
  }

  if (deterministicFields.linkedinUrl) {
    filledFields.push({
      targetField: "linkedinUrl",
      extractedValue: deterministicFields.linkedinUrl.value,
      confidence: "high",
      evidence: deterministicFields.linkedinUrl.evidence,
    });
  } else if (llmResult.contact.linkedinUrl) {
    filledFields.push({
      targetField: "linkedinUrl",
      extractedValue: llmResult.contact.linkedinUrl,
      confidence: "medium",
      evidence: llmEvidenceToFieldEvidence(llmResult.contact.evidence, packedInput, 0.8),
    });
  }

  if (llmResult.contact.address) {
    const addr = llmResult.contact.address;
    if (addr.street) {
      filledFields.push({
        targetField: "street",
        extractedValue: addr.street,
        confidence: "medium",
        evidence: llmEvidenceToFieldEvidence(addr.evidence || llmResult.contact.evidence, packedInput, 0.8),
      });
    }
    if (addr.postalCode) {
      filledFields.push({
        targetField: "postalCode",
        extractedValue: addr.postalCode,
        confidence: "medium",
        evidence: llmEvidenceToFieldEvidence(addr.evidence || llmResult.contact.evidence, packedInput, 0.8),
      });
    }
    if (addr.city) {
      filledFields.push({
        targetField: "city",
        extractedValue: addr.city,
        confidence: "medium",
        evidence: llmEvidenceToFieldEvidence(addr.evidence || llmResult.contact.evidence, packedInput, 0.8),
      });
    }
    if (addr.canton) {
      filledFields.push({
        targetField: "canton",
        extractedValue: addr.canton,
        confidence: "medium",
        evidence: llmEvidenceToFieldEvidence(addr.evidence || llmResult.contact.evidence, packedInput, 0.8),
      });
    }
  }

  if (llmResult.languages.length > 0) {
    const langArray = llmResult.languages.map((l) => ({
      language: l.name,
      level: l.level || "B2",
    }));
    const firstWithEvidence = llmResult.languages.find((l) => l.evidence.length > 0);
    const evidence = firstWithEvidence 
      ? llmEvidenceToFieldEvidence(firstWithEvidence.evidence, packedInput, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "languages",
      extractedValue: langArray,
      confidence: "medium",
      evidence,
    });
  }

  if (llmResult.skills.length > 0) {
    const skillNames = llmResult.skills.map((s) => s.name);
    const firstWithEvidence = llmResult.skills.find((s) => s.evidence.length > 0);
    const evidence = firstWithEvidence
      ? llmEvidenceToFieldEvidence(firstWithEvidence.evidence, packedInput, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "skills",
      extractedValue: skillNames,
      confidence: "medium",
      evidence,
    });
  }

  if (llmResult.experience.length > 0) {
    const expArray = llmResult.experience.map((e) => ({
      company: e.company || "",
      role: e.title || "",
      startMonth: "",
      startYear: e.startDate || "",
      endMonth: "",
      endYear: e.endDate === "present" ? "" : (e.endDate || ""),
      current: e.endDate === "present",
      description: e.description || "",
    }));
    const firstWithEvidence = llmResult.experience.find((e) => e.evidence.length > 0);
    const evidence = firstWithEvidence
      ? llmEvidenceToFieldEvidence(firstWithEvidence.evidence, packedInput, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "experience",
      extractedValue: expArray,
      confidence: "medium",
      evidence,
    });
  }

  if (llmResult.education.length > 0) {
    const eduArray = llmResult.education.map((e) => ({
      degree: e.degree || "",
      institution: e.institution || "",
      startMonth: "",
      startYear: e.startDate || "",
      endMonth: "",
      endYear: e.endDate || "",
    }));
    const firstWithEvidence = llmResult.education.find((e) => e.evidence.length > 0);
    const evidence = firstWithEvidence
      ? llmEvidenceToFieldEvidence(firstWithEvidence.evidence, packedInput, 0.85)
      : { page: 1, exactText: "", confidence: 0.7 };

    filledFields.push({
      targetField: "education",
      extractedValue: eduArray,
      confidence: "medium",
      evidence,
    });
  }

  return {
    filledFields,
    ambiguousFields,
    unmappedItems: [],
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

