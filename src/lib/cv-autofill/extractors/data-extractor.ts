/**
 * Data Extractor
 * Extracts structured data from raw CV text
 */

import type {
  CandidateFormData,
  LanguageEntry,
  CertificateEntry,
  EducationEntry,
  ExperienceEntry,
} from "../types";
import {
  normalizeLanguageName,
  normalizeLanguageLevel,
  normalizeCanton,
} from "../field-mapper";

/**
 * Extracts personal information from CV text
 */
export function extractPersonalInfo(text: string): Partial<CandidateFormData> {
  const info: Partial<CandidateFormData> = {};

  // Extract email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex);
  if (emails && emails.length > 0) {
    info.email = emails[0];
  }

  // Extract phone number (various formats)
  const phoneRegex = /(\+?\d{1,3}[\s-]?)?(\(?\d{2,3}\)?[\s-]?)?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
  const phones = text.match(phoneRegex);
  if (phones && phones.length > 0) {
    info.phone = phones[0].trim();
  }

  // Extract LinkedIn URL
  const linkedinRegex = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;
  const linkedin = text.match(linkedinRegex);
  if (linkedin && linkedin.length > 0) {
    info.linkedinUrl = linkedin[0];
  }

  // Extract name (look for patterns like "Name: John Doe" or just "John Doe" at the start)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Try to find name in first few lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];

    // Skip if it's an email or phone
    if (emailRegex.test(line) || phoneRegex.test(line)) continue;

    // Look for "Vorname: X" or "Name: X"
    const nameMatch = line.match(/(?:vorname|firstname|name|nom):\s*(.+)/i);
    if (nameMatch) {
      info.firstName = nameMatch[1].trim();
      continue;
    }

    // Look for "Nachname: X" or "Surname: X"
    const surnameMatch = line.match(/(?:nachname|lastname|surname|nom de famille):\s*(.+)/i);
    if (surnameMatch) {
      info.lastName = surnameMatch[1].trim();
      continue;
    }

    // If line looks like a name (2-3 words, capitalized, no numbers)
    if (/^[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+( [A-ZÄÖÜ][a-zäöü]+)?$/.test(line)) {
      const nameParts = line.split(' ');
      if (nameParts.length === 2) {
        info.firstName = nameParts[0];
        info.lastName = nameParts[1];
        break;
      } else if (nameParts.length === 3) {
        info.firstName = `${nameParts[0]} ${nameParts[1]}`;
        info.lastName = nameParts[2];
        break;
      }
    }
  }

  // Extract address components
  const addressRegex = /(\d{4,5})\s+([A-ZÄÖÜ][a-zäöü]+(?:\s+[A-ZÄÖÜ][a-zäöü]+)*)/g;
  const addressMatches = text.match(addressRegex);
  if (addressMatches && addressMatches.length > 0) {
    const match = addressMatches[0];
    const parts = match.split(/\s+/);
    info.postalCode = parts[0];
    info.city = parts.slice(1).join(' ');
  }

  // Extract canton
  const cantonMatch = text.match(/(?:kanton|canton)\s*:?\s*([A-Z]{2})/i);
  if (cantonMatch) {
    const normalized = normalizeCanton(cantonMatch[1]);
    if (normalized) {
      info.canton = normalized;
    }
  }

  return info;
}

/**
 * Extracts work experience entries from CV text
 */
export function extractExperiences(text: string): ExperienceEntry[] {
  const experiences: ExperienceEntry[] = [];

  // Look for experience section
  const experienceSection = extractSection(text, [
    "berufserfahrung",
    "work experience",
    "professional experience",
    "experience professionnelle",
    "employment history",
    "career",
  ]);

  if (!experienceSection) return experiences;

  // Split into individual entries (look for date patterns)
  const datePattern = /(\d{2}\/\d{4}|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4})/gi;
  const lines = experienceSection.split('\n');

  let currentExp: Partial<ExperienceEntry> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line contains dates (likely start of new entry)
    const dateMatches = trimmed.match(datePattern);
    if (dateMatches && dateMatches.length >= 1) {
      // Save previous entry
      if (currentExp && currentExp.role && currentExp.company) {
        experiences.push(currentExp as ExperienceEntry);
      }

      // Start new entry
      currentExp = {
        role: "",
        company: "",
        description: "",
        current: false,
      };

      // Parse dates
      const dateInfo = parseDateRange(dateMatches);
      currentExp = { ...currentExp, ...dateInfo };

      // Rest of line might be role or company
      const withoutDates = trimmed.replace(datePattern, '').trim();
      if (withoutDates) {
        // If it has a dash or "at", split into role and company
        if (withoutDates.includes(' - ') || withoutDates.includes(' at ') || withoutDates.includes(' bei ')) {
          const parts = withoutDates.split(/ - | at | bei /);
          currentExp.role = parts[0].trim();
          currentExp.company = parts[1]?.trim() || "";
        } else {
          currentExp.role = withoutDates;
        }
      }
    } else if (currentExp) {
      // Continuation of current entry
      if (!currentExp.role) {
        currentExp.role = trimmed;
      } else if (!currentExp.company) {
        currentExp.company = trimmed;
      } else {
        currentExp.description = (currentExp.description || "") + " " + trimmed;
      }
    }
  }

  // Add last entry
  if (currentExp && currentExp.role && currentExp.company) {
    experiences.push(currentExp as ExperienceEntry);
  }

  return experiences;
}

