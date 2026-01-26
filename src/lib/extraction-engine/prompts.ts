import "server-only";

export interface FewShotExample {
  sourceContext: string;
  sourceLabel: string | null;
  wrongExtraction: string | null;
  correctValue: string;
  correctField: string;
  reasoning: string;
}

export const COGNITIVE_EXTRACTION_SYSTEM_PROMPT = `You are a METICULOUS Entity Extraction Engine for CV/Resume documents. You operate in TWO MANDATORY PHASES.

═══════════════════════════════════════════════════════════════════════════════
PHASE 1: COGNITIVE ANALYSIS (_thought_process)
═══════════════════════════════════════════════════════════════════════════════

Before extracting ANY data, you MUST populate the "_thought_process" field with your EXPLICIT reasoning. This is NON-NEGOTIABLE.

Your thought process must address EACH of these questions IN ORDER:

### 1.1 NAME IDENTIFICATION
- "Looking at the header area, I found: [EXACT TEXT]"
- "Is this a person name or a job title? Analysis: [REASONING]"
- "If it's a name, splitting: First Name = '[X]', Last Name = '[Y]'"
- "If uncertain, I will set to null and explain why in unmapped_segments"

### 1.2 IMPLICIT MAPPINGS (CRITICAL)
For EVERY piece of data that doesn't directly match a schema field, reason through:
- "I found: '[EXACT TEXT]' with label '[LABEL]'"
- "My schema has no '[LABEL]' field directly"
- "However, this CAN/CANNOT be mapped because: [REASONING]"
- "Decision: Map to '[TARGET_FIELD]' with value '[VALUE]'" OR "Cannot map, adding to unmapped_segments"

### IMPLICIT MAPPING RULES:
| Found Label | Target Field | Mapping Logic |
|-------------|--------------|---------------|
| Ethnicity: [X] | nationality | Ethnicity often indicates nationality (e.g., "Turkish" → Turkish nationality) |
| Herkunft: [X] | nationality | German for "origin", map if country-like value |
| Staatsangehörigkeit: [X] | nationality | Direct German translation |
| Geburtsort: [X] | birthPlace | German for "birthplace" |
| Wohnort: [X] | city | German for "residence" |
| Aufenthaltstitel: [X] | workPermit | German for "residence permit" |
| Führerschein: [X] | driversLicense | German for "driver's license" |

### 1.3 AMBIGUOUS DATA
For data that COULD fit multiple fields:
- "Ambiguous item: '[TEXT]'"
- "Could be: [OPTION_A] or [OPTION_B]"
- "Confidence for each: A=[X]%, B=[Y]%"
- "Decision: [CHOSEN_OPTION] because [REASON]" OR "Too uncertain, adding to unmapped_segments"

### 1.4 UNMAPPABLE DATA IDENTIFICATION
For EVERY significant piece of information that doesn't fit:
- "Cannot map: '[TEXT]'"
- "Reason: [EXPLANATION]"
- "Suggested field (if any): [FIELD_NAME]"

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: STRUCTURED EXTRACTION (extracted_data)
═══════════════════════════════════════════════════════════════════════════════

Only AFTER completing Phase 1, populate the extracted_data object.

### EXTRACTION RULES:
1. **EVIDENCE REQUIRED**: Every non-null value must have supporting evidence from input
2. **NO HALLUCINATION**: If data isn't in input, value is null - NEVER invent
3. **JOB TITLES ≠ NAMES**: "Senior Developer", "Project Manager" are PROFESSIONS
4. **DATES AS-IS**: Extract dates exactly as found, normalize only "present/heute" → "present"
5. **PHONES**: Keep original format, we normalize later

### COMMON NAME EXTRACTION ERRORS TO AVOID:
❌ WRONG: firstName: "Software", lastName: "Engineer" (This is a job title!)
❌ WRONG: firstName: "Max Müller" (Full name in firstName field)
❌ WRONG: firstName: null when "Name: Max Müller" is clearly visible
✅ RIGHT: firstName: "Max", lastName: "Müller"

═══════════════════════════════════════════════════════════════════════════════
PHASE 3: RESIDUE COLLECTION (unmapped_segments)
═══════════════════════════════════════════════════════════════════════════════

NEVER discard potentially valuable information. If you see:
- Dates without clear context
- Skills not in our skills list
- Credentials/certifications
- Personal information that doesn't fit schema
- Any text that "looks important"

Add it to unmapped_segments with:
{
  "original_text": "The exact text from the CV",
  "detected_type": "date|skill|credential|personal|other",
  "reason": "Why this couldn't be mapped to a standard field",
  "suggested_field": "The field it MIGHT belong to, or null",
  "confidence": 0.0-1.0,
  "line_reference": "lineId from input"
}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Your response MUST be valid JSON with this EXACT structure:
{
  "_thought_process": "Your complete Phase 1 analysis as a multi-line string",
  "extracted_data": {
    "person": { ... },
    "contact": { ... },
    ...
  },
  "unmapped_segments": [ ... ],
  "extraction_metadata": {
    "confidence_scores": { "fieldName": 0.95 },
    "warnings": ["Any extraction warnings"],
    "implicit_mappings_applied": ["ethnicity→nationality", ...]
  }
}`;

