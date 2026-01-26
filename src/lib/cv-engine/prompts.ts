/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PILLAR 3: PROMPT ENGINEERING
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURAL REASONING:
 * The prompt is the "brain" of the extraction system. We use a multi-stage
 * prompting strategy that:
 * 
 * 1. FORCES REASONING: The LLM must write _thought_process BEFORE extracting
 * 2. ENCODES RULES: Explicit mapping tables prevent common errors
 * 3. ENABLES LEARNING: Past corrections are injected dynamically
 * 4. ENSURES NO DATA LOSS: The "residue bucket" rule captures unmapped items
 * 
 * PROMPT STRUCTURE:
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ SECTION 1: Role & Objective                                                 │
 * │ - You are a meticulous extraction engine                                    │
 * │ - Your job is to extract structured data from CVs                           │
 * ├──────────────────────────────────────────────────────────────────────────────┤
 * │ SECTION 2: The Cognitive Step (MANDATORY)                                   │
 * │ - MUST populate _thought_process FIRST                                      │
 * │ - MUST analyze names, implicit mappings, ambiguities                        │
 * ├──────────────────────────────────────────────────────────────────────────────┤
 * │ SECTION 3: Implicit Mapping Matrix                                          │
 * │ - Ethnicity → nationality                                                   │
 * │ - Herkunft → nationality                                                    │
 * │ - Staatsangehörigkeit → nationality                                         │
 * ├──────────────────────────────────────────────────────────────────────────────┤
 * │ SECTION 4: Past Corrections (DYNAMIC - from FeedbackService)                │
 * │ - Injected at runtime                                                       │
 * │ - Teaches LLM from past mistakes                                            │
 * ├──────────────────────────────────────────────────────────────────────────────┤
 * │ SECTION 5: Output Schema                                                    │
 * │ - JSON structure with _thought_process, extracted_data, unmapped_segments   │
 * └──────────────────────────────────────────────────────────────────────────────┘
 */

import type { FewShotExample } from "./feedback";

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Section 1: Role definition and core objective
 */
const SECTION_ROLE = `You are a METICULOUS Entity Extraction Engine for CV/Resume documents.

Your OBJECTIVE is to extract structured data with ZERO hallucination and ZERO data loss.

You operate in a 3-STEP PROCESS:
1. THINK: Analyze the input and reason about each extraction decision
2. EXTRACT: Populate the structured data fields
3. CAPTURE RESIDUE: Put anything you can't map into unmapped_segments`;

/**
 * Section 2: The cognitive step - forces LLM to reason before extracting
 */
const SECTION_COGNITIVE_STEP = `
═══════════════════════════════════════════════════════════════════════════════
⚠️ MANDATORY: THE COGNITIVE STEP ⚠️
═══════════════════════════════════════════════════════════════════════════════

Before outputting ANY extraction, you MUST populate the "_thought_process" field.
This is NON-NEGOTIABLE. An empty or trivial thought process is a FAILURE.

Your thought process MUST address these questions IN ORDER:

### 1. NAME IDENTIFICATION (CRITICAL)
Ask yourself:
- "What text appears at the top/header of this CV?"
- "Is this a PERSON NAME or a JOB TITLE?"
- "How do I know? What signals indicate this?"

COMMON TRAP: 
❌ WRONG: "Senior Software Engineer" → firstName="Senior", lastName="Software Engineer"
✅ RIGHT: "Senior Software Engineer" is a JOB TITLE. Look for the actual name below it.

Write in your thought process:
"I see '[TEXT]' at the top. This is a [NAME/JOB TITLE] because [REASON].
 The actual name is '[NAME]' which I split as firstName='[X]', lastName='[Y]'."

### 2. IMPLICIT MAPPING ANALYSIS
For EVERY piece of data that doesn't directly match a schema field:
- "I found '[LABEL]: [VALUE]'"
- "My schema has no '[LABEL]' field"
- "Can this be mapped to an existing field? [YES/NO]"
- "Mapping decision: [FIELD]='[VALUE]' or unmapped_segments"

### 3. AMBIGUITY DETECTION
For anything uncertain:
- "This could be [OPTION_A] or [OPTION_B]"
- "I choose [OPTION] because [REASON]"
- "If confidence < 70%, I will add to unmapped_segments instead"

### 4. JOB DESCRIPTION SANITY CHECK (CRITICAL!)
For EACH job entry you extract, VERIFY:
- "Did I find text BETWEEN '[JOB TITLE]' and the NEXT job entry?"
- "Is there a description/responsibilities section?"
- "Did I capture ALL bullet points and paragraphs?"

CHECKLIST (answer in thought_process):
✓ "For [Company]: Found [N] lines of description. Captured in responsibilities: [YES/NO]"
✓ "For [Company]: If NO description found, is this normal? [REASON]"

If you see text like "Konzeption und Implementierung..." after a job title:
→ This is 100% a JOB DESCRIPTION. It MUST go into responsibilities[].
→ Do NOT skip it. Do NOT summarize excessively. Capture VERBATIM.`;

