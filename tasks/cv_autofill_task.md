# CV Auto-Fill Feature — Implementation Task Plan

**Version:** 1.1  
**Erstellt:** 25. Januar 2026  
**Status:** Ready for Implementation  

---

## 🚨 CRITICAL: Step-by-Step Gate Rules (Ralph Loop)

> **Diese Regeln sind NICHT optional. Sie MÜSSEN bei jeder Ausführung befolgt werden.**

1. **Nach JEDEM Task:** `npm run ci:local` ausführen
2. **Bei Fail:** Sofort fixen und wiederholen bis grün
3. **Erst bei Grün:** Nächster Task erlaubt
4. **Nichts überspringen:** Jeder Task muss vollständig abgeschlossen sein
5. **Bei Unsicherheit:** STOPPEN und nachfragen

---

## 🔒 Boundaries: Erlaubte & Verbotene Bereiche

### ✅ WHITELIST – Erlaubte Pfade

| Bereich | Pfade |
|---------|-------|
| CV Auto-Fill Types | `src/lib/cv-autofill/` (neu) |
| CV Auto-Fill Actions | `src/actions/cv-upload.ts`, `src/actions/cv-extraction.ts` (neu) |
| CV Components | `src/components/candidates/cv-*.tsx` (neu) |
| CV Tests | `src/lib/cv-autofill/__tests__/` (neu) |
| Candidate Form | `src/components/candidates/candidate-form.tsx` (nur Integration) |
| Constants | `src/lib/constants.ts` (erweitern) |
| Test Fixtures | `test_fixtures/cv_samples/` |

### 🚫 BLACKLIST – Verbotene Bereiche (NIEMALS anfassen!)

| Bereich | Grund |
|---------|-------|
| `src/auth.ts` | Core Auth-Logik |
| `src/middleware.ts` | Request-Middleware |
| `src/actions/auth.ts` | Authentifizierung |
| `src/actions/password-reset.ts` | Security-kritisch |
| `src/db/schema.ts` | Keine Schema-Änderungen ohne Review |
| `drizzle/` | Keine Migrationen erzeugen! |
| `src/app/api/auth/` | Auth API Routes |
| `.env*` Dateien | Secrets |
| `package.json` | Keine neuen Dependencies ohne Freigabe |

---

## 🛡️ HARD RULES: Draft-Only Verhalten

> **KRITISCH: CV Auto-Fill erzeugt NUR Vorschläge, NIEMALS auto-save!**

1. **Draft-Only:** Extrahierte Daten werden als Draft/Vorschlag angezeigt
2. **Mapping-Report:** Jeder Vorschlag zeigt Quelle (CV-Abschnitt) → Zielfeld
3. **User Confirm Required:** Kandidat wird ERST nach explizitem "Speichern"-Klick persistiert
4. **Keine Seiteneffekte:** CV-Upload alleine ändert KEINE Datenbank-Records
5. **Form-State Only:** Extrahierte Daten befüllen nur das Form, nicht die DB

---

## Referenced Test Fixtures

Für Tests müssen die Samples aus `test_fixtures/cv_samples/` verwendet werden:
- `sample_cv_german.txt` – Deutscher Lebenslauf (vollständig)
- `sample_cv_english.txt` – English Resume (Standard)
- `sample_cv_minimal.txt` – Minimaler CV (nur Name + Email)

Siehe `test_fixtures/cv_samples/README.md` für Details.

---

## Übersicht

Dieser Task-Plan beschreibt die inkrementelle Implementierung des CV Auto-Fill Features. Jeder Schritt ist atomar und endet mit einem Quality Gate (`npm run ci:local`).

**Gesamtschätzung:** 8-12 Implementierungsschritte  
**Kritischer Pfad:** Schema → Actions → Components → Integration

---

## Guardrails (Zusammenfassung)

⚠️ **NIEMALS ohne explizite Anweisung:**
- Bestehende `createCandidate` / `updateCandidate` Actions refactoren
- Bestehende Form-Logik in `candidate-form.tsx` ändern (außer für Integration)
- Migrations anwenden die nicht getestet wurden
- Dependencies hinzufügen ohne Begründung im PR
- Dateien in BLACKLIST-Bereichen anfassen

✅ **IMMER:**
- Nach JEDEM Task: `npm run ci:local` muss grün sein
- Bei Fail: Sofort fixen, wiederholen bis grün
- Erst bei Grün: Nächster Task
- Neue Dateien in existierende Ordnerstruktur eingliedern
- TypeScript Types aus Schema ableiten (kein manuelles Typing)
- Zod Schemas für Runtime-Validierung nutzen
- Test Fixtures aus `test_fixtures/cv_samples/` verwenden

---

## Phase 1: Fundament (Keine DB-Änderungen)

### Task 1.1: TypeScript Types erstellen
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Type-Definitionen für das CV Auto-Fill Feature

