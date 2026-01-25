export const WORLD_LANGUAGES = [
  "Deutsch", "Englisch", "Französisch", "Italienisch", "Spanisch", "Portugiesisch",
  "Niederländisch", "Russisch", "Polnisch", "Türkisch", "Arabisch", "Chinesisch (Mandarin)",
  "Japanisch", "Koreanisch", "Hindi", "Bengali", "Urdu", "Indonesisch", "Vietnamesisch",
  "Thai", "Tamil", "Persisch", "Swahili", "Griechisch", "Schwedisch", "Dänisch",
  "Norwegisch", "Finnisch", "Tschechisch", "Ungarisch", "Rumänisch", "Kroatisch",
  "Serbisch", "Bulgarisch", "Ukrainisch", "Hebräisch", "Malaiisch", "Albanisch"
].sort();

export const LANGUAGE_LEVELS = [
  { value: "A1", label: "A1 - Anfänger" },
  { value: "A2", label: "A2 - Grundkenntnisse" },
  { value: "B1", label: "B1 - Mittelstufe" },
  { value: "B2", label: "B2 - Gute Mittelstufe" },
  { value: "C1", label: "C1 - Fortgeschritten" },
  { value: "C2", label: "C2 - Muttersprachlich" },
  { value: "Muttersprache", label: "Muttersprache" }
];

export const MONTHS = [
  { value: "01", label: "Januar" },
  { value: "02", label: "Februar" },
  { value: "03", label: "März" },
  { value: "04", label: "April" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Dezember" }
];

export function generateYears(startYear = 1960, futureYears = 10): number[] {
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + futureYears;
  const years: number[] = [];

  for (let year = endYear; year >= startYear; year--) {
    years.push(year);
  }

  return years;
}

// CV Auto-Fill Configuration
export const CV_AUTOFILL_CONFIG = {
  MAX_FILE_SIZE_MB: 10,
  MAX_PAGE_COUNT: 20,
  ALLOWED_FILE_TYPES: ['pdf', 'png', 'jpg', 'jpeg', 'docx'] as const,
  EXTRACTION_TIMEOUT_MS: 30000,
  OCR_TIMEOUT_MS: 60000,
} as const;

// Swiss Cantons with variations for matching
export const CANTON_MAPPING: Record<string, string> = {
  // Standard abbreviations
  'AG': 'AG', 'AR': 'AR', 'AI': 'AI', 'BL': 'BL', 'BS': 'BS', 'BE': 'BE',
  'FR': 'FR', 'GE': 'GE', 'GL': 'GL', 'GR': 'GR', 'JU': 'JU', 'LU': 'LU',
  'NE': 'NE', 'NW': 'NW', 'OW': 'OW', 'SH': 'SH', 'SZ': 'SZ', 'SO': 'SO',
  'SG': 'SG', 'TG': 'TG', 'TI': 'TI', 'UR': 'UR', 'VD': 'VD', 'VS': 'VS',
  'ZG': 'ZG', 'ZH': 'ZH',

  // Full German names
  'aargau': 'AG', 'appenzell ausserrhoden': 'AR', 'appenzell innerrhoden': 'AI',
  'basel-landschaft': 'BL', 'basel-stadt': 'BS', 'bern': 'BE', 'freiburg': 'FR',
  'genf': 'GE', 'glarus': 'GL', 'graubünden': 'GR', 'jura': 'JU', 'luzern': 'LU',
  'neuenburg': 'NE', 'nidwalden': 'NW', 'obwalden': 'OW', 'schaffhausen': 'SH',
  'schwyz': 'SZ', 'solothurn': 'SO', 'st. gallen': 'SG', 'sankt gallen': 'SG',
  'thurgau': 'TG', 'tessin': 'TI', 'uri': 'UR', 'waadt': 'VD', 'wallis': 'VS',
  'zug': 'ZG', 'zürich': 'ZH', 'zurich': 'ZH',

  // French names
  'argovie': 'AG', 'bâle-campagne': 'BL', 'bâle-ville': 'BS', 'berne': 'BE',
  'fribourg': 'FR', 'genève': 'GE', 'glarise': 'GL', 'grisons': 'GR',
  'lucerne': 'LU', 'neuchâtel': 'NE', 'saint-gall': 'SG', 'schaffhouse': 'SH',
  'thurgovie': 'TG', 'vaud': 'VD', 'valais': 'VS', 'zoug': 'ZG',

  // Italian names
  'argovia': 'AG', 'basilea campagna': 'BL', 'basilea città': 'BS',
  'friborgo': 'FR', 'ginevra': 'GE', 'glarona': 'GL', 'grigioni': 'GR',
  'lucerna': 'LU', 'san gallo': 'SG', 'sciaffusa': 'SH',
  'turgovia': 'TG', 'ticino': 'TI', 'vallese': 'VS', 'zugo': 'ZG',
  'zurigo': 'ZH',
};

export const SWISS_CANTONS = [
  'AG', 'AR', 'AI', 'BL', 'BS', 'BE', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU',
  'NE', 'NW', 'OW', 'SH', 'SZ', 'SO', 'SG', 'TG', 'TI', 'UR', 'VD', 'VS',
  'ZG', 'ZH'
] as const;