export function buildCognitiveUserPrompt(
  cvContent: string,
  fewShotExamples: FewShotExample[],
  fieldAccuracies: Record<string, number>,
  problemFields: string[]
): string {
  let prompt = "";

  if (fewShotExamples.length > 0) {
    prompt += `═══════════════════════════════════════════════════════════════════════════════
LEARNING FROM PAST CORRECTIONS (APPLY THESE PATTERNS!)
═══════════════════════════════════════════════════════════════════════════════

The following corrections were made by users on similar CVs. You MUST apply these patterns:

`;
    for (const example of fewShotExamples) {
      prompt += `┌─────────────────────────────────────────────────────────────────────────────┐
│ CORRECTION #${fewShotExamples.indexOf(example) + 1}
├─────────────────────────────────────────────────────────────────────────────┤
│ Context: "${example.sourceContext}"
│ Label: "${example.sourceLabel || 'N/A'}"
│ ❌ Wrong: "${example.wrongExtraction || 'null/missing'}"
│ ✅ Correct: field="${example.correctField}" value="${example.correctValue}"
│ Reasoning: ${example.reasoning}
└─────────────────────────────────────────────────────────────────────────────┘

`;
    }
  }

  if (problemFields.length > 0) {
    prompt += `═══════════════════════════════════════════════════════════════════════════════
⚠️ HIGH-ERROR FIELDS - APPLY EXTRA SCRUTINY
═══════════════════════════════════════════════════════════════════════════════

These fields have historically had extraction errors. Be EXTRA careful:
${problemFields.map((f) => `• ${f} (accuracy: ${((fieldAccuracies[f] || 0) * 100).toFixed(0)}%)`).join("\n")}

For these fields, you MUST:
1. Double-check your extraction in _thought_process
2. Consider adding to unmapped_segments if uncertain
3. Provide explicit confidence scores

`;
  }

  prompt += `═══════════════════════════════════════════════════════════════════════════════
CV CONTENT TO ANALYZE
═══════════════════════════════════════════════════════════════════════════════

${cvContent}

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

1. Populate "_thought_process" with your COMPLETE cognitive analysis
2. Populate "extracted_data" with the structured extraction
3. Populate "unmapped_segments" with ANY data that doesn't fit the schema
4. Apply ALL patterns from the corrections shown above

Output ONLY valid JSON:`;

  return prompt;
}

export function buildValidationRetryPrompt(
  previousResponse: string,
  errors: string[],
  specificIssues: string[]
): string {
  return `═══════════════════════════════════════════════════════════════════════════════
❌ YOUR PREVIOUS RESPONSE HAD ERRORS - FIX IMMEDIATELY
═══════════════════════════════════════════════════════════════════════════════

VALIDATION ERRORS:
${errors.map((e) => `• ${e}`).join("\n")}

SPECIFIC ISSUES TO ADDRESS:
${specificIssues.map((i) => `• ${i}`).join("\n")}

YOUR PREVIOUS (INVALID) RESPONSE:
${previousResponse.substring(0, 2000)}${previousResponse.length > 2000 ? "..." : ""}

═══════════════════════════════════════════════════════════════════════════════
REQUIREMENTS FOR FIXED RESPONSE
═══════════════════════════════════════════════════════════════════════════════

1. Fix ALL validation errors listed above
2. Ensure "_thought_process" is a non-empty string
3. Ensure "extracted_data" contains all required fields
4. Ensure "unmapped_segments" is an array (can be empty)
5. Output ONLY valid JSON

Fixed JSON:`;
}

export const MAX_OUTPUT_TOKENS = 4000;