/**
 * Extracts education entries from CV text
 */
export function extractEducation(text: string): EducationEntry[] {
  const education: EducationEntry[] = [];

  const educationSection = extractSection(text, [
    "ausbildung",
    "bildung",
    "education",
    "formation",
    "academic background",
    "qualifications",
  ]);

  if (!educationSection) return education;

  const datePattern = /(\d{2}\/\d{4}|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4})/gi;
  const lines = educationSection.split('\n');

  let currentEdu: Partial<EducationEntry> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateMatches = trimmed.match(datePattern);
    if (dateMatches && dateMatches.length >= 1) {
      if (currentEdu && currentEdu.degree && currentEdu.institution) {
        education.push(currentEdu as EducationEntry);
      }

      currentEdu = {
        degree: "",
        institution: "",
      };

      const dateInfo = parseDateRange(dateMatches);
      currentEdu = { ...currentEdu, ...dateInfo };

      const withoutDates = trimmed.replace(datePattern, '').trim();
      if (withoutDates) {
        if (withoutDates.includes(' - ') || withoutDates.includes(' at ') || withoutDates.includes(' bei ')) {
          const parts = withoutDates.split(/ - | at | bei /);
          currentEdu.degree = parts[0].trim();
          currentEdu.institution = parts[1]?.trim() || "";
        } else {
          currentEdu.degree = withoutDates;
        }
      }
    } else if (currentEdu) {
      if (!currentEdu.degree) {
        currentEdu.degree = trimmed;
      } else if (!currentEdu.institution) {
        currentEdu.institution = trimmed;
      }
    }
  }

  if (currentEdu && currentEdu.degree && currentEdu.institution) {
    education.push(currentEdu as EducationEntry);
  }

  return education;
}

/**
 * Extracts language entries from CV text
 */
export function extractLanguages(text: string): LanguageEntry[] {
  const languages: LanguageEntry[] = [];

  const languageSection = extractSection(text, [
    "sprachen",
    "languages",
    "langues",
    "language skills",
    "sprachkenntnisse",
  ]);

  if (!languageSection) return languages;

  const lines = languageSection.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Look for patterns like "Deutsch: C1" or "English (Fluent)"
    const match = trimmed.match(/([A-ZÄÖÜ][a-zäöü]+(?:\s+\([A-Za-z]+\))?)\s*[:\-–]\s*(.+)/);
    if (match) {
      const langName = normalizeLanguageName(match[1]);
      const level = normalizeLanguageLevel(match[2]);

      if (langName) {
        languages.push({
          language: langName,
          level: level as LanguageEntry["level"],
        });
      }
    } else {
      // Try to find language name and infer level
      const langName = normalizeLanguageName(trimmed);
      if (langName) {
        // Check if line mentions level keywords
        let level: LanguageEntry["level"] = "B1"; // default
        if (/mother.*tongue|native|muttersprache/i.test(trimmed)) {
          level = "Muttersprache";
        } else if (/fluent|flie.*end|c2/i.test(trimmed)) {
          level = "C2";
        } else if (/advanced|fortgeschritten|c1/i.test(trimmed)) {
          level = "C1";
        }

        languages.push({
          language: langName,
          level,
        });
      }
    }
  }

  return languages;
}

/**
 * Extracts skills from CV text and matches them to system skills
 */