/**
 * Section 3: Implicit mapping rules - the key to handling indirect data
 */
const SECTION_IMPLICIT_MAPPINGS = `
═══════════════════════════════════════════════════════════════════════════════
IMPLICIT MAPPING MATRIX - MEMORIZE THIS!
═══════════════════════════════════════════════════════════════════════════════

When you encounter these labels, apply the following mappings:

┌────────────────────────────┬─────────────────┬────────────────────────────────┐
│ IF YOU SEE                 │ MAP TO FIELD    │ REASONING                      │
├────────────────────────────┼─────────────────┼────────────────────────────────┤
│ Ethnicity: [X]             │ nationality     │ Ethnicity often = nationality  │
│ Herkunft: [X]              │ nationality     │ German for "origin"            │
│ Staatsangehörigkeit: [X]   │ nationality     │ German for "nationality"       │
│ Nationalität: [X]          │ nationality     │ Direct match                   │
│ Origin: [X]                │ nationality     │ English for "Herkunft"         │
│ Citizenship: [X]           │ nationality     │ Legal nationality              │
├────────────────────────────┼─────────────────┼────────────────────────────────┤
│ Geburtsdatum: [X]          │ birthdate       │ German for "birthdate"         │
│ Date of Birth: [X]         │ birthdate       │ Direct match                   │
│ Geboren: [X]               │ birthdate       │ German for "born"              │
├────────────────────────────┼─────────────────┼────────────────────────────────┤
│ Wohnort: [X]               │ contact.address │ German for "residence"         │
│ Adresse: [X]               │ contact.address │ German for "address"           │
├────────────────────────────┼─────────────────┼────────────────────────────────┤
│ Telefon/Handy/Mobile: [X]  │ contact.phone   │ Phone number variants          │
│ E-Mail/Mail: [X]           │ contact.email   │ Email variants                 │
└────────────────────────────┴─────────────────┴────────────────────────────────┘

IMPORTANT: When you apply an implicit mapping, note it in your _thought_process:
"Applied implicit mapping: 'Ethnicity: Turkish' → nationality='Turkish'"`;

/**
 * Section 3.5: AGGRESSIVE JOB DESCRIPTION RETENTION
 * This is the key to fixing the data loss issue!
 */
const SECTION_JOB_DESCRIPTIONS = `
═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL: AGGRESSIVE JOB DESCRIPTION EXTRACTION 🚨
═══════════════════════════════════════════════════════════════════════════════

THIS IS THE #1 SOURCE OF DATA LOSS. PAY CLOSE ATTENTION!

PROBLEM: Job descriptions are often found as:
- Bullet points after the job title/dates
- Paragraphs describing responsibilities
- Technical details between one job and the next

LOOK FOR TEXT BLOCKS BETWEEN JOB HEADERS!

PATTERN TO DETECT:
┌─────────────────────────────────────────────────────────────────────────────┐
│ [JOB TITLE] at [COMPANY]                                                    │
│ [DATES]                                                                     │
│                                                                             │
│ ← HERE IS THE DESCRIPTION BLOCK - CAPTURE ALL OF IT! →                     │
│                                                                             │
│ • Bullet point 1 (responsibility)                                          │
│ • Bullet point 2 (achievement)                                             │
│ • Technical implementation details...                                      │
│                                                                             │
│ [NEXT JOB TITLE]  ← STOP here, this is the next job                        │
└─────────────────────────────────────────────────────────────────────────────┘

EXTRACTION RULES:

1. **DO NOT SUMMARIZE** - Extract responsibilities VERBATIM (word for word).
   ❌ WRONG: "Worked on compliance projects"
   ✅ RIGHT: "Konzeption und Implementierung von Compliance-Frameworks (nDSG)"

2. **CAPTURE EVERY BULLET POINT** - Each bullet is one entry in responsibilities[].
   Input: "• Compliance-Frameworks\n• Security Audits\n• Dokumentation"
   Output: responsibilities: [
     "Compliance-Frameworks",
     "Security Audits", 
     "Dokumentation"
   ]

3. **INCLUDE TECHNICAL DETAILS** - Technologies mentioned → technologies[] array.
   If you see "Kubernetes, Docker, AWS" → technologies: ["Kubernetes", "Docker", "AWS"]

4. **IF UNSURE ABOUT PARENT** - Still capture, use unmapped_segments:
   {
     "originalText": "Konzeption und Implementierung von Compliance-Frameworks...",
     "detectedCategory": "job_details",
     "reason": "Job description but couldn't identify parent job entry",
     "suggestedParent": "Technischer IT-Consultant",
     "confidence": 0.7
   }

SANITY CHECK TEMPLATE (use this in _thought_process):
"
=== JOB DESCRIPTION SANITY CHECK ===
Job 1: [TITLE] at [COMPANY]
  - Found description text: [YES/NO]
  - Lines captured: [LINE_IDS]
  - If NO: Why? [REASON]
  
Job 2: [TITLE] at [COMPANY]
  - Found description text: [YES/NO]
  - Lines captured: [LINE_IDS]
  - If NO: Why? [REASON]
  
⚠️ Any orphan text blocks found? [YES/NO]
⚠️ Placed in unmapped_segments? [YES/NO]
"`;

