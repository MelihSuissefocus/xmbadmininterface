/**
 * CV Parser Normalizers
 * Central module for normalizing extracted CV data:
 * - Date/period parsing
 * - Skill normalization & deduplication
 * - Language level mapping
 * - Phone normalization
 * - Address splitting
 * - Years of experience calculation
 */

// ============================================================================
// DATE / PERIOD PARSING
// ============================================================================

export interface ParsedDate {
  month: number | null; // 1-12
  year: number | null;  // 4-digit
}

export interface ParsedPeriod {
  start: ParsedDate;
  end: ParsedDate;
  current: boolean;
}

const MONTH_MAP: Record<string, number> = {
  // German
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
  jan: 1, feb: 2, mär: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12,
  // English (only those not already covered by German abbrev above)
  january: 1, february: 2, march: 3, may: 5, june: 6,
  july: 7, october: 10, december: 12,
  // French
  janvier: 1, février: 2, mars: 3, avril: 4, juin: 6,
  juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
};

const CURRENT_INDICATORS = [
  "heute", "aktuell", "present", "current", "laufend", "ongoing", "now",
  "bis heute", "till now", "to date", "to present",
];

function isCurrentIndicator(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return CURRENT_INDICATORS.some(ind => lower.includes(ind));
}

/**
 * Parse a single date string into month + year.
 * Supports: MM.YYYY, MM/YYYY, YYYY-MM, Month YYYY, Jan 2023, 2021, etc.
 */
export function parseDate(raw: string | null | undefined): ParsedDate {
  if (!raw || !raw.trim()) return { month: null, year: null };

  const text = raw.trim();

  // MM.YYYY or MM/YYYY
  const mmYYYY = text.match(/^(\d{1,2})[.\/](\d{4})$/);
  if (mmYYYY) {
    const m = parseInt(mmYYYY[1], 10);
    const y = parseInt(mmYYYY[2], 10);
    return { month: m >= 1 && m <= 12 ? m : null, year: y };
  }

  // YYYY-MM
  const yyyyMM = text.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyyMM) {
    const y = parseInt(yyyyMM[1], 10);
    const m = parseInt(yyyyMM[2], 10);
    return { month: m >= 1 && m <= 12 ? m : null, year: y };
  }

  // DD.MM.YYYY or DD/MM/YYYY
  const ddmmyyyy = text.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (ddmmyyyy) {
    const m = parseInt(ddmmyyyy[2], 10);
    const y = parseInt(ddmmyyyy[3], 10);
    return { month: m >= 1 && m <= 12 ? m : null, year: y };
  }

  // "Month YYYY" or "Mon YYYY" or "Mon. YYYY"
  const monthYear = text.match(/^([a-zäöüéèà]+)\.?\s+(\d{4})$/i);
  if (monthYear) {
    const monthStr = monthYear[1].toLowerCase();
    const month = MONTH_MAP[monthStr] ?? null;
    const year = parseInt(monthYear[2], 10);
    return { month, year };
  }

  // Just YYYY
  const justYear = text.match(/^(\d{4})$/);
  if (justYear) {
    return { month: null, year: parseInt(justYear[1], 10) };
  }

  // "seit YYYY" or "since YYYY"
  const seitYear = text.match(/(?:seit|since)\s+(\d{4})/i);
  if (seitYear) {
    return { month: null, year: parseInt(seitYear[1], 10) };
  }

  // "seit MM/YYYY"
  const seitMMYYYY = text.match(/(?:seit|since)\s+(\d{1,2})[.\/](\d{4})/i);
  if (seitMMYYYY) {
    const m = parseInt(seitMMYYYY[1], 10);
    return { month: m >= 1 && m <= 12 ? m : null, year: parseInt(seitMMYYYY[2], 10) };
  }

  return { month: null, year: null };
}

/**
 * Parse a period string like "01/2020 - 12/2023" or "Jan 2020 - heute"
 */
export function parsePeriod(raw: string | null | undefined): ParsedPeriod {
  const empty: ParsedPeriod = { start: { month: null, year: null }, end: { month: null, year: null }, current: false };
  if (!raw || !raw.trim()) return empty;

  const text = raw.trim();
  const current = isCurrentIndicator(text);

  // Split on common separators: " - ", " – ", " — ", " bis ", " to "
  const parts = text.split(/\s*[-–—]\s*|\s+bis\s+|\s+to\s+/i);

  if (parts.length >= 2) {
    const start = parseDate(parts[0].trim());
    const endRaw = parts[parts.length - 1].trim();
    const end = isCurrentIndicator(endRaw) ? { month: null, year: null } : parseDate(endRaw);
    return { start, end, current: current || isCurrentIndicator(endRaw) };
  }

  // "seit 2022" or "since 2022"
  if (/^(seit|since)\s/i.test(text)) {
    const start = parseDate(text);
    return { start, end: { month: null, year: null }, current: true };
  }

  // Single date
  const single = parseDate(text);
  return { start: single, end: { month: null, year: null }, current };
}

