/**
 * Types for the Mac Mini LLM CV Extraction API
 * Matches the JSON schema returned by the local LLM model
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
  zeitraum?: string | null;
}

export interface MacMiniCvSprache {
  sprache: string;
  niveau?: string | null;
}

export interface MacMiniSubmitResponse {
  status: string;
  job_id: string;
}

export interface MacMiniCvResponse {
  vorname: string;
  nachname: string;
  email?: string | null;
  telefon?: string | null;
  adresse?: string | null;
  plz?: string | null;
  ort?: string | null;
  kanton?: string | null;
  linkedin?: string | null;
  geburtsdatum?: string | null;
  nationalitaet?: string | null;
  kernkompetenzen: string[];
  sprachen: MacMiniCvSprache[] | string[];
  erfahrungen: MacMiniCvErfahrung[];
  ausbildungen: MacMiniCvAusbildung[];
  weiterbildungen: string[];
  gewuenschte_rolle?: string | null;
  verfuegbar_ab?: string | null;
  kuendigungsfrist?: string | null;
  arbeitspensum?: string | null;
  gewuenschter_lohn?: string | null;
  unklare_inhalte: string | null;
  sonstiger_text?: string[] | null;
}
