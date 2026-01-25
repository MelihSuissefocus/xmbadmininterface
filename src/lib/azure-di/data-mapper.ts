import "server-only";

import type {
  DocumentRep,
  CandidateAutoFillDraftV2,
  ExtractedFieldWithEvidence,
  FieldEvidence,
} from "./types";
import { CV_EXTRACTION_VERSION } from "./types";
import { detectSections, findSectionByType, type DetectedSection } from "./section-detector";
import { calculateConfidence, getConfidenceLevel, defaultFactors, type ConfidenceFactors } from "./confidence";
import { validateEmail, normalizePhoneE164, normalizeCanton, parseCEFRLevel, parseDate } from "./validation";

interface SynonymMap {
  [sourceLabel: string]: string;
}

const DEFAULT_SYNONYMS: SynonymMap = {
  vorname: "firstName",
  "first name": "firstName",
  prénom: "firstName",
  nachname: "lastName",
  familienname: "lastName",
  "last name": "lastName",
  surname: "lastName",
  nom: "lastName",
  "nom de famille": "lastName",
  email: "email",
  "e-mail": "email",
  mail: "email",
  telefon: "phone",
  phone: "phone",
  tel: "phone",
  mobile: "phone",
  handy: "phone",
  téléphone: "phone",
  adresse: "street",
  strasse: "street",
  straße: "street",
  street: "street",
  address: "street",
  plz: "postalCode",
  postleitzahl: "postalCode",
  "postal code": "postalCode",
  zip: "postalCode",
  "zip code": "postalCode",
  ort: "city",
  stadt: "city",
  wohnort: "city",
  city: "city",
  ville: "city",
  kanton: "canton",
  canton: "canton",
  linkedin: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  position: "targetRole",
  zielposition: "targetRole",
  "target role": "targetRole",
  beruf: "targetRole",
  geburtsdatum: "birthdate",
  "date of birth": "birthdate",
  birthday: "birthdate",
};

const LANGUAGE_NAMES: Record<string, string> = {
  deutsch: "Deutsch",
  german: "Deutsch",
  allemand: "Deutsch",
  englisch: "Englisch",
  english: "Englisch",
  anglais: "Englisch",
  französisch: "Französisch",
  french: "Französisch",
  français: "Französisch",
  italienisch: "Italienisch",
  italian: "Italienisch",
  italien: "Italienisch",
  spanisch: "Spanisch",
  spanish: "Spanisch",
  espagnol: "Spanisch",
  portugiesisch: "Portugiesisch",
  portuguese: "Portugiesisch",
  russisch: "Russisch",
  russian: "Russisch",
  chinesisch: "Chinesisch",
  chinese: "Chinesisch",
  japanisch: "Japanisch",
  japanese: "Japanisch",
  arabisch: "Arabisch",
  arabic: "Arabisch",
  türkisch: "Türkisch",
  turkish: "Türkisch",
  niederländisch: "Niederländisch",
  dutch: "Niederländisch",
  polnisch: "Polnisch",
  polish: "Polnisch",
  schwedisch: "Schwedisch",
  swedish: "Schwedisch",
  norwegisch: "Norwegisch",
  norwegian: "Norwegisch",
  dänisch: "Dänisch",
  danish: "Dänisch",
  finnisch: "Finnisch",
  finnish: "Finnisch",
  griechisch: "Griechisch",
  greek: "Griechisch",
  tschechisch: "Tschechisch",
  czech: "Tschechisch",
  ungarisch: "Ungarisch",
  hungarian: "Ungarisch",
  rumänisch: "Rumänisch",
  romanian: "Rumänisch",
  kroatisch: "Kroatisch",
  croatian: "Kroatisch",
  serbisch: "Serbisch",
  serbian: "Serbisch",
  ukrainisch: "Ukrainisch",
  ukrainian: "Ukrainisch",
  hebräisch: "Hebräisch",
  hebrew: "Hebräisch",
  hindi: "Hindi",
  bengali: "Bengali",
  koreanisch: "Koreanisch",
  korean: "Koreanisch",
  thailändisch: "Thailändisch",
  thai: "Thailändisch",
  vietnamesisch: "Vietnamesisch",
  vietnamese: "Vietnamesisch",
};

function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/[:\-–—]/g, "").replace(/\s+/g, " ");
}

function createEvidence(
  text: string,
  page: number,
  confidence: number,
  polygon?: { points: Array<{ x: number; y: number }> }
): FieldEvidence {
  return {
    page,
    polygon,
    exactText: text,
    confidence,
  };
}

