/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COMPLETENESS VALIDATOR
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PROBLEM:
 * Das LLM kann Daten "vergessen" oder ignorieren, selbst mit starken Prompts.
 * Token-Limits können zur stillen Trunkierung führen.
 * 
 * LÖSUNG:
 * Dieser Validator prüft MATHEMATISCH, dass jede Zeile des Inputs entweder:
 * 1. In extracted_data referenziert wurde (via evidence.lineId)
 * 2. In unmapped_segments erfasst wurde
 * 3. Als "ignorierbar" klassifiziert wurde (Leerzeilen, Seitenzahlen, etc.)
 * 
 * GARANTIE:
 * Nach erfolgreicher Validierung können wir sagen:
 * "100% der signifikanten Daten wurden verarbeitet"
 */

import type { PackedCvInput, PackedLine } from "@/lib/cv-pack";
import type { CognitiveResponse, UnmappedSegment, Evidence } from "./schema";

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC EXTRACTION RESPONSE TYPE
// ═══════════════════════════════════════════════════════════════════════════════
// Unterstützt beide Schema-Formate: cv-engine und extraction-engine

interface GenericEvidence {
  lineId: string;
  page: number;
  text: string;
}

interface GenericUnmappedSegment {
  // camelCase (cv-engine)
  lineReference?: string | null;
  // snake_case (extraction-engine)
  line_reference?: string | null;
}

interface GenericExtractedData {
  person: {
    firstName: string | null;
    lastName: string | null;
    evidence: GenericEvidence[];
  };
  contact: {
    email: string | null;
    phone: string | null;
    evidence: GenericEvidence[];
  };
  languages: Array<{ name: string; evidence: GenericEvidence[] }>;
  skills: Array<{ name: string; evidence: GenericEvidence[] }>;
  experience: Array<{ company?: string | null; title?: string | null; evidence: GenericEvidence[] }>;
  education: Array<{ institution?: string | null; degree?: string | null; evidence: GenericEvidence[] }>;
}

/**
 * Generic response type that works with both cv-engine and extraction-engine schemas
 */
