import "server-only";

import type { DocumentRep, DocumentLine, KeyValuePair } from "@/lib/azure-di/types";

export interface PackedLine {
  lineId: string;
  page: number;
  text: string;
  confidence?: number;
}

export interface PackedKvp {
  key: string;
  value: string;
  page: number;
  confidence: number;
}

export interface PackedSection {
  name: string;
  lines: PackedLine[];
}

export interface PackedCvInput {
  header_lines: PackedLine[];
  contact_lines: PackedLine[];
  kvp: PackedKvp[];
  sections: PackedSection[];
  detected_languages: string[];
  total_pages: number;
  estimated_tokens: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN LIMITS - ERHÖHT FÜR VOLLSTÄNDIGE EXTRAKTION
// ═══════════════════════════════════════════════════════════════════════════════
// GPT-4o-mini: $0.15/1M input, $0.60/1M output
// Bei 16K input = ~$0.0024 pro CV - sehr überschaubar!
const HEADER_LINES_LIMIT = 80;      // War: 40
const CONTACT_LINES_LIMIT = 50;     // War: 30
const KVP_LIMIT = 60;               // War: 40
const SECTION_LINES_LIMIT = 500;    // War: 250
const TOKEN_HARD_CAP = 16000;       // War: 8000 - Verdoppelt für längere CVs

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
const URL_PATTERN = /https?:\/\/[^\s]+|linkedin\.com|xing\.com|github\.com/i;

const SECTION_HEADERS: Record<string, RegExp[]> = {
  experience: [
    /^berufserfahrung$/i,
    /^work\s*experience$/i,
    /^experience$/i,
    /^employment\s*history$/i,
    /^professional\s*experience$/i,
    /^arbeitserfahrung$/i,
    /^berufliche\s*laufbahn$/i,
    /^karriere$/i,
  ],
  education: [
    /^ausbildung$/i,
    /^education$/i,
    /^academic\s*background$/i,
    /^schulbildung$/i,
    /^studium$/i,
    /^qualifikationen$/i,
    /^academic$/i,
  ],
  skills: [
    /^skills$/i,
    /^fähigkeiten$/i,
    /^kenntnisse$/i,
    /^kompetenzen$/i,
    /^technical\s*skills$/i,
    /^it[-\s]*kenntnisse$/i,
    /^expertisen?$/i,
  ],
  languages: [
    /^sprachen$/i,
    /^languages$/i,
    /^sprachkenntnisse$/i,
    /^language\s*skills$/i,
  ],
  certificates: [
    /^zertifikate$/i,
    /^certifications?$/i,
    /^certificates$/i,
    /^weiterbildung$/i,
  ],
  profile: [
    /^profil$/i,
    /^profile$/i,
    /^summary$/i,
    /^zusammenfassung$/i,
    /^about\s*me$/i,
    /^über\s*mich$/i,
  ],
};

const RELEVANT_KVP_KEYS = [
  "name", "vorname", "nachname", "first name", "last name", "firstname", "lastname",
  "email", "e-mail", "mail",
  "phone", "telefon", "tel", "mobile", "handy", "mobil",
  "address", "adresse", "street", "strasse", "straße",
  "city", "stadt", "ort", "plz", "zip", "postal",
  "nationality", "nationalität", "staatsangehörigkeit",
  "date of birth", "geburtsdatum", "birthday",
  "linkedin", "xing", "github",
];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function generateLineId(pageNumber: number, lineIndex: number): string {
  return `p${pageNumber}_l${lineIndex}`;
}

function isContactLine(line: DocumentLine): boolean {
  return EMAIL_PATTERN.test(line.text) || PHONE_PATTERN.test(line.text) || URL_PATTERN.test(line.text);
}

function detectSectionType(text: string): string | null {
  const normalized = text.trim();
  for (const [section, patterns] of Object.entries(SECTION_HEADERS)) {
    if (patterns.some((p) => p.test(normalized))) {
      return section;
    }
  }
  return null;
}

function isRelevantKvp(key: string): boolean {
  const normalized = key.toLowerCase().trim();
  return RELEVANT_KVP_KEYS.some((k) => normalized.includes(k));
}

export function packCvForLLM(documentRep: DocumentRep): PackedCvInput {
  const headerLines: PackedLine[] = [];
  const contactLines: PackedLine[] = [];
  const sections: PackedSection[] = [];
  const kvp: PackedKvp[] = [];

  const allLines: Array<{ line: DocumentLine; pageNumber: number; lineIndex: number }> = [];
  for (const page of documentRep.pages) {
    page.lines.forEach((line, idx) => {
      allLines.push({ line, pageNumber: page.pageNumber, lineIndex: idx });
    });
  }

  let headerCount = 0;
  for (const { line, pageNumber, lineIndex } of allLines) {
    if (pageNumber === 1 && headerCount < HEADER_LINES_LIMIT) {
      headerLines.push({
        lineId: generateLineId(pageNumber, lineIndex),
        page: pageNumber,
        text: line.text,
        confidence: line.confidence,
      });
      headerCount++;
    }
  }

  let contactCount = 0;
  for (const { line, pageNumber, lineIndex } of allLines) {
    if (isContactLine(line) && contactCount < CONTACT_LINES_LIMIT) {
      const lineId = generateLineId(pageNumber, lineIndex);
      if (!contactLines.some((cl) => cl.lineId === lineId)) {
        contactLines.push({
          lineId,
          page: pageNumber,
          text: line.text,
          confidence: line.confidence,
        });
        contactCount++;
      }
    }
  }

  for (const kv of documentRep.keyValuePairs) {
    if (isRelevantKvp(kv.key) && kvp.length < KVP_LIMIT) {
      kvp.push({
        key: kv.key,
        value: kv.value,
        page: kv.page,
        confidence: kv.confidence,
      });
    }
  }

  let currentSection: PackedSection | null = null;
  let totalSectionLines = 0;

  for (const { line, pageNumber, lineIndex } of allLines) {
    const sectionType = detectSectionType(line.text);

    if (sectionType) {
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name: sectionType, lines: [] };
      continue;
    }

    if (currentSection && totalSectionLines < SECTION_LINES_LIMIT) {
      currentSection.lines.push({
        lineId: generateLineId(pageNumber, lineIndex),
        page: pageNumber,
        text: line.text,
        confidence: line.confidence,
      });
      totalSectionLines++;
    }
  }

  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  const detectedLanguages = documentRep.detectedLanguages.map((l) => l.locale);