**Dateien erstellen:**
- `src/lib/cv-autofill/types.ts`

**Inhalt:**
```typescript
// Types abgeleitet aus specs/cv_autofill_schema.json
// - CandidateAutoFillDraft
// - FilledField
// - AmbiguousField
// - UnmappedItem
// - SuggestedTarget
// - ExtractionMetadata
// - ConfidenceLevel
// - SourceInfo
```

**Gate:**
```bash
npm run ci:local  # TypeScript Check muss bestehen
```

---

### Task 1.2: Zod Validation Schema erstellen
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Runtime-Validierung für CV-Upload und Extraktion

**Dateien erstellen:**
- `src/lib/cv-autofill/validation.ts`

**Inhalt:**
```typescript
// Zod Schemas für:
// - fileUploadSchema (type, size, pageCount validierung)
// - extractionResultSchema (MappingReport validierung)
// - userMappingSchema (User-Override validierung)
```

**Abhängigkeiten:**
- Zod (bereits im Projekt vorhanden)

**Gate:**
```bash
npm run ci:local
```

---

### Task 1.3: Constants für CV Auto-Fill
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Konfigurationswerte zentral definieren

**Datei bearbeiten:**
- `src/lib/constants.ts` (erweitern)

**Neue Konstanten:**
```typescript
export const CV_AUTOFILL_CONFIG = {
  MAX_FILE_SIZE_MB: 10,
  MAX_PAGE_COUNT: 20,
  ALLOWED_FILE_TYPES: ['pdf', 'png', 'jpg', 'jpeg', 'docx'],
  EXTRACTION_TIMEOUT_MS: 30000,
  OCR_TIMEOUT_MS: 60000,
};

export const CANTON_MAPPING = {
  // Schweizer Kantone mit Varianten für Matching
};
```

**Gate:**
```bash
npm run ci:local
```

---

## Phase 2: Server Actions (Keine UI)

### Task 2.1: File Upload Action (Stub)
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Server Action für Datei-Upload mit Validierung

**Dateien erstellen:**
- `src/actions/cv-upload.ts`

**Funktionen:**
```typescript
export async function uploadCV(formData: FormData): Promise<UploadResult>
// - Validiert Dateityp, Größe
// - Gibt temporäre URL oder Error zurück
// - KEIN Speichern in DB
```

**Gate:**
```bash
npm run ci:local
```

---

### Task 2.2: Extraction Action (Stub)
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Server Action für CV-Extraktion (Stub-Implementierung)

**Dateien erstellen:**
- `src/actions/cv-extraction.ts`

**Funktionen:**
```typescript
export async function extractFromCV(fileUrl: string): Promise<CandidateAutoFillDraft>
// - Stub: Gibt leeren MappingReport zurück
// - Prepared für spätere OCR/Parser Integration
```

**Gate:**
```bash
npm run ci:local
```

---

### Task 2.3: Field Mapper Utility
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Logik zum Mapping extrahierter Werte auf Form-Felder

**Dateien erstellen:**
- `src/lib/cv-autofill/field-mapper.ts`

**Funktionen:**
```typescript
export function mapToFormField(label: string, value: string): MappingResult
export function normalizeLanguageLevel(input: string): string
export function normalizeMonth(input: string): string
export function calculateYearsOfExperience(experiences: Experience[]): number
export function matchSkillToSystem(input: string, systemSkills: string[]): string | null
```

**Gate:**
```bash
npm run ci:local
```

---

## Phase 3: UI Components

### Task 3.1: Upload Button Component
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Trigger-Button für CV-Upload

**Dateien erstellen:**
- `src/components/candidates/cv-upload-button.tsx`

**Props:**
```typescript
interface CVUploadButtonProps {
  onUploadComplete: (draft: CandidateAutoFillDraft) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}
```

**UI:**
- Button "Mit CV Felder automatisiert ausfüllen"
- Upload-Icon
- Loading-State während Upload/Extraktion

**Gate:**
```bash
npm run ci:local
```

---

### Task 3.2: Mapping Review Modal
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Modal zur Anzeige und Bearbeitung des Mapping Reports

**Dateien erstellen:**
- `src/components/candidates/cv-mapping-modal.tsx`

**Props:**
```typescript
interface CVMappingModalProps {
  draft: CandidateAutoFillDraft;
  onConfirm: (mappedData: CandidateFormData) => void;
  onCancel: () => void;
  isOpen: boolean;
}
```

**UI Sections:**
1. Header mit Datei-Metadaten
2. Filled Fields (grün, read-only)
3. Ambiguous Fields (gelb, Dropdown)
4. Unmapped Items (grau, Dropdown)
5. Footer mit Actions

**Gate:**
```bash
npm run ci:local
```

---

