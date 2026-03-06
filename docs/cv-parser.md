# CV Parser Module

## Overview

The `src/lib/cv-parser/` module provides a robust, modular pipeline for extracting, normalizing, validating, and mapping CV data from PDFs into the candidate form schema.

## Architecture

```
PDF → [Mac Mini API / Azure DI + OpenAI] → Raw Response
                    ↓
         mac-mini-mapper.ts / llm-mapper.ts
                    ↓
              ParsedCvData (canonical format)
                    ↓
              validator.ts (sanitize + validate)
                    ↓
         schema-mapper.ts → CandidateAutoFillDraftV2
                    ↓
              Mapping Modal UI → Candidate Form
```

## Modules

### `types.ts`
Defines `ParsedCvData` — the canonical intermediate format with all supported fields.

### `normalizers.ts`
Pure functions for data normalization:

| Function | Purpose |
|---|---|
| `parseDate(raw)` | Parse date strings (MM.YYYY, YYYY-MM, Month YYYY, etc.) |
| `parsePeriod(raw)` | Parse period strings ("01/2020 - 12/2023", "seit 2022", etc.) |
| `calculateYearsOfExperience(entries)` | Calculate years from work entries with overlap merging |
| `normalizeSkill(name)` | Normalize skill names (JS→JavaScript, k8s→Kubernetes) |
| `normalizeAndDeduplicateSkills(skills)` | Normalize + deduplicate + filter soft skills |
| `normalizeLanguageLevel(level)` | Map levels to CEFR (Muttersprache→C2, Fluent→C1, etc.) |
| `normalizeLanguageName(name)` | Map to German names (English→Englisch, French→Französisch) |
| `parseLanguageEntry(raw)` | Parse "Deutsch (Muttersprache)" → {language, level} |
| `detectSubcontractor(texts)` | Detect Freelancer/GmbH/Contractor keywords |
| `cleanNameFromTitles(name)` | Remove Dr., Prof., MSc from names |
| `normalizePhone(phone)` | Clean + add Swiss country code |
| `parseAddress(raw)` | Split Swiss address into street/PLZ/city |
| `normalizeAvailableFrom(raw)` | Convert "sofort" to ISO date |
| `parseCertificate(raw)` | Parse "AWS Cert (2022)" → {name, issuer, year} |
| `filterHighlights(highlights)` | Filter out generic phrases |

### `validator.ts`
Validates and sanitizes `ParsedCvData`:
- Email format validation
- LinkedIn URL validation
- Phone number length check
- Month (1-12) and year plausibility
- End date not before start date
- current=true clears end dates
- Deduplication of work experience and education
- Empty array element removal
- Status defaults to "Neu"
- Internal notes always empty

### `mac-mini-mapper.ts`
Maps `MacMiniCvResponse` → `ParsedCvData` with:
- Date parsing from `zeitraum` field
- Skill merging (kernkompetenzen + tools)
- Language level extraction
- Certificate parsing from weiterbildungen
- Subcontractor detection
- Years of experience calculation
- Highlight extraction from erfolge

### `llm-mapper.ts`
Maps `LlmExtractionResponse` → `ParsedCvData` with:
- Date parsing for experience/education
- Skill normalization + technology merging
- Language name + level normalization
- Canton normalization
- Phone normalization
- Unmapped segment processing

### `schema-mapper.ts`
Converts `ParsedCvData` to:
- `CandidateAutoFillDraftV2` (for the mapping modal UI)
- `CandidateFormData` (for direct form filling)

## Supported Fields

| Category | Fields |
|---|---|
| Personal | first_name, last_name, email, phone, linkedin_url, target_position, street, postal_code, city, canton |
| Professional | years_experience, current_salary_chf, expected_salary_chf, desired_hourly_rate_chf, is_subcontractor, employment_percentage, notice_period, available_from, status |
| Arrays | skills, languages, certifications, education, work_experience, highlights |

## Normalization Rules

### Skills
- `JS` / `javascript` → `JavaScript`
- `TS` / `typescript` → `TypeScript`
- `k8s` → `Kubernetes`
- `Postgres` → `PostgreSQL`
- `GCP` → `Google Cloud Platform`
- `nodejs` / `Node.js` → `Node.js`
- Soft skills filtered: teamfähig, motiviert, etc.

### Language Levels
- Muttersprache / Native → `Muttersprache`
- Verhandlungssicher / Fluent → `C1`
- Gute Kenntnisse → `B2`
- Grundkenntnisse → `A2`
- A1-C2 → passed through

### Dates
Supported formats: MM.YYYY, MM/YYYY, YYYY-MM, DD.MM.YYYY, Month YYYY, Jan 2023, 2021, seit 2022

### Anti-Hallucination
- No salary/rate data unless explicitly present
- No constructed LinkedIn URLs
- No guessed cantons
- Internal notes always empty
- Status defaults to "Neu"
- Missing data = empty, not invented

## Known Limitations

1. **Mac Mini API limited schema**: The Mac Mini 14B model returns a limited schema without email, phone, address, or structured dates. These must be extracted separately or via the Azure DI + OpenAI pipeline.
2. **Canton detection**: Only detects Swiss cantons when explicitly mentioned. Does not reverse-geocode from postal codes.
3. **Salary extraction**: Only from explicit text ("Gehaltsvorstellung: 120'000 CHF"). No inference.
4. **Multi-page CVs**: Date parsing relies on text quality from OCR/PDF extraction. Poor quality text may result in missed dates.
5. **Overlapping employment**: Years calculation merges overlapping periods but assumes chronological ordering in the CV.