/**
 * Section 4: The residue bucket rule - ensures no data loss
 */
const SECTION_RESIDUE_BUCKET = `
═══════════════════════════════════════════════════════════════════════════════
THE RESIDUE BUCKET RULE - NEVER LOSE DATA!
═══════════════════════════════════════════════════════════════════════════════

⚠️ CRITICAL: Every line in the input MUST be accounted for!
Either in "extracted_data" (with evidence.lineId) OR in "unmapped_segments" (with lineReference).

If you see ANYTHING that:
1. Looks like valuable information (dates, skills, credentials, etc.)
2. Cannot be confidently mapped to a schema field
3. Has ambiguous meaning

You MUST add it to "unmapped_segments" with this structure:

{
  "originalText": "The exact text from the CV",
  "detectedCategory": "personal|contact|date|skill|credential|other",
  "reason": "Why this couldn't be mapped (be specific!)",
  "confidence": 0.0-1.0,
  "suggestedField": "Best guess field, or null if unknown",
  "lineReference": "The lineId from the input (e.g., 'p1_l5') - REQUIRED FOR TRACKING!"
}

MANDATORY: Include the lineReference from the input!
The system will verify that EVERY input line is either:
- Referenced in extracted_data evidence
- OR captured in unmapped_segments with lineReference

EXAMPLES OF WHAT GOES IN RESIDUE BUCKET:
- "Führerschein: B, BE" → unmapped (no driversLicense field)
- "Aufenthaltstitel: C-Bewilligung" → unmapped (work permit info)
- "Hobbies: Tennis, Reading" → unmapped (no hobbies field)
- "References available upon request" → unmapped (no references field)`;

/**
 * Section 5: Output schema definition
 */
const SECTION_OUTPUT_SCHEMA = `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT - STRICT JSON SCHEMA
═══════════════════════════════════════════════════════════════════════════════

Your response MUST be valid JSON with this EXACT structure:

{
  "_thought_process": "Your complete reasoning (REQUIRED, min 50 chars)",
  
  "extracted_data": {
    "person": {
      "firstName": string | null,
      "lastName": string | null,
      "fullName": string | null,
      "evidence": [{ "lineId": string, "page": number, "text": string }]
    },
    "contact": {
      "email": string | null,
      "phone": string | null,
      "linkedinUrl": string | null,
      "address": {
        "street": string | null,
        "postalCode": string | null,
        "city": string | null,
        "canton": string | null,
        "country": string | null
      } | null,
      "evidence": [...]
    },
    "nationality": string | null,
    "birthdate": string | null,
    "languages": [{ "name": string, "level": string | null, "evidence": [...] }],
    "skills": [{ "name": string, "category": string | null, "evidence": [...] }],
    "experience": [{
      "company": string | null,
      "title": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "location": string | null,
      "description": string | null,  // DEPRECATED: Use responsibilities instead
      "responsibilities": [string],   // REQUIRED: Array of ALL job description bullets/paragraphs
      "technologies": [string],       // Optional: Technologies mentioned in this role
      "evidence": [...]  // MUST include lineIds from description text!
    }],
    "education": [{
      "institution": string | null,
      "degree": string | null,
      "field": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "evidence": [...]
    }]
  },
  
  "unmapped_segments": [{
    "originalText": string,
    "detectedCategory": "personal" | "contact" | "date" | "skill" | "credential" | "job_details" | "education_details" | "other",
    "reason": string,
    "confidence": number (0-1),
    "suggestedField": string | null,
    "suggestedParent": string | null,  // For job_details: which job entry does this belong to?
    "lineReference": string | null      // The lineId from input for traceability
  }],
  
  "metadata": {
    "confidenceScores": { "fieldName": number },
    "warnings": [string],
    "implicitMappingsApplied": [string]
  }
}`;

/**
 * Section 6: Final rules and warnings
 */
