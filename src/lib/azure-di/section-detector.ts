import "server-only";

import type { DocumentRep, DocumentLine } from "./types";

export type SectionType = 
  | "personal"
  | "experience" 
  | "education"
  | "skills"
  | "languages"
  | "certificates"
  | "unknown";

export interface DetectedSection {
  type: SectionType;
  startPage: number;
  startLineIndex: number;
  endPage: number;
  endLineIndex: number;
  headerText: string;
  lines: Array<DocumentLine & { pageNumber: number; lineIndex: number }>;
}

const SECTION_HEADERS: Record<SectionType, string[]> = {
  personal: [
    "persönliche daten", "personal data", "personal information", "kontakt",
    "contact", "about me", "über mich", "profil", "profile", "données personnelles"
  ],
  experience: [
    "berufserfahrung", "work experience", "professional experience", "experience",
    "arbeitserfahrung", "berufliche erfahrung", "employment history", "career",
    "karriere", "werdegang", "beruflicher werdegang", "expérience professionnelle",
    "positions", "stellenhistorie", "employment"
  ],
  education: [
    "ausbildung", "education", "bildung", "studium", "akademische ausbildung",
    "academic background", "academic education", "qualifications", "qualifikationen",
    "schulausbildung", "formation", "diplome", "degrees", "abschlüsse"
  ],
  skills: [
    "skills", "fähigkeiten", "kenntnisse", "kompetenzen", "competencies",
    "technische kenntnisse", "technical skills", "it skills", "it kenntnisse",
    "fachwissen", "expertise", "kompetenzprofil", "qualifications"
  ],
  languages: [
    "sprachen", "languages", "sprachkenntnisse", "language skills", "langues",
    "fremdsprachen", "sprachkompetenzen"
  ],
  certificates: [
    "zertifikate", "certificates", "certifications", "zertifizierungen",
    "weiterbildung", "further education", "training", "kurse", "courses",
    "fortbildungen", "additional training"
  ],
  unknown: [],
};

function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[:\-–—•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSectionType(text: string): SectionType {
  const normalized = normalizeText(text);
  
  for (const [sectionType, headers] of Object.entries(SECTION_HEADERS)) {
    if (sectionType === "unknown") continue;
    
    for (const header of headers) {
      if (normalized === header || normalized.startsWith(header + " ") || normalized.endsWith(" " + header)) {
        return sectionType as SectionType;
      }
    }
  }

  for (const [sectionType, headers] of Object.entries(SECTION_HEADERS)) {
    if (sectionType === "unknown") continue;
    
    for (const header of headers) {
      if (normalized.includes(header)) {
        return sectionType as SectionType;
      }
    }
  }

  return "unknown";
}

function isLikelyHeader(line: DocumentLine, pageLines: DocumentLine[]): boolean {
  const text = line.text.trim();
  
  if (text.length < 3 || text.length > 60) return false;
  
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 6) return false;
  
  const lineIndex = pageLines.indexOf(line);
  if (lineIndex > 0) {
    const prevLine = pageLines[lineIndex - 1];
    const currentY = line.polygon?.points[0]?.y || 0;
    const prevY = prevLine.polygon?.points[0]?.y || 0;
    const gap = currentY - prevY;
    if (gap > 30) return true;
  }
  
  if (/^[A-ZÄÖÜ\s]+$/.test(text) && text.length > 5) return true;
  
  return detectSectionType(text) !== "unknown";
}

export function detectSections(docRep: DocumentRep): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const allLines: Array<DocumentLine & { pageNumber: number; lineIndex: number }> = [];

  for (const page of docRep.pages) {
    for (let i = 0; i < page.lines.length; i++) {
      allLines.push({
        ...page.lines[i],
        pageNumber: page.pageNumber,
        lineIndex: i,
      });
    }
  }

  const sectionBoundaries: Array<{
    type: SectionType;
    headerText: string;
    pageNumber: number;
    lineIndex: number;
    globalIndex: number;
  }> = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const sectionType = detectSectionType(line.text);
    
    if (sectionType !== "unknown") {
      const page = docRep.pages.find((p) => p.pageNumber === line.pageNumber);
      if (page && isLikelyHeader(line, page.lines)) {
        sectionBoundaries.push({
          type: sectionType,
          headerText: line.text,
          pageNumber: line.pageNumber,
          lineIndex: line.lineIndex,
          globalIndex: i,
        });
      }
    }
  }

  if (sectionBoundaries.length === 0) {
    sections.push({
      type: "personal",
      startPage: 1,
      startLineIndex: 0,
      endPage: docRep.pages[docRep.pages.length - 1]?.pageNumber || 1,
      endLineIndex: docRep.pages[docRep.pages.length - 1]?.lines.length - 1 || 0,
      headerText: "",
      lines: allLines,
    });
    return sections;
  }

  if (sectionBoundaries[0].globalIndex > 0) {
    sections.push({
      type: "personal",
      startPage: 1,
      startLineIndex: 0,
      endPage: sectionBoundaries[0].pageNumber,
      endLineIndex: sectionBoundaries[0].lineIndex - 1,
      headerText: "Personal Info",
      lines: allLines.slice(0, sectionBoundaries[0].globalIndex),
    });
  }

  for (let i = 0; i < sectionBoundaries.length; i++) {
    const boundary = sectionBoundaries[i];
    const nextBoundary = sectionBoundaries[i + 1];

    const startIdx = boundary.globalIndex + 1;
    const endIdx = nextBoundary ? nextBoundary.globalIndex : allLines.length;

    sections.push({
      type: boundary.type,
      startPage: boundary.pageNumber,
      startLineIndex: boundary.lineIndex,
      endPage: nextBoundary?.pageNumber || docRep.pages[docRep.pages.length - 1]?.pageNumber || 1,
      endLineIndex: nextBoundary?.lineIndex ? nextBoundary.lineIndex - 1 : allLines[allLines.length - 1]?.lineIndex || 0,
      headerText: boundary.headerText,
      lines: allLines.slice(startIdx, endIdx),
    });
  }

  return sections;
}

export function findSectionByType(sections: DetectedSection[], type: SectionType): DetectedSection | undefined {
  return sections.find((s) => s.type === type);
}

export function getSectionText(section: DetectedSection): string {
  return section.lines.map((l) => l.text).join("\n");
}

