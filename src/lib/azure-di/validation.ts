export function validateEmail(email: string): { valid: boolean; normalized: string | null } {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  
  if (!emailRegex.test(trimmed)) {
    return { valid: false, normalized: null };
  }

  const [local, domain] = trimmed.split("@");
  if (local.length > 64 || domain.length > 255) {
    return { valid: false, normalized: null };
  }

  const invalidDomains = ["example.com", "test.com", "localhost"];
  if (invalidDomains.includes(domain)) {
    return { valid: false, normalized: null };
  }

  return { valid: true, normalized: trimmed };
}

export function normalizePhoneE164(
  phone: string,
  defaultRegion: string = "CH"
): { valid: boolean; normalized: string | null; original: string } {
  const original = phone;
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
  
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.substring(2);
  }

  const countryPrefixes: Record<string, string> = {
    CH: "+41",
    DE: "+49",
    AT: "+43",
    FR: "+33",
    IT: "+39",
  };

  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("0")) {
      cleaned = (countryPrefixes[defaultRegion] || "+41") + cleaned.substring(1);
    } else {
      cleaned = (countryPrefixes[defaultRegion] || "+41") + cleaned;
    }
  }

  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    return { valid: false, normalized: null, original };
  }

  return { valid: true, normalized: cleaned, original };
}

export function validateSwissPostalCode(code: string): boolean {
  const cleaned = code.trim();
  return /^[1-9]\d{3}$/.test(cleaned);
}

export function normalizeCanton(canton: string): string | null {
  const normalized = canton.trim().toUpperCase();
  
  const cantonMap: Record<string, string> = {
    AG: "AG", AARGAU: "AG", ARGOVIE: "AG", ARGOVIA: "AG",
    AR: "AR", "APPENZELL AUSSERRHODEN": "AR",
    AI: "AI", "APPENZELL INNERRHODEN": "AI",
    BL: "BL", "BASEL-LANDSCHAFT": "BL", "BASEL LANDSCHAFT": "BL", "BÂLE-CAMPAGNE": "BL",
    BS: "BS", "BASEL-STADT": "BS", "BASEL STADT": "BS", "BÂLE-VILLE": "BS",
    BE: "BE", BERN: "BE", BERNE: "BE",
    FR: "FR", FREIBURG: "FR", FRIBOURG: "FR", FRIBORGO: "FR",
    GE: "GE", GENF: "GE", GENÈVE: "GE", GENEVA: "GE", GINEVRA: "GE",
    GL: "GL", GLARUS: "GL", GLARISE: "GL", GLARONA: "GL",
    GR: "GR", GRAUBÜNDEN: "GR", GRISONS: "GR", GRIGIONI: "GR",
    JU: "JU", JURA: "JU",
    LU: "LU", LUZERN: "LU", LUCERNE: "LU", LUCERNA: "LU",
    NE: "NE", NEUENBURG: "NE", NEUCHÂTEL: "NE",
    NW: "NW", NIDWALDEN: "NW",
    OW: "OW", OBWALDEN: "OW",
    SH: "SH", SCHAFFHAUSEN: "SH", SCHAFFHOUSE: "SH", SCIAFFUSA: "SH",
    SZ: "SZ", SCHWYZ: "SZ",
    SO: "SO", SOLOTHURN: "SO",
    SG: "SG", "ST. GALLEN": "SG", "SANKT GALLEN": "SG", "SAINT-GALL": "SG", "SAN GALLO": "SG",
    TG: "TG", THURGAU: "TG", THURGOVIE: "TG", TURGOVIA: "TG",
    TI: "TI", TESSIN: "TI", TICINO: "TI",
    UR: "UR", URI: "UR",
    VD: "VD", WAADT: "VD", VAUD: "VD",
    VS: "VS", WALLIS: "VS", VALAIS: "VS", VALLESE: "VS",
    ZG: "ZG", ZUG: "ZG", ZOUG: "ZG", ZUGO: "ZG",
    ZH: "ZH", ZÜRICH: "ZH", ZURICH: "ZH", ZURIGO: "ZH",
  };

  return cantonMap[normalized] || null;
}

export function parseCEFRLevel(text: string): string | null {
  const normalized = text.toUpperCase().trim();
  
  const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  for (const level of cefrLevels) {
    if (normalized.includes(level)) {
      return level;
    }
  }

  const nativeKeywords = [
    "muttersprache", "muttersprachlich", "native", "mother tongue",
    "langue maternelle", "madrelingua", "first language"
  ];
  
  if (nativeKeywords.some((kw) => normalized.toLowerCase().includes(kw))) {
    return "native";
  }

  const levelMappings: Record<string, string> = {
    anfänger: "A1",
    beginner: "A1",
    grundkenntnisse: "A2",
    elementary: "A2",
    basic: "A2",
    mittelstufe: "B1",
    intermediate: "B1",
    "gute kenntnisse": "B2",
    "upper intermediate": "B2",
    fortgeschritten: "C1",
    advanced: "C1",
    fliessend: "C2",
    fluent: "C2",
    verhandlungssicher: "C1",
    proficient: "C1",
  };

  for (const [keyword, level] of Object.entries(levelMappings)) {
    if (normalized.toLowerCase().includes(keyword)) {
      return level;
    }
  }

  return null;
}

export function parseDate(text: string): { year?: number; month?: number } | null {
  const trimmed = text.trim();
  
  const monthNames: Record<string, number> = {
    januar: 1, january: 1, jan: 1, janvier: 1, gennaio: 1,
    februar: 2, february: 2, feb: 2, février: 2, febbraio: 2,
    märz: 3, march: 3, mar: 3, mars: 3, marzo: 3,
    april: 4, apr: 4, aprile: 4, avril: 4,
    mai: 5, may: 5, maggio: 5,
    juni: 6, june: 6, jun: 6, juin: 6, giugno: 6,
    juli: 7, july: 7, jul: 7, juillet: 7, luglio: 7,
    august: 8, aug: 8, août: 8, agosto: 8,
    september: 9, sep: 9, sept: 9, settembre: 9, septembre: 9,
    oktober: 10, october: 10, oct: 10, okt: 10, octobre: 10, ottobre: 10,
    november: 11, nov: 11, novembre: 11,
    dezember: 12, december: 12, dec: 12, dez: 12, décembre: 12, dicembre: 12,
  };

  const fullDateMatch = trimmed.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1]);
    const month = parseInt(fullDateMatch[2]);
    let year = parseInt(fullDateMatch[3]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const monthYearMatch = trimmed.match(/(\d{1,2})[.\/-](\d{2,4})/);
  if (monthYearMatch) {
    const month = parseInt(monthYearMatch[1]);
    let year = parseInt(monthYearMatch[2]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  for (const [name, monthNum] of Object.entries(monthNames)) {
    if (trimmed.toLowerCase().includes(name)) {
      const yearMatch = trimmed.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        return { year: parseInt(yearMatch[0]), month: monthNum };
      }
      return { month: monthNum };
    }
  }

  const yearOnlyMatch = trimmed.match(/\b(19|20)\d{2}\b/);
  if (yearOnlyMatch) {
    return { year: parseInt(yearOnlyMatch[0]) };
  }

  const presentKeywords = ["heute", "present", "current", "aktuell", "now", "ongoing", "bis heute"];
  if (presentKeywords.some((kw) => trimmed.toLowerCase().includes(kw))) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  return null;
}