### Task 3.3: Mapping Row Component
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Wiederverwendbare Zeile für Mapping-Anzeige

**Dateien erstellen:**
- `src/components/candidates/cv-mapping-row.tsx`

**Props:**
```typescript
interface MappingRowProps {
  source: SourceInfo;
  value: string;
  targetField: string;
  confidence: ConfidenceLevel;
  editable: boolean;
  availableTargets?: string[];
  onTargetChange?: (newTarget: string | null) => void;
}
```

**Gate:**
```bash
npm run ci:local
```

---

### Task 3.4: Confidence Badge Component
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Visuelles Badge für Confidence-Level

**Dateien erstellen:**
- `src/components/candidates/confidence-badge.tsx`

**Farben:**
- high → grün
- medium → gelb/orange
- low → grau

**Gate:**
```bash
npm run ci:local
```

---

## Phase 4: Integration

### Task 4.1: CandidateForm Integration
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** CV-Upload in bestehendes Form integrieren

**Datei bearbeiten:**
- `src/components/candidates/candidate-form.tsx`

**Änderungen:**
1. Import CVUploadButton und CVMappingModal
2. State für `showMappingModal` und `extractedDraft`
3. CVUploadButton oberhalb des ersten Form-Abschnitts
4. Handler `handleCVDataApply` der Form-State befüllt
5. Modal mit extracted Draft

**Keine Änderungen an:**
- `handleSubmit` Funktion
- `createCandidate` / `updateCandidate` Aufrufe
- Bestehende Form-Felder

**Gate:**
```bash
npm run ci:local
```

---

### Task 4.2: Form State Merge Logic
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Extrahierte Daten in Form-State mergen

**Datei bearbeiten:**
- `src/components/candidates/candidate-form.tsx`

**Neue Funktion:**
```typescript
function applyExtractedData(draft: CandidateAutoFillDraft): void {
  // Iteriert über filledFields
  // Setzt formData, selectedSkills, languages, etc.
  // Respektiert bereits ausgefüllte Felder (optional)
}
```

**Gate:**
```bash
npm run ci:local
```

---

## Phase 5: Parser Implementation

### Task 5.1: PDF Text Extraction
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Text aus text-basierten PDFs extrahieren

**Dateien erstellen:**
- `src/lib/cv-autofill/parsers/pdf-parser.ts`

**Dependencies (zu evaluieren):**
- `pdf-parse` oder `pdfjs-dist`

**Funktionen:**
```typescript
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedText>
export function detectIfScanned(text: string): boolean
```

**Gate:**
```bash
npm run ci:local
```

---

### Task 5.2: DOCX Extraction
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Text aus Word-Dokumenten extrahieren

**Dateien erstellen:**
- `src/lib/cv-autofill/parsers/docx-parser.ts`

**Dependencies (zu evaluieren):**
- `mammoth` oder `docx`

**Gate:**
```bash
npm run ci:local
```

---

### Task 5.3: OCR Integration (Optional/Deferred)
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** OCR für gescannte PDFs und Bilder

**Dateien erstellen:**
- `src/lib/cv-autofill/parsers/ocr-parser.ts`

**Dependencies (zu evaluieren):**
- `tesseract.js` (client-side) oder
- External API (Google Vision, Azure, AWS Textract)

**⚠️ Diese Task kann deferred werden wenn OCR nicht im MVP ist**

**Gate:**
```bash
npm run ci:local
```

---

### Task 5.4: Structured Data Extractor
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Aus rohem Text strukturierte Daten extrahieren

**Dateien erstellen:**
- `src/lib/cv-autofill/extractors/data-extractor.ts`

**Funktionen:**
```typescript
export function extractPersonalInfo(text: string): Partial<CandidateFormData>
export function extractExperiences(text: string): ExperienceEntry[]
export function extractEducation(text: string): EducationEntry[]
export function extractLanguages(text: string): LanguageEntry[]
export function extractSkills(text: string, systemSkills: string[]): string[]
export function extractCertificates(text: string): CertificateEntry[]
```

**Gate:**
```bash
npm run ci:local
```

---

## Phase 6: Database (Optional)

### Task 6.1: Schema Extension (Plan)
**Ziel:** Optional: CV-Metadaten in candidates Table speichern

**Schema-Änderung (nur Planung, keine Ausführung):**
```typescript
// In src/db/schema.ts candidates table:
// Bereits vorhanden:
// - originalCvUrl: text("original_cv_url")
// - parsedData: jsonb("parsed_data")

// Optional NEU (nur wenn benötigt):
// - cvUploadedAt: timestamp("cv_uploaded_at")
// - cvExtractionMethod: text("cv_extraction_method")
```

**⚠️ Migration nur erstellen wenn explizit angefordert:**
```bash
npm run db:generate  # Erst nach Freigabe
npm run ci:local
```

---

