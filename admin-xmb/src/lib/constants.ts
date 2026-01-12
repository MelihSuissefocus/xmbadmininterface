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

