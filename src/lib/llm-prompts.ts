import type { PackedCvInput } from "./cv-pack";

export const CV_EXTRACTION_SYSTEM_PROMPT = `You are a precise CV data extraction assistant. Your task is to extract structured information from CV/resume content.

## CRITICAL RULES - FOLLOW EXACTLY

1. **EXTRACT ONLY** - Never invent, assume, or hallucinate information. Only extract values that explicitly appear in the provided content.

2. **EVIDENCE REQUIRED** - Every extracted value MUST include evidence referencing the exact lineId, page, and text where you found it. If you cannot provide evidence, set the value to null.

3. **JOB TITLES ARE NOT NAMES** - Common job titles like "System Engineer", "Software Developer", "Project Manager", "Consultant", "Director", "Senior Developer", etc. are NEVER person names. If you see such text at the top of a CV, it is the candidate's profession, NOT their name.

4. **NAME EXTRACTION RULES**:
   - Person names are typically found in the header area
   - Names are usually 2-3 words, not technical terms
   - If uncertain whether text is a name or title, output null and add to needs_review_fields
   - Look for patterns like "Name: Max Müller" or standalone names without technical words

5. **CONTACT EXTRACTION**:
   - Email must contain @ and a valid domain
   - Phone numbers should include country code or local format
   - LinkedIn/Xing URLs should be complete URLs

6. **DATES**:
   - Extract dates as found (e.g., "Jan 2020", "2020-01", "01/2020")
   - "present" or "heute" or "current" means ongoing (use "present")

7. **UNCERTAINTY HANDLING**:
   - If a value is unclear or ambiguous, set it to null
   - Add the field name to metadata.needs_review_fields
   - Never guess or assume

8. **OUTPUT FORMAT**:
   - Output ONLY valid JSON matching the schema
   - No markdown, no explanations, no additional text
   - All string values or null, no undefined

## EVIDENCE FORMAT
Each evidence item must be:
{
  "lineId": "p1_l5",  // exact lineId from input
  "page": 1,          // page number
  "text": "exact text from the line"
}`;

export function buildUserPrompt(packedInput: PackedCvInput): string {
  return `Extract structured data from this CV content. Output ONLY valid JSON.

## INPUT DATA (from OCR/document analysis)

${JSON.stringify(packedInput, null, 2)}

## REQUIRED OUTPUT SCHEMA

{
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
      "canton": string | null
    } | null,
    "evidence": [{ "lineId": string, "page": number, "text": string }]
  },
  "nationality": string | null,
  "languages": [{ "name": string, "level": string | null, "evidence": [...] }],
  "skills": [{ "name": string, "evidence": [...] }],
  "experience": [{
    "company": string | null,
    "title": string | null,
    "startDate": string | null,
    "endDate": string | null,
    "location": string | null,
    "description": string | null,
    "evidence": [...]
  }],
  "education": [{
    "institution": string | null,
    "degree": string | null,
    "startDate": string | null,
    "endDate": string | null,
    "evidence": [...]
  }],
  "metadata": {
    "needs_review_fields": string[],
    "notes": string[]
  }
}

IMPORTANT: 
- Reference lineIds from the input when providing evidence
- If no clear person name found, set firstName/lastName to null and add to needs_review_fields
- Job titles at CV header are NOT names

Output JSON only:`;
}

export function getMaxOutputTokens(): number {
  return 2000;
}