// ============================================================================
// YEARS OF EXPERIENCE CALCULATION
// ============================================================================

interface PeriodForCalc {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}

/**
 * Calculate years of experience from work experience entries.
 * Handles overlapping periods by merging intervals.
 * Returns a conservative (floor) estimate.
 */
export function calculateYearsOfExperience(
  entries: Array<{
    startMonth?: string | number | null;
    startYear?: string | number | null;
    endMonth?: string | number | null;
    endYear?: string | number | null;
    current?: boolean;
  }>
): number {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const periods: PeriodForCalc[] = [];

  for (const entry of entries) {
    const sy = toNumber(entry.startYear);
    if (!sy || sy < 1950 || sy > currentYear + 1) continue;

    const sm = toNumber(entry.startMonth) || 1;
    let ey: number;
    let em: number;

    if (entry.current) {
      ey = currentYear;
      em = currentMonth;
    } else {
      ey = toNumber(entry.endYear) || currentYear;
      em = toNumber(entry.endMonth) || 12;
    }

    if (ey < sy || (ey === sy && em < sm)) continue;

    periods.push({ startMonth: sm, startYear: sy, endMonth: em, endYear: ey });
  }

  if (periods.length === 0) return 0;

  // Convert to months for merging
  const intervals = periods.map(p => ({
    start: p.startYear * 12 + p.startMonth,
    end: p.endYear * 12 + p.endMonth,
  }));

  // Sort by start
  intervals.sort((a, b) => a.start - b.start);

  // Merge overlapping intervals
  const merged: Array<{ start: number; end: number }> = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i].start <= last.end) {
      last.end = Math.max(last.end, intervals[i].end);
    } else {
      merged.push({ ...intervals[i] });
    }
  }

  // Sum total months
  const totalMonths = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.floor(totalMonths / 12);
}

function toNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

// ============================================================================
// SKILL NORMALIZATION
// ============================================================================

const SKILL_ALIASES: Record<string, string> = {
  "js": "JavaScript",
  "javascript": "JavaScript",
  "ts": "TypeScript",
  "typescript": "TypeScript",
  "k8s": "Kubernetes",
  "kubernetes": "Kubernetes",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "gcp": "Google Cloud Platform",
  "google cloud": "Google Cloud Platform",
  "google cloud platform": "Google Cloud Platform",
  "aws": "AWS",
  "amazon web services": "AWS",
  "azure": "Microsoft Azure",
  "ms azure": "Microsoft Azure",
  "react.js": "React",
  "reactjs": "React",
  "react js": "React",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "node js": "Node.js",
  "vue.js": "Vue.js",
  "vuejs": "Vue.js",
  "vue js": "Vue.js",
  "angular.js": "Angular",
  "angularjs": "Angular",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "express.js": "Express.js",
  "expressjs": "Express.js",
  "mongo": "MongoDB",
  "mongodb": "MongoDB",
  "mysql": "MySQL",
  "mssql": "Microsoft SQL Server",
  "ms sql": "Microsoft SQL Server",
  "sql server": "Microsoft SQL Server",
  "c#": "C#",
  "csharp": "C#",
  "c sharp": "C#",
  "cpp": "C++",
  "c++": "C++",
  "python3": "Python",
  "python 3": "Python",
  "golang": "Go",
  "docker": "Docker",
  "terraform": "Terraform",
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
  "ci cd": "CI/CD",
  "rest api": "REST API",
  "restful": "REST API",
  "graphql": "GraphQL",
  "html5": "HTML",
  "html": "HTML",
  "css3": "CSS",
  "css": "CSS",
  "sass": "SASS",
  "scss": "SASS",
  "linux": "Linux",
  "git": "Git",
  "github": "GitHub",
  "gitlab": "GitLab",
  "jira": "Jira",
  "confluence": "Confluence",
  "figma": "Figma",
  "tailwind": "Tailwind CSS",
  "tailwindcss": "Tailwind CSS",
};

