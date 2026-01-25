import "server-only";

import type {
  DocumentRep,
  CandidateAutoFillDraftV2,
  ExtractedFieldWithEvidence,
  FieldEvidence,
  KeyValuePair,
} from "./types";
import { CV_EXTRACTION_VERSION } from "./types";

const KV_FIELD_MAPPINGS: Record<string, { targetField: string; confidence: "high" | "medium" | "low" }> = {
  vorname: { targetField: "firstName", confidence: "high" },
  "first name": { targetField: "firstName", confidence: "high" },
  prénom: { targetField: "firstName", confidence: "high" },
  nachname: { targetField: "lastName", confidence: "high" },
  "last name": { targetField: "lastName", confidence: "high" },
  familienname: { targetField: "lastName", confidence: "high" },
  nom: { targetField: "lastName", confidence: "high" },
  "nom de famille": { targetField: "lastName", confidence: "high" },
  email: { targetField: "email", confidence: "high" },
  "e-mail": { targetField: "email", confidence: "high" },
  mail: { targetField: "email", confidence: "high" },
  telefon: { targetField: "phone", confidence: "high" },
  phone: { targetField: "phone", confidence: "high" },
  tel: { targetField: "phone", confidence: "high" },
  téléphone: { targetField: "phone", confidence: "high" },
  mobile: { targetField: "phone", confidence: "high" },
  handy: { targetField: "phone", confidence: "high" },
  adresse: { targetField: "street", confidence: "medium" },
  address: { targetField: "street", confidence: "medium" },
  strasse: { targetField: "street", confidence: "high" },
  straße: { targetField: "street", confidence: "high" },
  street: { targetField: "street", confidence: "high" },
  plz: { targetField: "postalCode", confidence: "high" },
  "postal code": { targetField: "postalCode", confidence: "high" },
  postleitzahl: { targetField: "postalCode", confidence: "high" },
  ort: { targetField: "city", confidence: "high" },
  city: { targetField: "city", confidence: "high" },
  stadt: { targetField: "city", confidence: "high" },
  wohnort: { targetField: "city", confidence: "high" },
  ville: { targetField: "city", confidence: "high" },
  kanton: { targetField: "canton", confidence: "high" },
  canton: { targetField: "canton", confidence: "high" },
  linkedin: { targetField: "linkedinUrl", confidence: "high" },
  "linkedin url": { targetField: "linkedinUrl", confidence: "high" },
  position: { targetField: "targetRole", confidence: "medium" },
  "target role": { targetField: "targetRole", confidence: "medium" },
  zielposition: { targetField: "targetRole", confidence: "medium" },
  beruf: { targetField: "targetRole", confidence: "medium" },
};

function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/[:\-_]/g, " ").replace(/\s+/g, " ");
}

function createEvidence(kv: KeyValuePair): FieldEvidence {
  return {
    page: kv.page,
    polygon: kv.valuePolygon,
    exactText: kv.value,
    confidence: kv.confidence,
  };
}

function extractFromKeyValuePairs(
  docRep: DocumentRep
): ExtractedFieldWithEvidence[] {
  const fields: ExtractedFieldWithEvidence[] = [];
  const usedFields = new Set<string>();

  for (const kv of docRep.keyValuePairs) {
    const normalizedKey = normalizeKey(kv.key);
    const mapping = KV_FIELD_MAPPINGS[normalizedKey];

    if (mapping && !usedFields.has(mapping.targetField) && kv.value.trim()) {
      usedFields.add(mapping.targetField);
      fields.push({
        targetField: mapping.targetField,
        extractedValue: kv.value.trim(),
        confidence: mapping.confidence,
        evidence: createEvidence(kv),
      });
    }
  }

  return fields;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+41|0041|0)\s*(?:\(0\))?\s*\d{2}\s*\d{3}\s*\d{2}\s*\d{2}|\+\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi;