interface ExtractionContext {
  synonyms: SynonymMap;
  dbSkills: string[];
  skillAliases: Map<string, string>;
}

function extractFromKVPs(
  docRep: DocumentRep,
  ctx: ExtractionContext
): Map<string, { value: string; evidence: FieldEvidence; factors: ConfidenceFactors }> {
  const results = new Map<string, { value: string; evidence: FieldEvidence; factors: ConfidenceFactors }>();

  for (const kv of docRep.keyValuePairs) {
    const normalizedKey = normalizeKey(kv.key);
    const targetField = ctx.synonyms[normalizedKey];

    if (!targetField || !kv.value.trim()) continue;

    const existing = results.get(targetField);
    if (existing && existing.factors.sourceConfidence >= kv.confidence) continue;

    const factors: ConfidenceFactors = {
      sourceConfidence: kv.confidence,
      validationPass: true,
      labelProximity: 1.0,
      uniqueness: 1.0,
      repetitionCount: 1,
      sectionMatch: true,
    };

    results.set(targetField, {
      value: kv.value.trim(),
      evidence: createEvidence(kv.value, kv.page, kv.confidence, kv.valuePolygon),
      factors,
    });
  }

  return results;
}

function extractNameFromHeader(
  docRep: DocumentRep,
  existingFields: Set<string>
): ExtractedFieldWithEvidence[] {
  const fields: ExtractedFieldWithEvidence[] = [];
  if (existingFields.has("firstName") && existingFields.has("lastName")) {
    return fields;
  }

  const firstPage = docRep.pages[0];
  if (!firstPage || firstPage.lines.length === 0) return fields;

  const headerLines = firstPage.lines.slice(0, 8);
  
  for (const line of headerLines) {
    const text = line.text.trim();
    if (text.length < 3 || text.length > 50) continue;
    
    const lowerText = text.toLowerCase();
    const skipPatterns = ["lebenslauf", "cv", "curriculum", "resume", "profil", "profile", "@", "http", "www", "+"];
    if (skipPatterns.some((p) => lowerText.includes(p))) continue;
    if (/^\d/.test(text)) continue;

    const words = text.split(/\s+/).filter((w) => w.length > 1 && /^[A-Za-zÄÖÜäöüß]/.test(w));
    if (words.length < 2 || words.length > 4) continue;

    const allCapitalized = words.every((w) => /^[A-ZÄÖÜ]/.test(w));
    if (!allCapitalized) continue;

    const factors = defaultFactors();
    factors.sourceConfidence = line.confidence;
    factors.labelProximity = 0.6;
    factors.uniqueness = 0.8;

    const { score, status } = calculateConfidence(factors);
    if (status === "skip") continue;

    if (!existingFields.has("firstName")) {
      fields.push({
        targetField: "firstName",
        extractedValue: words[0],
        confidence: getConfidenceLevel(score),
        evidence: createEvidence(text, 1, score, line.polygon),
      });
      existingFields.add("firstName");
    }

    if (!existingFields.has("lastName")) {
      fields.push({
        targetField: "lastName",
        extractedValue: words.slice(1).join(" "),
        confidence: getConfidenceLevel(score),
        evidence: createEvidence(text, 1, score, line.polygon),
      });
      existingFields.add("lastName");
    }
    break;
  }

  return fields;
}

function extractLanguagesFromSection(
  section: DetectedSection | undefined
): Array<{ language: string; level: string; evidence: FieldEvidence; score: number }> {
  const results: Array<{ language: string; level: string; evidence: FieldEvidence; score: number }> = [];
  if (!section) return results;

  for (const line of section.lines) {
    const text = line.text.trim();
    const lowerText = text.toLowerCase();

    for (const [langKey, langName] of Object.entries(LANGUAGE_NAMES)) {
      if (lowerText.includes(langKey)) {
        const level = parseCEFRLevel(text) || "B2";
        
        const factors = defaultFactors();
        factors.sectionMatch = true;
        factors.sourceConfidence = line.confidence;
        const { score } = calculateConfidence(factors);

        if (!results.some((r) => r.language === langName)) {
          results.push({
            language: langName,
            level,
            evidence: createEvidence(text, line.pageNumber, score, line.polygon),
            score,
          });
        }
        break;
      }
    }
  }

  return results;
}