// Generic non-skill terms that should be filtered out
const NON_SKILL_TERMS = new Set([
  "teamfähig", "teamfähigkeit", "motiviert", "motivation", "zuverlässig",
  "flexibel", "kreativ", "kommunikativ", "selbstständig", "belastbar",
  "team player", "motivated", "reliable", "flexible", "creative",
  "self-motivated", "hard-working", "detail-oriented", "proactive",
  "analytisch", "analytisches denken", "problemlösung",
]);

/**
 * Normalize a single skill name using the alias map.
 */
export function normalizeSkill(skill: string): string {
  const trimmed = skill.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  return SKILL_ALIASES[lower] || trimmed;
}

/**
 * Normalize and deduplicate a list of skills.
 * Filters out soft skills and generic terms.
 */
export function normalizeAndDeduplicateSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of skills) {
    const normalized = normalizeSkill(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    if (NON_SKILL_TERMS.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

// ============================================================================
// LANGUAGE LEVEL NORMALIZATION
// ============================================================================

const LEVEL_MAP: Record<string, string> = {
  // CEFR levels
  "a1": "A1",
  "a2": "A2",
  "b1": "B1",
  "b2": "B2",
  "c1": "C1",
  "c2": "C2",
  // German
  "muttersprache": "Muttersprache",
  "muttersprachlich": "Muttersprache",
  "muttersprachler": "Muttersprache",
  "native": "Muttersprache",
  "verhandlungssicher": "C1",
  "fliessend": "C1",
  "fließend": "C1",
  "fluent": "C1",
  "sehr gut": "C1",
  "sehr gute kenntnisse": "C1",
  "gute kenntnisse": "B2",
  "gut": "B2",
  "gute": "B2",
  "good": "B2",
  "intermediate": "B1",
  "fortgeschritten": "B2",
  "advanced": "C1",
  "grundkenntnisse": "A2",
  "basiskenntnisse": "A1",
  "basic": "A1",
  "anfänger": "A1",
  "beginner": "A1",
  "elementary": "A2",
  "schulkenntnisse": "A2",
  "conversational": "B1",
  "professional": "C1",
  "proficient": "C1",
  "business fluent": "C1",
  "near native": "C2",
  "bilingual": "C2",
};

/**
 * Normalize a language level string to CEFR or "Muttersprache".
 * Returns empty string if level cannot be determined.
 */
export function normalizeLanguageLevel(level: string | null | undefined): string {
  if (!level || !level.trim()) return "";
  const lower = level.toLowerCase().trim();

  // Direct match
  if (LEVEL_MAP[lower]) return LEVEL_MAP[lower];

  // Partial match (e.g., "gute Kenntnisse (B2)")
  for (const [key, value] of Object.entries(LEVEL_MAP)) {
    if (lower.includes(key)) return value;
  }

  // Check if it's already a valid CEFR level in some format
  const cefrMatch = lower.match(/^([abc][12])$/i);
  if (cefrMatch) return cefrMatch[1].toUpperCase();

  return "";
}

/**
 * Map language names from English to German (to match WORLD_LANGUAGES constant).
 */
const LANGUAGE_NAME_MAP: Record<string, string> = {
  german: "Deutsch",
  deutsch: "Deutsch",
  english: "Englisch",
  englisch: "Englisch",
  french: "Französisch",
  französisch: "Französisch",
  italian: "Italienisch",
  italienisch: "Italienisch",
  spanish: "Spanisch",
  spanisch: "Spanisch",
  portuguese: "Portugiesisch",
  portugiesisch: "Portugiesisch",
  dutch: "Niederländisch",
  niederländisch: "Niederländisch",
  russian: "Russisch",
  russisch: "Russisch",
  polish: "Polnisch",
  polnisch: "Polnisch",
  turkish: "Türkisch",
  türkisch: "Türkisch",
  arabic: "Arabisch",
  arabisch: "Arabisch",
  chinese: "Chinesisch (Mandarin)",
  chinesisch: "Chinesisch (Mandarin)",
  mandarin: "Chinesisch (Mandarin)",
  japanese: "Japanisch",
  japanisch: "Japanisch",
  korean: "Koreanisch",
  koreanisch: "Koreanisch",
  hindi: "Hindi",
  swedish: "Schwedisch",
  schwedisch: "Schwedisch",
  danish: "Dänisch",
  dänisch: "Dänisch",
  norwegian: "Norwegisch",
  norwegisch: "Norwegisch",
  finnish: "Finnisch",
  finnisch: "Finnisch",
  czech: "Tschechisch",
  tschechisch: "Tschechisch",
  hungarian: "Ungarisch",
  ungarisch: "Ungarisch",
  romanian: "Rumänisch",
  rumänisch: "Rumänisch",
  croatian: "Kroatisch",
  kroatisch: "Kroatisch",
  serbian: "Serbisch",
  serbisch: "Serbisch",
  bulgarian: "Bulgarisch",
  bulgarisch: "Bulgarisch",
  ukrainian: "Ukrainisch",
  ukrainisch: "Ukrainisch",
  greek: "Griechisch",
  griechisch: "Griechisch",
  hebrew: "Hebräisch",
  hebräisch: "Hebräisch",
  persian: "Persisch",
  persisch: "Persisch",
  farsi: "Persisch",
  thai: "Thai",
  vietnamese: "Vietnamesisch",
  vietnamesisch: "Vietnamesisch",
  indonesian: "Indonesisch",
  indonesisch: "Indonesisch",
  malay: "Malaiisch",
  malaiisch: "Malaiisch",
  albanian: "Albanisch",
  albanisch: "Albanisch",
  bengali: "Bengali",
  urdu: "Urdu",
  tamil: "Tamil",
  swahili: "Swahili",
};

export function normalizeLanguageName(name: string): string {
  const lower = name.toLowerCase().trim();
  return LANGUAGE_NAME_MAP[lower] || name.trim();
}

/**
 * Parse a language string that may contain both name and level.
 * E.g., "Deutsch (Muttersprache)", "English - C1", "Französisch: B2"
 */
export function parseLanguageEntry(raw: string): { language: string; level: string } {
  const text = raw.trim();

  // Pattern: "Language (Level)" or "Language: Level" or "Language - Level"
  const match = text.match(/^([^(:\-–]+)\s*[(\-–:]\s*(.+?)\s*\)?$/);
  if (match) {
    return {
      language: normalizeLanguageName(match[1].trim()),
      level: normalizeLanguageLevel(match[2].trim()),
    };
  }

  // Just a language name
  return {
    language: normalizeLanguageName(text),
    level: "",
  };
}

// ============================================================================
// SUBCONTRACTOR DETECTION
// ============================================================================

const FREELANCER_INDICATORS = [
  "freelancer", "freiberufler", "freiberuflich", "selbstständig", "selbständig",
  "contractor", "subcontractor", "inhaber", "geschäftsführer",
  "consultant auf eigene rechnung", "eigene firma", "gmbh", "einzelunternehmen",
  "sole proprietor", "independent consultant", "self-employed",
];

export function detectSubcontractor(texts: string[]): boolean {
  const combined = texts.join(" ").toLowerCase();
  return FREELANCER_INDICATORS.some(ind => combined.includes(ind));
}

// ============================================================================
// TITLE CLEANING (remove academic titles from names)
// ============================================================================

const TITLE_PREFIXES = [
  "prof.", "prof", "dr.", "dr", "dipl.", "dipl", "ing.", "ing",
  "msc", "m.sc.", "m.sc", "bsc", "b.sc.", "b.sc",
  "mba", "phd", "ph.d.", "mag.", "mag",
  "lic.", "lic", "mba", "emba",
];

export function cleanNameFromTitles(name: string): string {
  let cleaned = name.trim();
  for (const title of TITLE_PREFIXES) {
    const regex = new RegExp(`^${title.replace(".", "\\.")}\\s+`, "i");
    cleaned = cleaned.replace(regex, "");
  }
  // Also remove trailing titles like ", MSc"
  cleaned = cleaned.replace(/,?\s*(MSc|BSc|MBA|PhD|Dr\.|Dipl\.\s*\w+)\s*$/gi, "");
  return cleaned.trim();
}

// ============================================================================
// PHONE NORMALIZATION (soft)
// ============================================================================

export function normalizePhone(phone: string): string {
  if (!phone || !phone.trim()) return "";
  let cleaned = phone.trim();

  // Remove common labels
  cleaned = cleaned.replace(/^(tel\.?|phone|telefon|mobile|mobil|handy)\s*:?\s*/i, "");

  // Basic cleanup - keep digits, +, spaces, dashes, parens
  cleaned = cleaned.replace(/[^\d+\s\-()]/g, "");

  // Swiss number without +41: add it
  if (/^0\d{9}$/.test(cleaned.replace(/[\s\-()]/g, ""))) {
    cleaned = "+41 " + cleaned.substring(1);
  }

  return cleaned.trim();
}

// ============================================================================
// ADDRESS PARSING
// ============================================================================

export interface ParsedAddress {
  street: string;
  postalCode: string;
  city: string;
  canton: string;
}

/**
 * Try to split an address string into components.
 * Handles Swiss format: "Musterstrasse 12, 8001 Zürich"
 */
export function parseAddress(raw: string): ParsedAddress {
  const result: ParsedAddress = { street: "", postalCode: "", city: "", canton: "" };
  if (!raw || !raw.trim()) return result;

  const text = raw.trim();

  // Swiss postal code pattern: 4 digits
  const plzMatch = text.match(/\b(\d{4})\b/);
  if (plzMatch) {
    result.postalCode = plzMatch[1];

    // City is usually after the PLZ
    const afterPlz = text.substring(text.indexOf(plzMatch[1]) + 4).trim();
    if (afterPlz) {
      // Remove leading comma or space
      result.city = afterPlz.replace(/^[,\s]+/, "").trim();
    }

    // Street is before the PLZ
    const beforePlz = text.substring(0, text.indexOf(plzMatch[1])).trim();
    if (beforePlz) {
      result.street = beforePlz.replace(/[,\s]+$/, "").trim();
    }
  }

  // German postal code: 5 digits
  if (!result.postalCode) {
    const plz5Match = text.match(/\b(\d{5})\b/);
    if (plz5Match) {
      result.postalCode = plz5Match[1];
      const afterPlz = text.substring(text.indexOf(plz5Match[1]) + 5).trim();
      if (afterPlz) result.city = afterPlz.replace(/^[,\s]+/, "").trim();
      const beforePlz = text.substring(0, text.indexOf(plz5Match[1])).trim();
      if (beforePlz) result.street = beforePlz.replace(/[,\s]+$/, "").trim();
    }
  }

  return result;
}

// ============================================================================
// AVAILABLE_FROM NORMALIZATION
// ============================================================================

export function normalizeAvailableFrom(raw: string): string {
  if (!raw || !raw.trim()) return "";
  const text = raw.toLowerCase().trim();

  if (text === "sofort" || text === "per sofort" || text === "immediately" || text === "asap") {
    return new Date().toISOString().split("T")[0];
  }

  // Try to parse as date
  const date = parseDate(raw);
  if (date.year) {
    const month = date.month ? String(date.month).padStart(2, "0") : "01";
    return `${date.year}-${month}-01`;
  }

  return raw.trim();
}

// ============================================================================
// CERTIFICATE PARSING
// ============================================================================

export interface ParsedCertificate {
  name: string;
  issuer: string;
  year: string;
}

/**
 * Parse a certificate string into structured data.
 * E.g., "AWS Solutions Architect (2022)" or "SCRUM Master - Scrum.org, 2021"
 */
export function parseCertificate(raw: string): ParsedCertificate {
  const result: ParsedCertificate = { name: "", issuer: "", year: "" };
  if (!raw || !raw.trim()) return result;

  let text = raw.trim();

  // Extract year in parentheses or after comma
  const yearMatch = text.match(/[(\s,](\d{4})[)\s,]?/);
  if (yearMatch) {
    result.year = yearMatch[1];
    text = text.replace(yearMatch[0], " ").trim();
  }

  // Try to split name and issuer on " - " or " | " or ", "
  const parts = text.split(/\s*[-|]\s*|\s*,\s*/);
  if (parts.length >= 2) {
    result.name = parts[0].trim();
    result.issuer = parts.slice(1).join(", ").trim();
  } else {
    result.name = text.trim();
  }

  return result;
}

// ============================================================================
// HIGHLIGHT EXTRACTION
// ============================================================================

const GENERIC_PHRASES = new Set([
  "teamfähig", "motiviert", "zuverlässig", "flexibel", "kreativ",
  "team player", "motivated", "reliable", "hard-working",
  "detail-oriented", "proactive", "self-starter",
  "kommunikativ", "belastbar", "engagiert",
]);

/**
 * Filter highlights to only keep meaningful, concrete statements.
 */
export function filterHighlights(highlights: string[]): string[] {
  return highlights.filter(h => {
    const lower = h.toLowerCase().trim();
    if (!lower || lower.length < 10) return false;
    if (GENERIC_PHRASES.has(lower)) return false;
    // Must contain more than one word
    if (lower.split(/\s+/).length < 3) return false;
    return true;
  });
}