function extractFromContent(
  docRep: DocumentRep,
  existingFields: Set<string>
): ExtractedFieldWithEvidence[] {
  const fields: ExtractedFieldWithEvidence[] = [];
  const content = docRep.content;

  if (!existingFields.has("email")) {
    const emailMatches = content.match(EMAIL_REGEX);
    if (emailMatches && emailMatches.length > 0) {
      const email = emailMatches[0];
      const page = findPageForText(docRep, email);
      fields.push({
        targetField: "email",
        extractedValue: email,
        confidence: "high",
        evidence: {
          page,
          exactText: email,
          confidence: 0.95,
        },
      });
      existingFields.add("email");
    }
  }

  if (!existingFields.has("phone")) {
    const phoneMatches = content.match(PHONE_REGEX);
    if (phoneMatches && phoneMatches.length > 0) {
      const phone = phoneMatches[0].replace(/\s+/g, " ").trim();
      const page = findPageForText(docRep, phone);
      fields.push({
        targetField: "phone",
        extractedValue: phone,
        confidence: "high",
        evidence: {
          page,
          exactText: phone,
          confidence: 0.9,
        },
      });
      existingFields.add("phone");
    }
  }

  if (!existingFields.has("linkedinUrl")) {
    const linkedinMatches = content.match(LINKEDIN_REGEX);
    if (linkedinMatches && linkedinMatches.length > 0) {
      let url = linkedinMatches[0];
      if (!url.startsWith("http")) {
        url = "https://" + url;
      }
      const page = findPageForText(docRep, linkedinMatches[0]);
      fields.push({
        targetField: "linkedinUrl",
        extractedValue: url,
        confidence: "high",
        evidence: {
          page,
          exactText: linkedinMatches[0],
          confidence: 0.95,
        },
      });
      existingFields.add("linkedinUrl");
    }
  }

  return fields;
}

function findPageForText(docRep: DocumentRep, text: string): number {
  const normalizedSearch = text.toLowerCase().replace(/\s+/g, "");
  for (const page of docRep.pages) {
    for (const line of page.lines) {
      const normalizedLine = line.text.toLowerCase().replace(/\s+/g, "");
      if (normalizedLine.includes(normalizedSearch)) {
        return page.pageNumber;
      }
    }
  }
  return 1;
}

function extractName(docRep: DocumentRep, existingFields: Set<string>): ExtractedFieldWithEvidence[] {
  const fields: ExtractedFieldWithEvidence[] = [];
  if (existingFields.has("firstName") && existingFields.has("lastName")) {
    return fields;
  }

  if (docRep.pages.length === 0 || docRep.pages[0].lines.length === 0) {
    return fields;
  }

  const firstPageLines = docRep.pages[0].lines.slice(0, 10);
  
  for (const line of firstPageLines) {
    const text = line.text.trim();
    if (text.length < 3 || text.length > 60) continue;
    if (EMAIL_REGEX.test(text) || PHONE_REGEX.test(text)) continue;
    if (/^\d/.test(text)) continue;
    if (/lebenslauf|cv|curriculum|resume|profil/i.test(text)) continue;

    const words = text.split(/\s+/).filter((w) => w.length > 1);
    if (words.length >= 2 && words.length <= 4) {
      const allCapitalized = words.every((w) => /^[A-ZÄÖÜ]/.test(w));
      if (allCapitalized) {
        if (!existingFields.has("firstName")) {
          fields.push({
            targetField: "firstName",
            extractedValue: words[0],
            confidence: "medium",
            evidence: {
              page: 1,
              exactText: text,
              confidence: 0.7,
              polygon: line.polygon,
            },
          });
          existingFields.add("firstName");
        }

        if (!existingFields.has("lastName")) {
          fields.push({
            targetField: "lastName",
            extractedValue: words.slice(1).join(" "),
            confidence: "medium",
            evidence: {
              page: 1,
              exactText: text,
              confidence: 0.7,
              polygon: line.polygon,
            },
          });
          existingFields.add("lastName");
        }
        break;
      }
    }
  }

  return fields;
}

export function mapDocumentToCandidate(
  docRep: DocumentRep,
  fileName: string,
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx",
  fileSize: number,
  processingTimeMs: number
): CandidateAutoFillDraftV2 {
  const kvFields = extractFromKeyValuePairs(docRep);
  const usedFields = new Set(kvFields.map((f) => f.targetField));

  const contentFields = extractFromContent(docRep, usedFields);
  const nameFields = extractName(docRep, usedFields);

  const allFields = [...kvFields, ...contentFields, ...nameFields];

  return {
    filledFields: allFields,
    ambiguousFields: [],
    unmappedItems: [],
    metadata: {
      fileName,
      fileType,
      fileSize,
      pageCount: docRep.pageCount,
      processingTimeMs,
      timestamp: new Date().toISOString(),
    },
    extractionVersion: CV_EXTRACTION_VERSION,
    provider: "azure-document-intelligence",
  };
}