function extractSkillsFromSection(
  section: DetectedSection | undefined,
  ctx: ExtractionContext
): Array<{ skill: string; evidence: FieldEvidence; score: number }> {
  const results: Array<{ skill: string; evidence: FieldEvidence; score: number }> = [];
  if (!section) return results;

  const foundSkills = new Set<string>();

  for (const line of section.lines) {
    const text = line.text;
    const words = text.split(/[,;|•·\-\n\t]+/).map((w) => w.trim()).filter((w) => w.length > 1);

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      const aliasMatch = ctx.skillAliases.get(lowerWord);
      if (aliasMatch && !foundSkills.has(aliasMatch)) {
        foundSkills.add(aliasMatch);
        const factors = defaultFactors();
        factors.sectionMatch = true;
        const { score } = calculateConfidence(factors);
        results.push({
          skill: aliasMatch,
          evidence: createEvidence(word, line.pageNumber, score, line.polygon),
          score,
        });
        continue;
      }

      const exactMatch = ctx.dbSkills.find((s) => s.toLowerCase() === lowerWord);
      if (exactMatch && !foundSkills.has(exactMatch)) {
        foundSkills.add(exactMatch);
        const factors = defaultFactors();
        factors.sectionMatch = true;
        const { score } = calculateConfidence(factors);
        results.push({
          skill: exactMatch,
          evidence: createEvidence(word, line.pageNumber, score, line.polygon),
          score,
        });
        continue;
      }

      const partialMatch = ctx.dbSkills.find((s) => 
        s.toLowerCase().includes(lowerWord) || lowerWord.includes(s.toLowerCase())
      );
      if (partialMatch && !foundSkills.has(partialMatch)) {
        foundSkills.add(partialMatch);
        const factors = defaultFactors();
        factors.sectionMatch = true;
        factors.labelProximity = 0.7;
        const { score } = calculateConfidence(factors);
        results.push({
          skill: partialMatch,
          evidence: createEvidence(word, line.pageNumber, score, line.polygon),
          score,
        });
      }
    }
  }

  return results;
}

interface ExperienceItem {
  company: string;
  title: string;
  startDate?: { year?: number; month?: number };
  endDate?: { year?: number; month?: number };
  location?: string;
  description?: string;
  evidence: FieldEvidence;
  score: number;
}

function extractExperienceFromSection(section: DetectedSection | undefined): ExperienceItem[] {
  const results: ExperienceItem[] = [];
  if (!section || section.lines.length === 0) return results;

  let currentItem: Partial<ExperienceItem> | null = null;
  let descriptionLines: string[] = [];

  for (let i = 0; i < section.lines.length; i++) {
    const line = section.lines[i];
    const text = line.text.trim();
    if (!text) continue;

    const dateMatch = text.match(/\b(0?[1-9]|1[0-2])[.\/-]?(19|20)\d{2}\b|\b(19|20)\d{2}\b/);
    const hasDateRange = text.includes("-") || text.includes("–") || text.includes("bis") || text.includes("to");
    
    const isNewEntry = (dateMatch && hasDateRange) || 
                       (i > 0 && line.polygon && section.lines[i-1].polygon && 
                        Math.abs((line.polygon.points[0]?.y || 0) - (section.lines[i-1].polygon?.points[0]?.y || 0)) > 20);

    if (isNewEntry && currentItem?.company) {
      if (descriptionLines.length > 0) {
        currentItem.description = descriptionLines.join(" ").trim();
      }
      const factors = defaultFactors();
      factors.sectionMatch = true;
      const { score } = calculateConfidence(factors);
      
      results.push({
        company: currentItem.company || "",
        title: currentItem.title || "",
        startDate: currentItem.startDate,
        endDate: currentItem.endDate,
        location: currentItem.location,
        description: currentItem.description,
        evidence: currentItem.evidence || createEvidence(text, line.pageNumber, score),
        score,
      });
      currentItem = null;
      descriptionLines = [];
    }

    if (!currentItem) {
      currentItem = {
        evidence: createEvidence(text, line.pageNumber, line.confidence, line.polygon),
      };

      if (dateMatch) {
        const parts = text.split(/\s*[-–]\s*/);
        if (parts.length >= 2) {
          currentItem.startDate = parseDate(parts[0]) || undefined;
          currentItem.endDate = parseDate(parts[1]) || undefined;
        }
      }

      const titleLine = section.lines[i + 1]?.text?.trim();
      const companyLine = section.lines[i + 2]?.text?.trim();
      
      if (titleLine && !titleLine.match(/\b(19|20)\d{2}\b/)) {
        currentItem.title = titleLine;
      }
      if (companyLine && !companyLine.match(/\b(19|20)\d{2}\b/)) {
        currentItem.company = companyLine;
      }
    } else {
      if (!currentItem.title) {
        currentItem.title = text;
      } else if (!currentItem.company) {
        currentItem.company = text;
      } else {
        descriptionLines.push(text);
      }
    }
  }

  if (currentItem?.company) {
    if (descriptionLines.length > 0) {
      currentItem.description = descriptionLines.join(" ").trim();
    }
    const factors = defaultFactors();
    factors.sectionMatch = true;
    const { score } = calculateConfidence(factors);
    
    results.push({
      company: currentItem.company || "",
      title: currentItem.title || "",
      startDate: currentItem.startDate,
      endDate: currentItem.endDate,
      location: currentItem.location,
      description: currentItem.description,
      evidence: currentItem.evidence || createEvidence("", 1, score),
      score,
    });
  }

  return results;
}