  let estimatedTokens = 0;
  estimatedTokens += headerLines.reduce((sum, l) => sum + estimateTokens(l.text), 0);
  estimatedTokens += contactLines.reduce((sum, l) => sum + estimateTokens(l.text), 0);
  estimatedTokens += kvp.reduce((sum, k) => sum + estimateTokens(k.key + k.value), 0);
  estimatedTokens += sections.reduce(
    (sum, s) => sum + s.lines.reduce((ls, l) => ls + estimateTokens(l.text), 0),
    0
  );
  estimatedTokens += 500;

  if (estimatedTokens > TOKEN_HARD_CAP) {
    let excess = estimatedTokens - TOKEN_HARD_CAP;

    for (const section of [...sections].reverse()) {
      if (section.name === "skills" || section.name === "certificates") {
        while (section.lines.length > 10 && excess > 0) {
          const removed = section.lines.pop();
          if (removed) {
            excess -= estimateTokens(removed.text);
          }
        }
      }
    }

    for (const section of sections) {
      while (section.lines.length > 50 && excess > 0) {
        const removed = section.lines.pop();
        if (removed) {
          excess -= estimateTokens(removed.text);
        }
      }
    }
  }

  estimatedTokens = 0;
  estimatedTokens += headerLines.reduce((sum, l) => sum + estimateTokens(l.text), 0);
  estimatedTokens += contactLines.reduce((sum, l) => sum + estimateTokens(l.text), 0);
  estimatedTokens += kvp.reduce((sum, k) => sum + estimateTokens(k.key + k.value), 0);
  estimatedTokens += sections.reduce(
    (sum, s) => sum + s.lines.reduce((ls, l) => ls + estimateTokens(l.text), 0),
    0
  );
  estimatedTokens += 500;

  return {
    header_lines: headerLines,
    contact_lines: contactLines,
    kvp,
    sections,
    detected_languages: detectedLanguages,
    total_pages: documentRep.pageCount,
    estimated_tokens: estimatedTokens,
  };
}

export function getPackedInputAsJson(packed: PackedCvInput): string {
  return JSON.stringify(packed, null, 0);
}

export function packCvForLlm(rawText: string, pageCount: number = 1): PackedCvInput {
  const lines = rawText.split("\n").filter((l) => l.trim());
  const headerLines: PackedLine[] = [];
  const contactLines: PackedLine[] = [];
  const sections: PackedSection[] = [];
  const kvp: PackedKvp[] = [];

  let headerCount = 0;
  let currentSection: PackedSection | null = null;
  let totalSectionLines = 0;
  let lineIndex = 0;
  const pageNumber = 1;

  for (const text of lines) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    const lineId = generateLineId(pageNumber, lineIndex);
    const packedLine: PackedLine = { lineId, page: pageNumber, text: trimmed };

    if (headerCount < HEADER_LINES_LIMIT && lineIndex < 50) {
      headerLines.push(packedLine);
      headerCount++;
    }

    if (EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed) || URL_PATTERN.test(trimmed)) {
      if (contactLines.length < CONTACT_LINES_LIMIT) {
        contactLines.push(packedLine);
      }
    }

    const kvMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (kvMatch && kvMatch[1] && kvMatch[2]) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      if (isRelevantKvp(key) && kvp.length < KVP_LIMIT) {
        kvp.push({ key, value, page: pageNumber, confidence: 1 });
      }
    }

    const sectionType = detectSectionType(trimmed);
    if (sectionType) {
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name: sectionType, lines: [] };
    } else if (currentSection && totalSectionLines < SECTION_LINES_LIMIT) {
      currentSection.lines.push(packedLine);
      totalSectionLines++;
    }

    lineIndex++;
  }

  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  if (sections.length === 0 && lines.length > 0) {
    const genericSection: PackedSection = {
      name: "content",
      lines: lines.slice(Math.min(50, lines.length)).map((text, idx) => ({
        lineId: generateLineId(1, 50 + idx),
        page: 1,
        text: text.trim(),
      })).filter(l => l.text),
    };
    if (genericSection.lines.length > 0) {
      sections.push(genericSection);
    }
  }

  let estimatedTokens = 0;
  estimatedTokens += headerLines.reduce((sum, l) => sum + estimateTokens(l.text), 0);
  estimatedTokens += contactLines.reduce((sum, l) => sum + estimateTokens(l.text), 0);
  estimatedTokens += kvp.reduce((sum, k) => sum + estimateTokens(k.key + k.value), 0);
  estimatedTokens += sections.reduce(
    (sum, s) => sum + s.lines.reduce((ls, l) => ls + estimateTokens(l.text), 0),
    0
  );
  estimatedTokens += 500;

  return {
    header_lines: headerLines,
    contact_lines: contactLines,
    kvp,
    sections,
    detected_languages: [],
    total_pages: pageCount,
    estimated_tokens: Math.min(estimatedTokens, TOKEN_HARD_CAP),
  };
}