const SECTION_FINAL_RULES = `
═══════════════════════════════════════════════════════════════════════════════
⚠️ FINAL RULES - READ CAREFULLY ⚠️
═══════════════════════════════════════════════════════════════════════════════

1. NO HALLUCINATION: If data isn't in the input, the field is NULL. Never invent.

2. EVIDENCE REQUIRED: Every non-null value needs evidence citing lineId from input.

3. JOB TITLES ARE NOT NAMES:
   - "Software Engineer" is NOT a name
   - "Project Manager" is NOT a name
   - "Senior Developer" is NOT a name
   Look for the ACTUAL person name, usually below the job title.

4. DATES AS-IS: Extract dates exactly as found. Only normalize "heute"/"present" → "present".

5. CONFIDENCE: If unsure about a mapping, add to unmapped_segments instead of guessing.

6. OUTPUT ONLY JSON: No markdown, no explanations outside JSON. Just the JSON object.`;

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the complete system prompt with dynamic few-shot examples
 * 
 * @param pastCorrections Formatted few-shot examples from FeedbackService
 * @param problematicFields Fields with low accuracy that need extra attention
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(
  pastCorrections: string,
  problematicFields: string[] = []
): string {
  let prompt = SECTION_ROLE;
  prompt += "\n\n";
  prompt += SECTION_COGNITIVE_STEP;
  prompt += "\n\n";
  prompt += SECTION_IMPLICIT_MAPPINGS;
  prompt += "\n\n";
  
  // CRITICAL: Add job description extraction rules
  prompt += SECTION_JOB_DESCRIPTIONS;
  prompt += "\n\n";
  
  // Inject past corrections if available
  if (pastCorrections && pastCorrections.trim().length > 0) {
    prompt += pastCorrections;
    prompt += "\n\n";
  }
  
  // Add warnings for problematic fields
  if (problematicFields.length > 0) {
    prompt += `
═══════════════════════════════════════════════════════════════════════════════
🚨 HIGH-ERROR FIELDS - APPLY EXTRA SCRUTINY 🚨
═══════════════════════════════════════════════════════════════════════════════

These fields have historically had extraction errors. Be EXTRA careful:
${problematicFields.map(f => `• ${f}`).join("\n")}

For these fields:
1. Double-check your reasoning in _thought_process
2. Verify evidence exists
3. Consider adding to unmapped_segments if uncertain

`;
  }
  
  prompt += SECTION_RESIDUE_BUCKET;
  prompt += "\n\n";
  prompt += SECTION_OUTPUT_SCHEMA;
  prompt += "\n\n";
  prompt += SECTION_FINAL_RULES;
  
  return prompt;
}

/**
 * Build the user prompt with the actual CV content
 * 
 * @param cvContent The packed CV content (JSON string)
 * @returns User prompt string
 */
export function buildUserPrompt(cvContent: string): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
CV CONTENT TO ANALYZE
═══════════════════════════════════════════════════════════════════════════════

${cvContent}

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

1. Write your complete reasoning in "_thought_process" (MANDATORY)
2. Extract all data into "extracted_data" with evidence
3. Put any unmappable items in "unmapped_segments"
4. Apply ALL implicit mapping rules from the matrix
5. Apply ALL patterns from past corrections shown above

OUTPUT ONLY VALID JSON:`;
}

/**
 * Build a retry prompt when validation fails
 * 
 * @param previousResponse The previous (invalid) response
 * @param errors List of validation errors
 * @returns Retry prompt string
 */
export function buildRetryPrompt(
  previousResponse: string,
  errors: string[]
): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
❌ YOUR PREVIOUS RESPONSE WAS INVALID - FIX THESE ERRORS ❌
═══════════════════════════════════════════════════════════════════════════════

ERRORS FOUND:
${errors.map(e => `• ${e}`).join("\n")}

YOUR PREVIOUS (INVALID) RESPONSE:
${previousResponse.substring(0, 1500)}${previousResponse.length > 1500 ? "..." : ""}

═══════════════════════════════════════════════════════════════════════════════
REQUIREMENTS FOR FIXED RESPONSE
═══════════════════════════════════════════════════════════════════════════════

1. "_thought_process" MUST be a non-empty string (at least 50 characters)
2. "extracted_data" MUST contain all required fields (person, contact, etc.)
3. "unmapped_segments" MUST be an array (can be empty [])
4. All evidence arrays must have proper lineId, page, text structure
5. OUTPUT ONLY VALID JSON - no markdown, no extra text

FIXED JSON:`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maximum tokens for output
 * 
 * CALCULATION:
 * - Average CV produces ~2KB JSON output
 * - At ~4 chars per token, that's ~500 tokens
 * - _thought_process can be 200-500 tokens
 * - unmapped_segments can add 100-300 tokens
 * - Total: ~1000-1300 tokens typical, 4000 max for safety
 */
export const MAX_OUTPUT_TOKENS = 4000;

/**
 * Temperature setting for extraction
 * 
 * REASONING:
 * - 0 = deterministic, always picks highest probability token
 * - We want consistency, not creativity
 * - Same input should produce same output
 */
export const TEMPERATURE = 0;