interface EducationItem {
  institution: string;
  degree: string;
  startDate?: { year?: number; month?: number };
  endDate?: { year?: number; month?: number };
  evidence: FieldEvidence;
  score: number;
}

function extractEducationFromSection(section: DetectedSection | undefined): EducationItem[] {
  const results: EducationItem[] = [];
  if (!section || section.lines.length === 0) return results;

  let currentItem: Partial<EducationItem> | null = null;

  for (let i = 0; i < section.lines.length; i++) {
    const line = section.lines[i];
    const text = line.text.trim();
    if (!text) continue;

    const dateMatch = text.match(/\b(19|20)\d{2}\b/);
    const hasDateRange = text.includes("-") || text.includes("–") || text.includes("bis");

    if (dateMatch && hasDateRange && currentItem?.institution) {
      const factors = defaultFactors();
      factors.sectionMatch = true;
      const { score } = calculateConfidence(factors);
      
      results.push({
        institution: currentItem.institution || "",
        degree: currentItem.degree || "",
        startDate: currentItem.startDate,
        endDate: currentItem.endDate,
        evidence: currentItem.evidence || createEvidence(text, line.pageNumber, score),
        score,
      });
      currentItem = null;
    }

    if (!currentItem) {
      currentItem = {
        evidence: createEvidence(text, line.pageNumber, line.confidence, line.polygon),
      };

      if (dateMatch) {
        const parts = text.split(/\s*[-–]\s*/);
        if (parts.length >= 2) {
          currentItem.startDate = parseDate(parts[0]) || undefined;
          currentItem.endDate = parseDate(parts[1]) || undefined;
        }
      }
    } else {
      const degreeKeywords = ["bachelor", "master", "diplom", "mba", "phd", "dr.", "eidg.", "fachausweis", "cer", "ing.", "dipl."];
      const isLikelyDegree = degreeKeywords.some((kw) => text.toLowerCase().includes(kw));
      
      if (isLikelyDegree && !currentItem.degree) {
        currentItem.degree = text;
      } else if (!currentItem.institution) {
        currentItem.institution = text;
      } else if (!currentItem.degree) {
        currentItem.degree = text;
      }
    }
  }

  if (currentItem?.institution) {
    const factors = defaultFactors();
    factors.sectionMatch = true;
    const { score } = calculateConfidence(factors);
    
    results.push({
      institution: currentItem.institution || "",
      degree: currentItem.degree || "",
      startDate: currentItem.startDate,
      endDate: currentItem.endDate,
      evidence: currentItem.evidence || createEvidence("", 1, score),
      score,
    });
  }

  return results;
}

export interface MapperConfig {
  synonyms?: SynonymMap;
  dbSkills?: string[];
  skillAliases?: Map<string, string>;
}

