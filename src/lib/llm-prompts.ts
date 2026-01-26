import type { PackedCvInput } from "./cv-pack";

export const CV_EXTRACTION_SYSTEM_PROMPT = `You are a METICULOUS CV data extraction assistant. Your task is to extract ALL structured information from CV/resume content with ZERO data loss.

## CRITICAL RULES - FOLLOW EXACTLY

1. **EXTRACT EVERYTHING** - Your goal is 100% data capture. Every piece of meaningful text in the CV must either:
   - Be mapped to a structured field, OR
   - Be placed in unmapped_segments for manual review
   NEVER discard data!

2. **EVIDENCE REQUIRED** - Every extracted value MUST include evidence referencing the exact lineId, page, and text where you found it.

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

7. **🚨 JOB DESCRIPTION EXTRACTION (CRITICAL!)** - This is the #1 source of data loss!
   - LOOK FOR TEXT BLOCKS between job entries (bullet points, paragraphs)
   - Extract ALL job descriptions VERBATIM into the "responsibilities" array
   - Each bullet point = one entry in responsibilities[]
   - DO NOT summarize - capture word-for-word!
   - Include technologies mentioned in the "technologies" array
   
   Example: If you see:
   "Technischer IT-Consultant | Firma AG | 2020-2023
   • Konzeption von Compliance-Frameworks (nDSG)
   • Durchführung von Security Audits"
   
   Extract as:
   {
     "title": "Technischer IT-Consultant",
     "company": "Firma AG", 
     "responsibilities": [
       "Konzeption von Compliance-Frameworks (nDSG)",
       "Durchführung von Security Audits"
     ],
     "technologies": ["nDSG"]
   }

8. **UNMAPPED DATA (NEVER LOSE DATA!)**:
   - If you find data that doesn't fit a schema field, add it to "unmapped_segments"
   - Categories: date, skill, credential, personal, job_details, education_details, other
   - For job_details, set "suggested_parent" to the job title it likely belongs to
   - RULE: If in doubt, put it in unmapped_segments. Better to ask the user than lose data!

9. **OUTPUT FORMAT**:
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
    "responsibilities": [string],    // CAPTURE ALL JOB DESCRIPTIONS HERE!
    "technologies": [string],        // Technologies mentioned in this role
    "evidence": [...]                // MUST include lineIds from description text!
  }],
  "education": [{
    "institution": string | null,
    "degree": string | null,
    "startDate": string | null,
    "endDate": string | null,
    "evidence": [...]
  }],
  "unmapped_segments": [{            // NEVER LOSE DATA - Put anything that doesn't fit here!
    "original_text": string,
    "detected_type": "date" | "skill" | "credential" | "personal" | "job_details" | "education_details" | "other",
    "reason": string,
    "suggested_field": string | null,
    "suggested_parent": string | null,  // For job_details: which job does this belong to?
    "confidence": number (0-1),
    "line_reference": string | null     // The lineId from input
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
- CAPTURE ALL JOB DESCRIPTIONS in responsibilities[] array - DO NOT skip them!
- If data doesn't fit the schema, put it in unmapped_segments - NEVER discard data!

Output JSON only:`;
}

export function getMaxOutputTokens(): number {
  // Increased from 2000 to capture ALL job descriptions and unmapped segments
  return 4000;
}