### Task 6.2: File Storage Integration (Plan)
**Ziel:** CV-Dateien persistent speichern

**Optionen (zu evaluieren):**
1. Vercel Blob Storage
2. AWS S3
3. Local Filesystem (nur Dev)

**Keine Implementierung in diesem Plan — nur Vorbereitung**

---

## Phase 7: Testing & Polish

### Task 7.1: Unit Tests für Field Mapper
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Tests für Mapping-Logik

**Dateien erstellen:**
- `src/lib/cv-autofill/__tests__/field-mapper.test.ts`

**Test Cases (mit Fixtures):**
- Language Level Normalisierung
- Month Normalisierung
- Skill Matching
- Years of Experience Berechnung
- Parser-Tests mit `test_fixtures/cv_samples/` Dateien

**Gate:**
```bash
npm run ci:local
```

---

### Task 7.2: Integration Tests
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** E2E Tests für Upload-Flow

**Dateien erstellen:**
- `src/lib/cv-autofill/__tests__/integration.test.ts`

**Test Cases (mit Fixtures):**
- Upload validiert Dateityp
- Extraktion gibt MappingReport zurück
- Form wird korrekt befüllt
- Tests nutzen `test_fixtures/cv_samples/sample_cv_german.txt`

**Gate:**
```bash
npm run ci:local
```

---

### Task 7.3: Error Handling & UX Polish
<!-- 🚨 Gate: npm run ci:local nach Abschluss - MUSS grün sein! -->

**Ziel:** Robuste Fehlerbehandlung

**Checkliste:**
- [ ] Alle Error-States haben User-Feedback
- [ ] Loading-States sind klar erkennbar
- [ ] Retry-Buttons funktionieren
- [ ] Modal schließen verursacht keine Memory Leaks
- [ ] Accessibility (Keyboard Navigation, ARIA)

**Gate:**
```bash
npm run ci:local
```

---

## Dependency Map

```
Task 1.1 (Types)
    ↓
Task 1.2 (Zod) ──────────────────────┐
    ↓                                 │
Task 1.3 (Constants)                  │
    ↓                                 │
Task 2.1 (Upload Action)              │
    ↓                                 │
Task 2.2 (Extraction Action) ←────────┘
    ↓
Task 2.3 (Field Mapper)
    ↓
┌───────────────────────────────────────┐
│ Parallel:                             │
│ Task 3.1 (Upload Button)              │
│ Task 3.2 (Mapping Modal)              │
│ Task 3.3 (Mapping Row)                │
│ Task 3.4 (Confidence Badge)           │
└───────────────────────────────────────┘
    ↓
Task 4.1 (Form Integration)
    ↓
Task 4.2 (State Merge)
    ↓
┌───────────────────────────────────────┐
│ Parallel:                             │
│ Task 5.1 (PDF Parser)                 │
│ Task 5.2 (DOCX Parser)                │
│ Task 5.3 (OCR - Optional)             │
└───────────────────────────────────────┘
    ↓
Task 5.4 (Data Extractor)
    ↓
Task 6.x (DB - Optional)
    ↓
Task 7.x (Testing)
```

---

## Checkpoints

| After Task | Milestone |
|------------|-----------|
| 1.3 | Types & Validation ready |
| 2.3 | Backend Stubs ready |
| 3.4 | All UI Components ready |
| 4.2 | MVP Integration complete |
| 5.4 | Full Extraction working |
| 7.3 | Production ready |

---

## Open Decisions

| # | Frage | Entscheidung benötigt von |
|---|-------|---------------------------|
| 1 | OCR Provider (Tesseract.js vs. External API) | Tech Lead |
| 2 | File Storage (Vercel Blob vs. S3) | DevOps |
| 3 | LLM für semantische Extraktion (optional) | Product |
| 4 | Welche Skills sollen im System seed existieren? | Product |

---

**END OF TASK PLAN**


"Read and strictly follow CLAUDE.md, AGENTS.md, PROMPTING_RULES.md, specs/cv_autofill_prd.md, specs/cv_autofill_acceptance.md, specs/cv_autofill_schema.json, and tasks/cv_autofill_task.md. Execute tasks/cv_autofill_task.md EXACTLY in order. Do not modify files outside the allowed paths defined in the task file. After EVERY step run: npm run ci:local. If it fails, fix and rerun until green; only then continue. All DB changes must be Drizzle schema + new migrations only; never edit old migrations. CV autofill must NEVER auto-save the final candidate: it produces a draft + mapping report with confidence + sources; any ambiguous/unmapped items must be shown in the UI with suggested target fields and allow the user to map them before final save. Stop only when ALL acceptance criteria are satisfied AND npm run ci:local is green. When finished, output exactly: CV_AUTOFILL_COMPLETE" --max-iterations 80 --completion-promise "CV_AUTOFILL_COMPLETE"