export function mapDocumentToCandidate(
  docRep: DocumentRep,
  fileName: string,
  fileType: "pdf" | "png" | "jpg" | "jpeg" | "docx",
  fileSize: number,
  processingTimeMs: number,
  config?: MapperConfig
): CandidateAutoFillDraftV2 {
  const ctx: ExtractionContext = {
    synonyms: { ...DEFAULT_SYNONYMS, ...(config?.synonyms || {}) },
    dbSkills: config?.dbSkills || [],
    skillAliases: config?.skillAliases || new Map(),
  };

  const sections = detectSections(docRep);
  const filledFields: ExtractedFieldWithEvidence[] = [];
  const ambiguousFields: CandidateAutoFillDraftV2["ambiguousFields"] = [];
  const usedFields = new Set<string>();

  const kvpResults = extractFromKVPs(docRep, ctx);
  
  for (const [targetField, data] of kvpResults) {
    let finalValue = data.value;
    let validationPass = true;

    if (targetField === "email") {
      const emailResult = validateEmail(data.value);
      if (!emailResult.valid) {
        validationPass = false;
      } else {
        finalValue = emailResult.normalized!;
      }
    }

    if (targetField === "phone") {
      const phoneResult = normalizePhoneE164(data.value, "CH");
      if (!phoneResult.valid) {
        validationPass = false;
      } else {
        finalValue = phoneResult.normalized!;
      }
    }

    if (targetField === "canton") {
      const cantonResult = normalizeCanton(data.value);
      if (cantonResult) {
        finalValue = cantonResult;
      }
    }

    data.factors.validationPass = validationPass;
    const { score, status } = calculateConfidence(data.factors);

    if (status === "skip") continue;

    if (status === "review") {
      ambiguousFields.push({
        extractedLabel: targetField,
        extractedValue: finalValue,
        suggestedTargets: [{ targetField, confidence: getConfidenceLevel(score), reason: "KVP match" }],
        evidence: { ...data.evidence, confidence: score },
      });
    } else {
      filledFields.push({
        targetField,
        extractedValue: finalValue,
        confidence: getConfidenceLevel(score),
        evidence: { ...data.evidence, confidence: score },
      });
      usedFields.add(targetField);
    }
  }

  const nameFields = extractNameFromHeader(docRep, usedFields);
  filledFields.push(...nameFields);

  const languageSection = findSectionByType(sections, "languages");
  const languages = extractLanguagesFromSection(languageSection);
  if (languages.length > 0) {
    const langArray = languages.map((l) => ({ language: l.language, level: l.level }));
    const avgScore = languages.reduce((sum, l) => sum + l.score, 0) / languages.length;
    
    filledFields.push({
      targetField: "languages",
      extractedValue: langArray,
      confidence: getConfidenceLevel(avgScore),
      evidence: languages[0].evidence,
    });
  }

  const skillSection = findSectionByType(sections, "skills");
  const skills = extractSkillsFromSection(skillSection, ctx);
  if (skills.length > 0) {
    const skillNames = skills.map((s) => s.skill);
    const avgScore = skills.reduce((sum, s) => sum + s.score, 0) / skills.length;
    
    filledFields.push({
      targetField: "skills",
      extractedValue: skillNames,
      confidence: getConfidenceLevel(avgScore),
      evidence: skills[0].evidence,
    });
  }

  const experienceSection = findSectionByType(sections, "experience");
  const experiences = extractExperienceFromSection(experienceSection);
  if (experiences.length > 0) {
    const expArray = experiences.map((e) => ({
      company: e.company,
      role: e.title,
      startMonth: e.startDate?.month?.toString().padStart(2, "0") || "",
      startYear: e.startDate?.year?.toString() || "",
      endMonth: e.endDate?.month?.toString().padStart(2, "0") || "",
      endYear: e.endDate?.year?.toString() || "",
      current: false,
      description: e.description || "",
    }));
    const avgScore = experiences.reduce((sum, e) => sum + e.score, 0) / experiences.length;
    
    filledFields.push({
      targetField: "experience",
      extractedValue: expArray,
      confidence: getConfidenceLevel(avgScore),
      evidence: experiences[0].evidence,
    });
  }

  const educationSection = findSectionByType(sections, "education");
  const educations = extractEducationFromSection(educationSection);
  if (educations.length > 0) {
    const eduArray = educations.map((e) => ({
      degree: e.degree,
      institution: e.institution,
      startMonth: e.startDate?.month?.toString().padStart(2, "0") || "",
      startYear: e.startDate?.year?.toString() || "",
      endMonth: e.endDate?.month?.toString().padStart(2, "0") || "",
      endYear: e.endDate?.year?.toString() || "",
    }));
    const avgScore = educations.reduce((sum, e) => sum + e.score, 0) / educations.length;
    
    filledFields.push({
      targetField: "education",
      extractedValue: eduArray,
      confidence: getConfidenceLevel(avgScore),
      evidence: educations[0].evidence,
    });
  }

  return {
    filledFields,
    ambiguousFields,
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
