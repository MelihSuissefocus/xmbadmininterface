/**
 * CV Parser Module
 * Central entry point for all CV parsing, normalization, validation, and mapping.
 */

export type { ParsedCvData, ParsedLanguage, ParsedCertification, ParsedEducation, ParsedWorkExperience } from "./types";
export { createEmptyParsedCv } from "./types";

export {
  parseDate,
  parsePeriod,
  calculateYearsOfExperience,
  normalizeSkill,
  normalizeAndDeduplicateSkills,
  normalizeLanguageLevel,
  normalizeLanguageName,
  parseLanguageEntry,
  detectSubcontractor,
  cleanNameFromTitles,
  normalizePhone,
  parseAddress,
  normalizeAvailableFrom,
  parseCertificate,
  filterHighlights,
} from "./normalizers";

export { validateParsedCv } from "./validator";
export { parsedCvToDraftV2, parsedCvToFormData } from "./schema-mapper";
export { mapMacMiniResponseToParsedCv } from "./mac-mini-mapper";
export { mapLlmResponseToParsedCv } from "./llm-mapper";
