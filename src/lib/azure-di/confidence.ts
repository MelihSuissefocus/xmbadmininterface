import "server-only";

export interface ConfidenceFactors {
  sourceConfidence: number;
  validationPass: boolean;
  labelProximity: number;
  uniqueness: number;
  repetitionCount: number;
  sectionMatch: boolean;
}

export interface ConfidenceResult {
  score: number;
  status: "autofill" | "review" | "skip";
  factors: ConfidenceFactors;
}

const AUTOFILL_THRESHOLD = 0.90;
const REVIEW_THRESHOLD = 0.70;

const WEIGHTS = {
  sourceConfidence: 0.25,
  validationPass: 0.25,
  labelProximity: 0.15,
  uniqueness: 0.15,
  repetition: 0.10,
  sectionMatch: 0.10,
};

export function calculateConfidence(factors: ConfidenceFactors): ConfidenceResult {
  let score = 0;

  score += factors.sourceConfidence * WEIGHTS.sourceConfidence;
  score += (factors.validationPass ? 1.0 : 0.3) * WEIGHTS.validationPass;
  score += factors.labelProximity * WEIGHTS.labelProximity;
  score += factors.uniqueness * WEIGHTS.uniqueness;
  
  const repetitionScore = Math.min(factors.repetitionCount / 2, 1.0);
  score += repetitionScore * WEIGHTS.repetition;
  
  score += (factors.sectionMatch ? 1.0 : 0.5) * WEIGHTS.sectionMatch;

  score = Math.min(Math.max(score, 0), 1);

  let status: "autofill" | "review" | "skip";
  if (score >= AUTOFILL_THRESHOLD) {
    status = "autofill";
  } else if (score >= REVIEW_THRESHOLD) {
    status = "review";
  } else {
    status = "skip";
  }

  return { score, status, factors };
}

export function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.85) return "high";
  if (score >= 0.60) return "medium";
  return "low";
}

export function defaultFactors(): ConfidenceFactors {
  return {
    sourceConfidence: 0.8,
    validationPass: true,
    labelProximity: 0.8,
    uniqueness: 1.0,
    repetitionCount: 1,
    sectionMatch: true,
  };
}