export function extractSkills(text: string, systemSkills: string[]): string[] {
  const skills: string[] = [];

  const skillsSection = extractSection(text, [
    "skills",
    "fähigkeiten",
    "kompetenzen",
    "kenntnisse",
    "compétences",
    "technical skills",
    "core competencies",
  ]);

  const searchText = skillsSection || text;

  // For each system skill, check if it appears in the text
  for (const skill of systemSkills) {
    const regex = new RegExp(`\\b${skill}\\b`, 'i');
    if (regex.test(searchText)) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Extracts certificate entries from CV text
 */
export function extractCertificates(text: string): CertificateEntry[] {
  const certificates: CertificateEntry[] = [];

  const certSection = extractSection(text, [
    "zertifikate",
    "certifications",
    "certificates",
    "qualifications",
    "certifications professionnelles",
  ]);

  if (!certSection) return certificates;

  const lines = certSection.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Look for date patterns
    const dateMatch = trimmed.match(/(\d{4}|\d{2}\/\d{4})/);
    const date = dateMatch ? dateMatch[0] : "";

    // Remove date from line to get cert name
    const nameAndIssuer = trimmed.replace(/\d{4}|\d{2}\/\d{4}/g, '').trim();

    // Try to split into name and issuer
    let name = nameAndIssuer;
    let issuer = "";

    if (nameAndIssuer.includes(' - ')) {
      const parts = nameAndIssuer.split(' - ');
      name = parts[0].trim();
      issuer = parts[1]?.trim() || "";
    } else if (nameAndIssuer.includes(' by ') || nameAndIssuer.includes(' von ')) {
      const parts = nameAndIssuer.split(/ by | von /);
      name = parts[0].trim();
      issuer = parts[1]?.trim() || "";
    }

    if (name) {
      certificates.push({
        name,
        issuer: issuer || "Unknown",
        date: date || new Date().getFullYear().toString(),
      });
    }
  }

  return certificates;
}

// Helper functions

/**
 * Extracts a section from text based on common headers
 */
function extractSection(text: string, headers: string[]): string | null {
  const lines = text.split('\n');
  let inSection = false;
  let sectionText = "";

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    // Check if this is a section header
    if (headers.some(h => trimmed.startsWith(h) || trimmed === h)) {
      inSection = true;
      continue;
    }

    // Check if we hit another section header (stop extracting)
    if (inSection && /^[A-ZÄÖÜ][A-ZÄÖÜa-zäöü\s]{3,30}$/.test(line.trim()) && line.trim().length < 40) {
      // Might be a new section header
      break;
    }

    if (inSection) {
      sectionText += line + "\n";
    }
  }

  return sectionText.trim() || null;
}

/**
 * Parses date range from date strings
 */
function parseDateRange(dates: string[]): Partial<ExperienceEntry> {
  const result: Partial<ExperienceEntry> = {};

  if (dates.length === 0) return result;

  // First date is start
  const startInfo = parseDate(dates[0]);
  result.startMonth = startInfo.month;
  result.startYear = startInfo.year;

  // Second date is end (or check for "current" keywords)
  if (dates.length > 1) {
    const endDateStr = dates[1].toLowerCase();
    if (endDateStr.includes('today') || endDateStr.includes('present') || endDateStr.includes('aktuell') || endDateStr.includes('heute')) {
      result.current = true;
    } else {
      const endInfo = parseDate(dates[1]);
      result.endMonth = endInfo.month;
      result.endYear = endInfo.year;
    }
  }

  return result;
}

/**
 * Parses a single date string
 */
function parseDate(dateStr: string): { month?: string; year?: string } {
  const result: { month?: string; year?: string } = {};

  // Extract year (4 digits)
  const yearMatch = dateStr.match(/\d{4}/);
  if (yearMatch) {
    result.year = yearMatch[0];
  }

  // Extract month
  const monthMatch = dateStr.match(/\d{2}\/\d{4}/);
  if (monthMatch) {
    result.month = monthMatch[0].substring(0, 2);
  } else {
    // Try month names
    const monthNames = {
      'jan': '01', 'januar': '01', 'january': '01',
      'feb': '02', 'februar': '02', 'february': '02',
      'mar': '03', 'mär': '03', 'märz': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05', 'mai': '05',
      'jun': '06', 'juni': '06', 'june': '06',
      'jul': '07', 'juli': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'sept': '09', 'september': '09',
      'oct': '10', 'okt': '10', 'oktober': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'dez': '12', 'dezember': '12', 'december': '12',
    };

    const lowerDate = dateStr.toLowerCase();
    for (const [name, num] of Object.entries(monthNames)) {
      if (lowerDate.includes(name)) {
        result.month = num;
        break;
      }
    }
  }

  return result;
}
