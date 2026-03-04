/**
 * Types for the Mac Mini LLM CV Extraction API
 * Matches the JSON schema returned by the local 14B model
 */

export interface MacMiniCvErfahrung {
  zeitraum: string;
  rolle: string;
  projekt_id: string | null;
  aufgaben: string[];
  erfolge: string[];
  herausforderungen_und_learnings: string[];
  tools: string[];
}

export interface MacMiniCvAusbildung {
  abschluss: string;
  institution: string;
}

export interface MacMiniCvResponse {
  vorname: string;
  nachname: string;
  kernkompetenzen: string[];
  sprachen: string[];
  erfahrungen: MacMiniCvErfahrung[];
  ausbildungen: MacMiniCvAusbildung[];
  weiterbildungen: string[];
  unklare_inhalte: string | null;
}