export interface GenericExtractionResponse {
  _thought_process: string;
  extracted_data: GenericExtractedData;
  unmapped_segments: GenericUnmappedSegment[];
  metadata?: {
    warnings?: string[];
    implicitMappingsApplied?: string[];
  };
  extraction_metadata?: {
    warnings?: string[];
    implicit_mappings_applied?: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompletenessReport {
  /** Ist die Extraktion vollständig? */
  isComplete: boolean;
  
  /** Gesamtzahl der Input-Zeilen */
  totalInputLines: number;
  
  /** Zeilen, die in extracted_data referenziert wurden */
  extractedLineIds: string[];
  
  /** Zeilen, die in unmapped_segments erfasst wurden */
  unmappedLineIds: string[];
  
  /** Zeilen, die als ignorierbar klassifiziert wurden */
  ignoredLineIds: string[];
  
  /** KRITISCH: Zeilen, die komplett fehlen */
  missingLineIds: string[];
  
  /** Detaillierte Informationen zu fehlenden Zeilen */
  missingLines: Array<{
    lineId: string;
    page: number;
    text: string;
    possibleReason: string;
  }>;
  
  /** Vollständigkeits-Prozentsatz */
  completenessPercentage: number;
  
  /** Wurden Token-Limits erreicht? (Warnung) */
  tokenLimitReached: boolean;
  
  /** Anzahl der durch Token-Limit abgeschnittenen Zeilen */
  truncatedLinesCount: number;
  
  /** Zusammenfassung als String */
  summary: string;
}

export interface ValidatorConfig {
  /** Minimale Textlänge, ab der eine Zeile als "signifikant" gilt */
  minSignificantLineLength?: number;
  
  /** Patterns für Zeilen, die ignoriert werden können */
  ignorablePatterns?: RegExp[];
  
  /** Strenger Modus: Auch kurze Zeilen müssen erfasst werden */
  strictMode?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Required<ValidatorConfig> = {
  minSignificantLineLength: 3,
  ignorablePatterns: [
    /^\s*$/,                           // Leerzeilen
    /^\d+\s*$/,                        // Nur Seitenzahlen
    /^page\s*\d+/i,                    // "Page 1", "Page 2"
    /^seite\s*\d+/i,                   // "Seite 1", "Seite 2"
    /^[-─═_]{3,}$/,                    // Trennlinien
    /^[•●○◦▪▫]\s*$/,                   // Leere Aufzählungspunkte
    /^\s*[|│]\s*$/,                    // Vertikale Linien
    /^curriculum\s*vitae$/i,           // "Curriculum Vitae" Titel
    /^lebenslauf$/i,                   // "Lebenslauf" Titel
    /^resume$/i,                       // "Resume" Titel
    /^cv$/i,                           // "CV" Titel
  ],
  strictMode: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETENESS VALIDATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class CompletenessValidator {
  private config: Required<ValidatorConfig>;
  
  constructor(config: ValidatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Validiert die Vollständigkeit einer Extraktion
   * 
   * @param input Das ursprüngliche gepackte CV-Input
   * @param response Die LLM-Antwort
   * @returns CompletenessReport mit detaillierten Informationen
   */
  validate(input: PackedCvInput, response: GenericExtractionResponse | CognitiveResponse): CompletenessReport {
    // 1. Sammle alle Input-Zeilen
    const allInputLines = this.collectAllInputLines(input);
    const totalInputLines = allInputLines.length;
    
    // 2. Sammle alle referenzierten LineIds aus extracted_data
    const extractedLineIds = this.collectExtractedLineIds(response);
    
    // 3. Sammle alle LineIds aus unmapped_segments
    const unmappedLineIds = this.collectUnmappedLineIds(response);
    
    // 4. Identifiziere ignorierbare Zeilen
    const ignoredLineIds = this.identifyIgnorableLines(allInputLines);
    
    // 5. Finde fehlende Zeilen
    const accountedLineIds = new Set([
      ...extractedLineIds,
      ...unmappedLineIds,
      ...ignoredLineIds,
    ]);
    
    const missingLineIds = allInputLines
      .filter(line => !accountedLineIds.has(line.lineId))
      .map(line => line.lineId);
    
    // 6. Detaillierte Informationen zu fehlenden Zeilen
    const missingLines = missingLineIds.map(lineId => {
      const line = allInputLines.find(l => l.lineId === lineId);
      return {
        lineId,
        page: line?.page ?? 0,
        text: line?.text ?? "",
        possibleReason: this.guessMissingReason(line),
      };
    });
    
    // 7. Prüfe auf Token-Limit-Trunkierung
    const tokenLimitReached = input.estimated_tokens >= 7500; // Nahe am 8000er Limit
    const truncatedLinesCount = this.estimateTruncatedLines(input);
    
    // 8. Berechne Vollständigkeits-Prozentsatz
    const significantLines = allInputLines.filter(
      line => !ignoredLineIds.includes(line.lineId)
    ).length;
    
    const accountedSignificantLines = significantLines - missingLines.filter(
      ml => !this.isIgnorable(ml.text)
    ).length;
    
    const completenessPercentage = significantLines > 0
      ? Math.round((accountedSignificantLines / significantLines) * 100)
      : 100;
    
    // 9. Ist die Extraktion vollständig?
    const isComplete = missingLines.filter(
      ml => !this.isIgnorable(ml.text) && ml.text.length >= this.config.minSignificantLineLength
    ).length === 0;
    
    // 10. Erstelle Zusammenfassung
    const summary = this.buildSummary(
      isComplete,
      totalInputLines,
      extractedLineIds.length,
      unmappedLineIds.length,
      ignoredLineIds.length,
      missingLines.length,
      completenessPercentage,
      tokenLimitReached
    );
    
    return {
      isComplete,
      totalInputLines,
      extractedLineIds,
      unmappedLineIds,
      ignoredLineIds,
      missingLineIds,
      missingLines,
      completenessPercentage,
      tokenLimitReached,
      truncatedLinesCount,
      summary,
    };
  }
  
  /**
   * Schnelle Prüfung ob Extraktion vollständig ist
   */
  isExtractionComplete(input: PackedCvInput, response: GenericExtractionResponse | CognitiveResponse): boolean {
    const report = this.validate(input, response);
    return report.isComplete;
  }
  
  /**
   * Gibt fehlende Zeilen zurück, die dem LLM erneut vorgelegt werden sollten
   */
  getMissingSignificantLines(
    input: PackedCvInput,
    response: GenericExtractionResponse | CognitiveResponse
  ): PackedLine[] {
    const report = this.validate(input, response);
    const allLines = this.collectAllInputLines(input);
    
    return report.missingLineIds
      .map(id => allLines.find(l => l.lineId === id))
      .filter((line): line is PackedLine => 
        line !== undefined && 
        line.text.length >= this.config.minSignificantLineLength &&
        !this.isIgnorable(line.text)
      );
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Sammelt alle Zeilen aus dem Input
   */
  private collectAllInputLines(input: PackedCvInput): PackedLine[] {
    const lines: PackedLine[] = [];
    
    // Header-Zeilen
    lines.push(...input.header_lines);
    
    // Kontakt-Zeilen
    lines.push(...input.contact_lines);
    
    // Sections
    for (const section of input.sections) {
      lines.push(...section.lines);
    }
    
    // KVPs als virtuelle Zeilen
    for (const kvp of input.kvp) {
      lines.push({
        lineId: `kvp_${kvp.key.toLowerCase().replace(/\s+/g, '_')}`,
        page: kvp.page,
        text: `${kvp.key}: ${kvp.value}`,
        confidence: kvp.confidence,
      });
    }
    
    return lines;
  }
  
  /**
   * Sammelt alle LineIds aus extracted_data (via evidence)
   */
  private collectExtractedLineIds(response: GenericExtractionResponse | CognitiveResponse): string[] {
    const lineIds = new Set<string>();
    const data = response.extracted_data;
    
    // Person evidence
    for (const ev of data.person.evidence) {
      lineIds.add(ev.lineId);
    }
    
    // Contact evidence
    for (const ev of data.contact.evidence) {
      lineIds.add(ev.lineId);
    }
    
    // Languages
    for (const lang of data.languages) {
      for (const ev of lang.evidence) {
        lineIds.add(ev.lineId);
      }
    }
    
    // Skills
    for (const skill of data.skills) {
      for (const ev of skill.evidence) {
        lineIds.add(ev.lineId);
      }
    }
    
    // Experience
    for (const exp of data.experience) {
      for (const ev of exp.evidence) {
        lineIds.add(ev.lineId);
      }
    }
    
    // Education
    for (const edu of data.education) {
      for (const ev of edu.evidence) {
        lineIds.add(ev.lineId);
      }
    }
    
    return Array.from(lineIds);
  }
  
  /**
   * Sammelt alle LineIds aus unmapped_segments
   * Unterstützt sowohl camelCase (lineReference) als auch snake_case (line_reference)
   */
  private collectUnmappedLineIds(response: GenericExtractionResponse | CognitiveResponse): string[] {
    const lineIds: string[] = [];
    
    for (const segment of response.unmapped_segments) {
      // Support both camelCase (cv-engine) and snake_case (extraction-engine)
      const lineRef = (segment as Record<string, unknown>).lineReference 
        ?? (segment as Record<string, unknown>).line_reference;
      if (typeof lineRef === 'string') {
        lineIds.push(lineRef);
      }
    }
    
    return lineIds;
  }
  
  /**
   * Identifiziert Zeilen, die ignoriert werden können
   */
  private identifyIgnorableLines(lines: PackedLine[]): string[] {
    return lines
      .filter(line => this.isIgnorable(line.text))
      .map(line => line.lineId);
  }
  
  /**
   * Prüft ob eine Zeile ignorierbar ist
   */
  private isIgnorable(text: string): boolean {
    // Zu kurz
    if (text.trim().length < this.config.minSignificantLineLength) {
      return true;
    }
    
    // Passt zu einem Ignorable-Pattern
    for (const pattern of this.config.ignorablePatterns) {
      if (pattern.test(text.trim())) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Versucht den Grund für eine fehlende Zeile zu erraten
   */
  private guessMissingReason(line?: PackedLine): string {
    if (!line) return "Zeile nicht im Input gefunden";
    
    const text = line.text.trim();
    
    if (text.length < 5) return "Sehr kurze Zeile - möglicherweise als irrelevant eingestuft";
    if (/^\d+$/.test(text)) return "Nur Zahlen - möglicherweise Seitennummer";
    if (/^[•●○◦▪▫-]\s*\w/.test(text)) return "Aufzählungspunkt - möglicherweise Teil einer Liste";
    if (line.page > 2) return "Auf späterer Seite - möglicherweise durch Token-Limit abgeschnitten";
    
    return "Unbekannt - LLM hat diese Zeile möglicherweise übersehen";
  }
  
  /**
   * Schätzt die Anzahl der abgeschnittenen Zeilen
   */
  private estimateTruncatedLines(input: PackedCvInput): number {
    // Wenn Token-Limit fast erreicht, schätze basierend auf Sections
    if (input.estimated_tokens < 7000) return 0;
    
    let truncated = 0;
    for (const section of input.sections) {
      if (section.lines.length >= 50) {
        truncated += Math.max(0, section.lines.length - 50);
      }
    }
    
    return truncated;
  }
  
  /**
   * Erstellt eine lesbare Zusammenfassung
   */
  private buildSummary(
    isComplete: boolean,
    totalLines: number,
    extractedCount: number,
    unmappedCount: number,
    ignoredCount: number,
    missingCount: number,
    percentage: number,
    tokenLimitReached: boolean
  ): string {
    const lines = [
      `═══════════════════════════════════════════════════════════════════════════════`,
      `COMPLETENESS REPORT`,
      `═══════════════════════════════════════════════════════════════════════════════`,
      ``,
      `Status: ${isComplete ? '✅ VOLLSTÄNDIG' : '⚠️ UNVOLLSTÄNDIG'}`,
      `Vollständigkeit: ${percentage}%`,
      ``,
      `Input-Zeilen gesamt: ${totalLines}`,
      `├── Extrahiert (in extracted_data): ${extractedCount}`,
      `├── Unmapped (in unmapped_segments): ${unmappedCount}`,
      `├── Ignoriert (Leerzeilen, etc.): ${ignoredCount}`,
      `└── FEHLEND: ${missingCount}`,
    ];
    
    if (tokenLimitReached) {
      lines.push(``);
      lines.push(`⚠️ WARNUNG: Token-Limit fast erreicht - möglicherweise Daten abgeschnitten!`);
    }
    
    if (!isComplete) {
      lines.push(``);
      lines.push(`❌ ${missingCount} Zeilen wurden nicht verarbeitet!`);
      lines.push(`   Diese Zeilen sollten manuell überprüft werden.`);
    }
    
    lines.push(`═══════════════════════════════════════════════════════════════════════════════`);
    
    return lines.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON & CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

let validatorInstance: CompletenessValidator | null = null;

export function getCompletenessValidator(config?: ValidatorConfig): CompletenessValidator {
  if (!validatorInstance) {
    validatorInstance = new CompletenessValidator(config);
  }
  return validatorInstance;
}

export function validateCompleteness(
  input: PackedCvInput,
  response: GenericExtractionResponse | CognitiveResponse,
  config?: ValidatorConfig
): CompletenessReport {
  const validator = new CompletenessValidator(config);
  return validator.validate(input, response);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXTRACTION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Baut einen Prompt für die Nachextraktion fehlender Zeilen
 */
export function buildReExtractionPrompt(missingLines: PackedLine[]): string {
  if (missingLines.length === 0) return "";
  
  let prompt = `
═══════════════════════════════════════════════════════════════════════════════
⚠️ FEHLENDE DATEN ENTDECKT - BITTE NACHEXTRAHIEREN ⚠️
═══════════════════════════════════════════════════════════════════════════════

Die folgenden ${missingLines.length} Zeilen wurden bei der ersten Extraktion übersehen.
Analysiere sie JETZT und ordne sie entweder:
1. Einem Feld in extracted_data zu (mit evidence)
2. Oder füge sie zu unmapped_segments hinzu

FEHLENDE ZEILEN:
`;

  for (const line of missingLines) {
    prompt += `\n[${line.lineId}] (Seite ${line.page}): "${line.text}"`;
  }
  
  prompt += `

DEINE AUFGABE:
1. Analysiere jede Zeile in _thought_process
2. Extrahiere oder füge zu unmapped_segments hinzu
3. Stelle sicher, dass JEDE dieser Zeilen verarbeitet wird!
`;

  return prompt;
}

