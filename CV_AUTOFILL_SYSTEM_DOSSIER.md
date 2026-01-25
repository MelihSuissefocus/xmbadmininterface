# CV Auto-Fill System Dossier — Gap-Analyse & Fixes

**Erstellt:** 25. Januar 2026  
**Analyse-Typ:** Principal System Architect + Security/Privacy Review + ML/LLM Reliability Audit  
**Scope:** CV-PDF Upload → automatische Felderkennung → Autofill → Unsicherheiten zur Bestätigung  

---

## A) High-Level Flow (Sequenzdiagramm in Textform)

### Trigger → Schritte → Outputs → Fehlerpfade

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. USER → CVUploadButton.handleClick()                                          │
│    └─ Öffnet nativen File-Picker (accept=".pdf,.png,.jpg,.jpeg,.docx")          │
│                                                                                 │
│ 2. USER → Datei ausgewählt                                                      │
│    └─ CVUploadButton.handleFileChange()                                         │
│                                                                                 │
│ 3. FRONTEND → Server Action: uploadCV(formData)                                 │
│    ├─ Validierung: Dateigröße (max 10MB), MIME-Type, Extension                  │
│    ├─ ERROR PATH: { success: false, error: "..." } → onError()                  │
│    └─ SUCCESS: Konvertierung File → base64 → UploadResult                       │
│                                                                                 │
│ 4. FRONTEND → Server Action: extractFromCV(base64, fileName, fileType, fileSize)│
│    ├─ Switch auf fileType:                                                      │
│    │   ├─ PDF: extractTextFromPDF(buffer) → pdf2json                            │
│    │   │   └─ FALLBACK: detectIfScanned() → extractTextFromImage() (OCR)        │
│    │   ├─ DOCX: extractTextFromDOCX(buffer) → mammoth                           │
│    │   └─ PNG/JPG: extractTextFromImage(buffer) → tesseract.js                  │
│    ├─ Page Count Validation (max 20)                                            │
│    ├─ Text Extraction → rawText                                                 │
│    ├─ Data Extraction (Regex-basiert):                                          │
│    │   ├─ extractPersonalInfo() → firstName, lastName, email, phone, etc.       │
│    │   ├─ extractExperiences() → experience[]                                   │
│    │   ├─ extractEducation() → education[]                                      │
│    │   ├─ extractLanguages() → languages[]                                      │
│    │   ├─ extractSkills() → skills[] (matched gegen DB-Skills)                  │
│    │   └─ extractCertificates() → certificates[]                                │
│    ├─ Ambiguous Pattern Matching (Nationality, Ethnicity, etc.)                 │
│    ├─ ERROR PATH: { filledFields: [], ambiguousFields: [], ... }                │
│    └─ SUCCESS: CandidateAutoFillDraft                                           │
│                                                                                 │
│ 5. FRONTEND → CVMappingModal öffnet mit Draft                                   │
│    ├─ Zeigt: filledFields (grün), ambiguousFields (gelb), unmappedItems (grau)  │
│    ├─ User kann: Dropdown ändern, "Ignorieren" wählen                           │
│    └─ Buttons: "Abbrechen" | "Daten übernehmen"                                 │
│                                                                                 │
│ 6. USER → "Daten übernehmen"                                                    │
│    └─ CVMappingModal.handleConfirm() → mappedData an onConfirm() callback       │
│                                                                                 │
│ 7. FRONTEND → Candidate-Form wird mit mappedData befüllt                        │
│    └─ KEIN automatisches Speichern!                                             │
│                                                                                 │
│ 8. USER → Klickt "Kandidat erstellen"                                           │
│    └─ createCandidate() Server Action → DB Insert → revalidatePath()            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Fehlerpfade

| Schritt | Fehler | Handling |
|---------|--------|----------|
| 3 | Datei > 10MB | Sofortiger Reject, Error-Message |
| 3 | Falscher MIME-Type | Sofortiger Reject, Error-Message |
| 4 | Seiten > 20 | Exception, leerer Draft |
| 4 | PDF-Parse fehlgeschlagen | catch → leerer Draft |
| 4 | OCR Timeout (60s) | Error-Log, leerer Draft |
| 4 | Kein Text extrahiert | Leerer Draft mit Metadata |
| 5 | User klickt "Abbrechen" | Draft verworfen, Form bleibt |

### Retries/Idempotenz

**UNKLAR:** Keine explizite Retry-Logik im Code gefunden. Keine Idempotency-Keys. User muss manuell erneut hochladen.

---

## B) Schnittstellen

### Upload Endpoint(s)

| Eigenschaft | Wert | Fundstelle |
|-------------|------|------------|
| **URL** | Server Action (kein HTTP-Endpoint für Production-Flow) | `src/actions/cv-upload.ts` |
| **Alternative URL** | `POST /api/cv-extract` (für E2E-Tests) | `src/app/api/cv-extract/` (Ordner leer im Scan) |
| **Method** | FormData via Server Action | `cv-upload-button.tsx:42-44` |
| **Auth** | Implizit via NextAuth Middleware | `middleware.ts` |
| **Payload** | `FormData { file: File }` | `cv-upload.ts:19` |
| **Limits** | 10 MB, Extensions: pdf/png/jpg/jpeg/docx | `constants.ts:48-51` |
| **Response** | `{ success, base64?, fileName?, fileType?, fileSize?, error? }` | `cv-upload.ts:10-17` |

### Interne Events/Queues/Topics

**NICHT VORHANDEN.** Die Implementierung ist vollständig synchron:
- Kein Background Worker
- Kein Queue-System (Bull, BullMQ, etc.)
- Kein Event-Bus
- Alle Operationen blocking im Request

### Storage

| Was | Wo | Fundstelle |
|-----|-----|------------|
| **Original-PDF** | NICHT gespeichert | PRD: "nur temporär verarbeitet" |
| **base64 Buffer** | In-Memory, nur während Request | `cv-extraction.ts:33` |
| **Extrahierter Text** | In-Memory, nicht persistiert | - |
| **parsedData** | `candidates.parsed_data` (JSONB) | `schema.ts:187` |
| **originalCvUrl** | `candidates.original_cv_url` | `schema.ts:185` |
| **HINWEIS** | originalCvUrl wird im Code NICHT befüllt | Kein Upload zu Blob Storage |

---

## C) PDF/Text/OCR Pipeline

### Verwendete Libraries/Services

| Bibliothek | Version | Zweck | Fundstelle |
|------------|---------|-------|------------|
| **pdf2json** | ^4.0.2 | PDF-Text-Extraktion (Pure JS, SSR-safe) | `package.json:32` |
| **mammoth** | ^1.11.0 | DOCX-Text-Extraktion | `package.json:30` |
| **tesseract.js** | ^7.0.0 | OCR für Images/Scanned PDFs | `package.json:36` |

**NICHT verwendet (entfernt):**
- `canvas` (Native Bindings, SSR-Probleme)
- `pdfjs-dist` (Worker-Probleme)
- `pdf-parse` (Deprecated)

### Erkennung "native text" vs "scan"

```typescript
// pdf-parser.ts:79-104
export function detectIfScanned(text: string): boolean {
  // Heuristik 1: Sehr kurzer Text (< 100 Zeichen)
  if (text.trim().length < 100) return true;

  // Heuristik 2: Word Density < 8%
  const wordsRegex = /\b[a-zA-ZäöüßÄÖÜ]{2,}\b/g;
  const words = text.match(wordsRegex) || [];
  const wordDensity = words.length / Math.max(text.length, 1);
  if (wordDensity < 0.08) return true;

  // Heuristik 3: Unique Characters < 20
  const uniqueChars = new Set(text.toLowerCase().split("")).size;
  if (uniqueChars < 20) return true;

  return false;
}
```

### Layout/Spaltenlogik

**NICHT VORHANDEN.** pdf2json liefert nur linearen Text ohne:
- Spalteninformationen
- Bounding Boxes
- Koordinaten
- Tabellenstruktur

**BUG-RISIKO:** Mehrspaltige CVs werden als durcheinander gemischter Text extrahiert.

### Output-Format der Extraktion

```typescript
// pdf-parser.ts:5-9
interface ExtractedText {
  text: string;        // Reiner Text, keine Struktur
  pageCount: number;
  method: "text" | "ocr";
}
```

**KEIN:**
- Koordinaten/Position pro Wort
- Confidence pro Zeichen/Wort
- Bounding Boxes
- Seitenzuordnung pro Textfragment

### Qualitätsmetriken

| Metrik | Vorhanden | Fundstelle |
|--------|-----------|------------|
| OCR Confidence (Tesseract) | ✅ Ja, aber **NICHT VERWENDET** | `ocr-parser.ts:39` |
| PDF-Parse Confidence | ❌ Nein | - |
| Word Density | Nur für Scanned-Detection | `pdf-parser.ts:87` |

**BUG:** OCR-Confidence wird extrahiert (`result.data.confidence`) aber **NICHT** an Downstream weitergegeben oder für Feld-Confidence genutzt.

---

## D) Information Extraction / NLP / LLM

### Verwendete Modelle/Provider

**KEIN LLM VERWENDET.**

Trotz Dokumentation in:
- `.cursorrules:14`: "AI/LLM: OpenAI SDK (for CV Parsing)"
- `.project_spec.md:61`: "Send PDF text/URL to OpenAI GPT-4o"

Ist **KEINE OpenAI-Integration** implementiert:
- Kein `openai` Package in `package.json`
- Kein API-Key Handling
- Keine Prompt-Templates

### Aktuelle Extraktionslogik

Rein **Regex-basiert** in `data-extractor.ts`:

```typescript
// Email Extraktion (Zeile 38-42)
const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Telefon Extraktion (Zeile 45-48)
const phoneRegex = /(\+?\d{1,3}[\s-]?)?(\(?\d{2,3}\)?[\s-]?)?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;

// Name Extraktion (Zeile 54-115)
// Sucht nach Patterns wie "John Doe" oder "JOHN DOE" in ersten 10 Zeilen
```

### "Extract-only" Schutz

**TEILWEISE.** Die Regex-basierte Extraktion kann nur finden, was im Text vorhanden ist. Aber:

- **KEIN** Source-Text-Nachweis pro extrahiertem Wert (nur `source.text` mit max 50 Zeichen)
- **KEINE** Bounding-Box oder Seiten-Referenz für Verification
- Bei Arrays (experience, education) ist `source.text` nur "Experience section" — nicht der tatsächliche Text

### Evidence: Textspanne/Seite/Bounding Box

```typescript
// cv-extraction.ts:98-102
filledFields.push({
  targetField: "firstName",
  extractedValue: personalInfo.firstName,
  confidence: "high",
  source: { text: personalInfo.firstName.substring(0, 50) }, // ← Nur erster Wert
});
```

**DEFIZITE:**
- `page` nie gesetzt (immer undefined)
- `position` nie gesetzt
- Bei Arrays generische Labels wie "Experience section"
- Kein PDF-Highlight möglich

### Mehrsprachigkeit

**Tesseract OCR:** `eng+deu+fra+ita` (4 Sprachen)

```typescript
// ocr-parser.ts:22
const worker = await createWorker("eng+deu+fra+ita", 1, { ... });
```

**Regex-Patterns:** Nur DE/EN

```typescript
// data-extractor.ts - German/English Month Names
const germanMonths = { "januar": "01", ... };
const englishMonths = { "january": "01", ... };
```

### Validierungen & Normalisierung

| Feld | Validierung | Normalisierung | Fundstelle |
|------|-------------|----------------|------------|
| Email | Regex Match | Keine | `data-extractor.ts:38` |
| Phone | Regex Match | Keine (wird so übernommen) | `data-extractor.ts:45` |
| LinkedIn | Regex Match | Keine | `data-extractor.ts:51` |
| Language Level | Keyword-Match | → CEFR (A1-C2, Muttersprache) | `field-mapper.ts:95-120` |
| Canton | Lookup | → CH-Kürzel (AG, ZH, etc.) | `field-mapper.ts:309-321` |
| Date/Month | Regex + Name-Match | → MM Format | `field-mapper.ts:127-180` |

**FEHLEND:**
- Keine Email-Validierung (nur Regex)
- Keine Phone-Normalisierung (E.164)
- Keine Country-Code-Normalisierung (ISO)
- Keine Postleitzahl-Validierung

---

## E) Feld-Mapping auf Datenmodell

### Internes Kandidaten-Schema

```typescript
// types.ts:13-19
interface FilledField {
  targetField: string;       // z.B. "firstName", "experience"
  extractedValue: unknown;   // String, Array, Object
  confidence: ConfidenceLevel; // "high" | "medium" | "low"
  source: SourceInfo;        // { text, page?, position? }
}
```

**NICHT enthalten:**
- Kein `rawText` (vollständiger Quelltext)
- Keine `boundingBox`
- Kein `extractionModel` (für Versionierung)

### Synonym-Handling

```typescript
// field-mapper.ts:26-56
const directMappings: Record<string, string> = {
  "vorname": "firstName",
  "first name": "firstName",
  "nachname": "lastName",
  // ... 20+ Mappings
};
```

**NICHT konfigurierbar pro Tenant.** Hardcoded in Source.

### Semantisches Matching

**KEIN Embedding-basiertes Matching.**

Nur:
1. Exakte Label-Matches (case-insensitive)
2. Partial String-Matching (`label.includes()`)
3. Keyword-basierte Zuordnung

```typescript
// field-mapper.ts:66-72
if (normalizedLabel.includes("name") && ...) {
  return { targetField: "firstName", confidence: "medium", ... };
}
```

### Disambiguation

**UNZUREICHEND.**

Das `ambiguousPatterns` Array in `cv-extraction.ts:219-227`:

```typescript
const ambiguousPatterns = [
  { label: "Ethnicity", pattern: /ethnicity\s*:?\s*([^\n]+)/i },
  { label: "Nationality", pattern: /nationality\s*:?\s*([^\n]+)/i },
  // ...
];
```

**PROBLEM:** "Deutsch" als Sprache vs. Staatsangehörigkeit wird NICHT unterschieden:
- Regex findet `Nationality: Deutsch`
- Fügt es zu `ambiguousFields` hinzu
- **ABER:** Wenn "Deutsch" in Sprachen-Section steht, wird es als Sprache extrahiert
- Keine kontextuelle Analyse

### Thresholds: Autofill vs Review vs Leer

```typescript
// cv-extraction.ts - Hardcoded Confidence Levels
// HIGH: firstName, lastName, email, phone, linkedinUrl, experience, education, languages
// MEDIUM: city, postalCode, street, canton, targetRole, skills, certificates
// LOW: (nie verwendet in Extraction)
```

**KEIN konfigurierbarer Threshold.** Alle `high` und `medium` gehen in `filledFields`, nur explizite Patterns in `ambiguousFields`.

---

## F) Confidence Scoring

### Berechnungsmethode

**KEINE Berechnung.** Confidence ist **HARDCODED** basierend auf Feldtyp:

```typescript
// cv-extraction.ts
// Email → always "high" (Zeile 115)
// Phone → always "high" (Zeile 122)
// City → always "medium" (Zeile 143)
// Skills → always "medium" (Zeile 193)
```

### Pro Feld oder Global?

Pro Feld, aber **statisch**, nicht datenabhängig.

### Quellengewichtung

**NICHT VORHANDEN.** Keine Unterscheidung zwischen:
- Regex-Match Confidence
- OCR Confidence
- Structural Confidence (Section Headers)

### Calibration/Monitoring

**NICHT VORHANDEN.**
- Keine Logging von Confidence-Verteilung
- Kein A/B-Testing
- Kein Feedback-Loop zu Confidence

---

## G) Review/Confirmation UX

### Angezeigte Felder

```tsx
// cv-mapping-modal.tsx:99-139
{filledFields.map((field, index) => (
  <div className="p-3 bg-green-50 ...">
    <div>{field.targetField}</div>           // Technischer Feldname
    <div>{String(field.extractedValue)}</div> // Stringified Wert
    <Badge>{field.confidence}</Badge>         // high/medium/low
  </div>
))}
```

### User-Aktionen

| Aktion | Verfügbar | Fundstelle |
|--------|-----------|------------|
| Feld bestätigen | ✅ Implizit (im Modal) | `cv-mapping-modal.tsx` |
| Wert ändern | ❌ Nicht in Modal | - |
| Feld ablehnen | ❌ Nicht für filledFields | - |
| Zielfeld ändern (ambiguous) | ✅ Dropdown | `cv-mapping-modal.tsx:205-218` |
| Ignorieren | ✅ Option im Dropdown | `cv-mapping-modal.tsx:214` |

### PDF-Highlight Evidence

**NICHT IMPLEMENTIERT.**
- Kein PDF-Viewer im Modal
- Keine Koordinaten für Highlighting
- Nur Text-Snippet in `source.text`

### Nach Bestätigung

1. `handleConfirm()` baut `mappedData` Objekt
2. `onConfirm(mappedData)` Callback in Parent
3. Form-State wird mit `mappedData` gemergt
4. **KEIN Audit-Log** für CV-Extraktion
5. **KEIN Learn/Feedback** gespeichert

---

## H) Feedback-Loop / Lernen

### User-Korrekturen Speicherung

**NICHT IMPLEMENTIERT.**

- Keine Speicherung von User-Overrides
- Keine Diff-Analyse (extracted vs. final)
- Keine Feedback-Table in Schema

### Tenant-spezifische Mappings

**NICHT MÖGLICH.** Alle Mappings sind globale Constants:
- `directMappings` in `field-mapper.ts`
- `CANTON_MAPPING` in `constants.ts`
- `languageVariations` in `field-mapper.ts`

### Versionierung der Extraktionslogik

**NICHT VORHANDEN.**

- Kein Version-Tag in Draft Metadata
- Kein Changelog für Extraction-Regeln
- Reproduzierbarkeit nicht gewährleistet

---

## I) Persistenz & Datenmodell

### Kandidatenprofil-Schema

```typescript
// schema.ts:128-192
export const candidates = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  // ... 25+ weitere Felder
  parsedData: jsonb("parsed_data"),           // ← Für rohe Extraktionsdaten
  originalCvUrl: text("original_cv_url"),     // ← Für CV-Datei-Link
  status: candidateStatusEnum("status"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

### Extrahierte Rohdaten

`parsedData` existiert aber wird **NICHT befüllt** durch CV-Extraction. Nur deklariert.

### Retention/Deletion

**NICHT DEFINIERT.**
- Keine TTL auf candidates
- Keine Soft-Delete Logik
- Keine automatische PII-Löschung

### Audit-Trail

`auditLogs` Table existiert (`schema.ts:77-84`) aber:

**CV-Extraction erstellt KEINEN Audit-Eintrag:**
- Kein Log bei Upload
- Kein Log bei Extraction
- Kein Log bei Confirmation
- Nur `createCandidate` wird (nicht) geloggt

---

## J) Security & Compliance

### AuthN/AuthZ

| Aspekt | Status | Details |
|--------|--------|---------|
| **AuthN** | ✅ NextAuth | `auth.ts`, JWT-Session |
| **Middleware** | ✅ Protected Routes | `middleware.ts` |
| **CV-Upload AuthZ** | ⚠️ Nur via Session | Keine Rollen-Prüfung |
| **API Route /api/cv-extract** | ❌ WAR PUBLIC | `CV_FIX_SUMMARY.md:48` - Wurde zu public routes hinzugefügt! |

**BUG:** `/api/cv-extract` wurde für E2E-Tests zu public routes hinzugefügt und möglicherweise nicht entfernt.

### Encryption at Rest/in Transit

| Aspekt | Status |
|--------|--------|
| **Transit** | ✅ HTTPS (Vercel Default) |
| **DB at Rest** | ✅ Neon PostgreSQL (encrypted) |
| **CV-Dateien at Rest** | N/A (nicht gespeichert) |
| **base64 in Memory** | ⚠️ Unencrypted während Request |

### Key Management

- Keine Custom-Encryption-Keys
- Keine Secrets im Code
- Environment Variables für DB/Auth (`.env.local`)

### Logging: PII

**KRITISCH:**

```typescript
// cv-extraction.ts:53
console.log("PDF appears to be scanned, attempting OCR...");

// cv-extraction.ts:60
console.error("OCR fallback failed:", ocrError);  // ← Error kann Text enthalten

// cv-extraction.ts:299
console.error("CV extraction error:", error);      // ← Error kann PII enthalten
```

**Acceptance Criteria fordert (AC-23):**
> "Server-Logs enthalten NICHT: Namen, Email, Telefon, Adressen"
> "Alle extrahierten Werte sind im Log redaktiert als [REDACTED]"

**NICHT ERFÜLLT.** Keine PII-Redaction implementiert.

### Threats

| Threat | Schutz | Status |
|--------|--------|--------|
| **Prompt Injection via CV-Text** | N/A (kein LLM) | ✅ |
| **SSRF via URL-Felder** | LinkedIn-Regex validiert nur Format | ⚠️ |
| **File Exploits (PDF Bombs)** | Nur Page-Count Check | ⚠️ |
| **Malicious PDF (JavaScript)** | pdf2json führt kein JS aus | ✅ |
| **Path Traversal via Filename** | ❌ Nicht geprüft | ❌ |
| **ZIP Bombs (DOCX)** | mammoth hat keine Protection | ⚠️ |

### Sandbox/AV-Scan

**NICHT VORHANDEN.**
- Keine Malware-Prüfung
- Keine Sandbox-Execution
- Keine File-Type-Magic-Byte Validierung

---

## K) Reliability & Scaling

### Timeouts

```typescript
// constants.ts:50-51
EXTRACTION_TIMEOUT_MS: 30000,  // ← NICHT VERWENDET im Code
OCR_TIMEOUT_MS: 60000,         // ← Verwendet in ocr-parser.ts:20
```

**BUG:** `EXTRACTION_TIMEOUT_MS` ist definiert aber nicht angewendet.

### Rate Limits

**NICHT VORHANDEN.**
- Kein Rate-Limiting auf Server Actions
- Kein Request-Throttling
- Kein Per-User-Limit

### Backpressure

**NICHT VORHANDEN.** Alle Requests werden synchron verarbeitet.

### Async vs Sync

**VOLLSTÄNDIG SYNCHRON.**
- Kein Background Processing
- Keine Queues
- Blocking während OCR (bis 60s)

### Worker Concurrency

N/A (keine Worker)

### Idempotency

**NICHT VORHANDEN.**
- Kein Dedupe für gleiche Datei
- Kein Hash-Check
- Jeder Upload ist neu

### Fallbacks

```typescript
// cv-extraction.ts:49-62
if (detectIfScanned(extractedText)) {
  try {
    const ocrResult = await extractTextFromImage(...);
  } catch (ocrError) {
    console.error("OCR fallback failed:", ocrError);
    // Continue with whatever text we have ← SILENT DEGRADATION
  }
}
```

**Fallback-Kette:**
1. PDF → Text-Extraktion
2. Text zu kurz → OCR
3. OCR fehlschlägt → Use original (schlechter) Text

---

## L) Testabdeckung & Qualitätsnachweis

### Unit/Integration/E2E Tests

| Test-Typ | Dateien | Status |
|----------|---------|--------|
| **Unit Tests** | Keine `.test.ts` / `.spec.ts` gefunden | ❌ |
| **Integration Tests** | Keine | ❌ |
| **E2E Tests** | `testing/smoke-test-e2e.ts`, `testing/smoke-test-production-e2e.ts` | ✅ Manuell |
| **Test Framework** | Keines konfiguriert | ❌ |

### Test-CVs und erwartete Outputs

```
test_fixtures/cv_samples/
├── sample_cv_english.txt    # Jane Doe, Example Corp
├── sample_cv_german.txt     # Max Mustermann, Beispiel GmbH
└── sample_cv_minimal.txt    # Erika Musterfrau (nur Name + Email)
```

**PROBLEM:** Nur `.txt` Fixtures, keine echten PDFs mit Layout-Varianten.

### Messgrößen

**NICHT IMPLEMENTIERT:**
- Keine Autofill-Rate Messung
- Keine Field-Accuracy Messung
- Keine False-Positive Tracking
- Keine Regression-Detection

---

## M) Bekannte Schwachstellen (aus Code abgeleitet)

### M1. KEIN LLM — Trotz Dokumentation

**Fundstelle:** `.cursorrules:14`, `.project_spec.md:61`, `package.json` (kein `openai`)

**Beschreibung:** Die Architektur-Dokumentation erwähnt OpenAI GPT-4o, aber keine LLM-Integration existiert. Reine Regex-Extraktion.

**Impact:** Semantische Fehler bei komplexen CVs, schlechte Accuracy bei unstrukturierten Texten.

---

### M2. Hardcoded Confidence Levels

**Fundstelle:** `cv-extraction.ts:98-200`

**Beschreibung:** Confidence ist statisch pro Feldtyp, nicht basierend auf:
- Regex-Match-Qualität
- OCR-Confidence
- Kontext-Sicherheit

**Impact:** User erhält falsche Sicherheitssignale. "High Confidence" bei fehlerhafter Extraktion.

---

### M3. Keine PDF-Layout-Analyse

**Fundstelle:** `pdf-parser.ts` - pdf2json liefert nur linearen Text

**Beschreibung:** Mehrspaltige CVs, Tabellen, Sidebars werden als durcheinander gemischter Text extrahiert.

**Impact:** Name aus Header + Skill aus Sidebar werden als "Max Python" interpretiert.

---

### M4. OCR-Confidence wird ignoriert

**Fundstelle:** `ocr-parser.ts:39` - `confidence` wird extrahiert aber nicht verwendet

```typescript
const confidence = result.data.confidence;  // Vorhanden
return { text, pageCount, method: "ocr", confidence };  // Returned
// Aber in cv-extraction.ts NICHT genutzt
```

**Impact:** Schlechte OCR-Qualität nicht erkennbar für User.

---

### M5. Keine PII-Redaction in Logs

**Fundstelle:** `cv-extraction.ts:299`, `cv-upload.ts:78`, diverse andere

**Beschreibung:** `console.error()` kann Error-Objekte mit PII loggen. Keine Sanitization.

**Impact:** DSGVO-Verletzung, PII in Vercel-Logs.

---

### M6. /api/cv-extract möglicherweise Public

**Fundstelle:** `CV_FIX_SUMMARY.md:48`, `middleware.ts`

**Beschreibung:** Route wurde für E2E-Tests zu public routes hinzugefügt. Unklar ob reverted.

**Impact:** Unauthentifizierter CV-Upload möglich (DoS-Vektor).

---

### M7. Keine File-Magic-Byte Validierung

**Fundstelle:** `cv-upload.ts:41-60`

**Beschreibung:** Nur Extension und MIME-Type werden geprüft. Keine Magic-Byte-Analyse.

**Impact:** Malicious File mit falscher Extension kann durchkommen.

---

### M8. Keine Rate-Limits

**Fundstelle:** Keine Rate-Limit-Logik gefunden

**Beschreibung:** Unbegrenzte Upload-Anfragen möglich.

**Impact:** DoS durch massenhafte OCR-Requests (60s Timeout jeweils).

---

### M9. Nationality/Sprache Disambiguation fehlt

**Fundstelle:** `cv-extraction.ts:219-248`, `data-extractor.ts:303-341`

**Beschreibung:** "Deutsch" wird immer als Sprache interpretiert, auch wenn es Nationalität bedeutet.

**Impact:** False Positives in Sprachen-Array.

---

### M10. Kein Extraction-Version-Tag

**Fundstelle:** `types.ts:42-53` - Metadata hat kein Version-Feld

**Beschreibung:** Keine Versionierung der Extraktionslogik. Nicht reproduzierbar.

**Impact:** Bug-Analyse unmöglich. Keine Regression-Detection.

---

### M11. parsedData wird nicht befüllt

**Fundstelle:** `schema.ts:187`, `candidates.ts` - Kein Write zu `parsedData`

**Beschreibung:** Schema hat Feld, aber CV-Rohdaten werden nicht gespeichert.

**Impact:** Debugging und Re-Extraction unmöglich.

---

### M12. Kein Audit-Log für CV-Extraction

**Fundstelle:** `cv-extraction.ts` - Kein `createAuditLog()` Call

**Beschreibung:** Weder Upload noch Extraction noch Confirmation werden geloggt.

**Impact:** Compliance-Probleme, keine Nachvollziehbarkeit.

---

## N) Priorisierte Fixliste

### P0 — Kritische Sicherheitslücken (Sofort)

| # | Problem | Impact | Fix | Test |
|---|---------|--------|-----|------|
| **N1** | PII in Logs (M5) | DSGVO-Verletzung | Wrapper um `console.error` mit PII-Filter in `cv-extraction.ts`, `cv-upload.ts` | Log-Output prüfen auf Email/Phone/Name |
| **N2** | /api/cv-extract Public (M6) | Unauthentifizierter Zugriff | In `middleware.ts` entfernen aus public routes ODER Route löschen | Curl ohne Auth → 401 |
| **N3** | Keine Rate-Limits (M8) | DoS-Vektor | Rate-Limit Middleware (z.B. `@upstash/ratelimit`) auf Upload-Route | 10 Requests/min → 429 |

### P1 — Funktionale Bugs (Diese Woche)

| # | Problem | Impact | Fix | Test |
|---|---------|--------|-----|------|
| **N4** | Hardcoded Confidence (M2) | Falsche User-Signale | Confidence-Berechnung basierend auf: Regex-Match-Length, OCR-Confidence, Section-Context | Test-CVs mit bekannter Qualität |
| **N5** | OCR-Confidence ignoriert (M4) | Schlechte Qualität nicht erkennbar | In `cv-extraction.ts` OCR-Confidence an Feld-Confidence weitergeben | OCR mit < 50% → "low" Confidence |
| **N6** | Layout ignoriert (M3) | Falsche Extraktion bei 2-Spalten-CVs | Alternatives PDF-Library (pdfminer.six via Python-Microservice, oder pdf.js mit Layout) | 2-Spalten-CV → korrekte Trennung |
| **N7** | Magic-Byte Validation (M7) | Malicious Files | `file-type` Package für Magic-Byte-Check | Fake-Extension → Reject |

### P2 — Technical Debt (Diesen Monat)

| # | Problem | Impact | Fix | Test |
|---|---------|--------|-----|------|
| **N8** | Kein LLM (M1) | Schlechte Accuracy | OpenAI SDK integrieren mit strukturierter Extraction-Prompt | GPT-Output vs Regex-Output vergleichen |
| **N9** | Nationality Disambiguation (M9) | False Positives | Kontext-Analyse: Wenn in "Sprachen"-Section → Sprache, sonst ambiguous | Test-CV mit "Deutsch" in beiden Kontexten |
| **N10** | Kein Extraction-Version (M10) | Nicht reproduzierbar | Version-Feld in Metadata, Changelog in Code | Version in Draft-Metadata prüfen |
| **N11** | parsedData nicht befüllt (M11) | Keine Re-Extraction | In `createCandidate` Action Draft in `parsedData` speichern | DB-Check nach Create |
| **N12** | Kein Audit-Log (M12) | Keine Nachvollziehbarkeit | `createAuditLog()` in `cv-extraction.ts` bei Success | Audit-Table nach Extraction prüfen |
| **N13** | EXTRACTION_TIMEOUT nicht verwendet | Hängende Requests | Timeout in `extractFromCV` mit Promise.race | Künstlich langsamer PDF → Timeout |
| **N14** | Unit Tests fehlen | Keine Regression-Detection | Jest/Vitest Setup, Tests für `data-extractor.ts` | `npm test` grün |

---

## Executive Summary (max 15 Zeilen)

### Top 5 Risiken

1. **PII in Logs** (P0): `console.error` loggt potenziell sensible Daten → DSGVO-Verletzung
2. **Public API Route** (P0): `/api/cv-extract` möglicherweise unauthentifiziert zugänglich
3. **Keine Rate-Limits** (P0): Unbegrenzte OCR-Requests = DoS-Vektor (60s Timeout × ∞)
4. **Hardcoded Confidence** (P1): "High Confidence" bei falscher Extraktion → User-Vertrauen zerstört
5. **Kein Layout-Parsing** (P1): 2-Spalten-CVs werden als Textbrei extrahiert

### Top 5 Quick Wins

1. **PII-Filter** in Logs: 30 Min — Wrapper-Funktion um `console.error`
2. **Rate-Limit** auf Upload: 1h — `@upstash/ratelimit` Middleware
3. **API Route Auth prüfen**: 10 Min — `middleware.ts` Review
4. **OCR-Confidence nutzen**: 1h — Tesseract-Confidence an Feld-Confidence durchreichen
5. **Magic-Byte Check**: 30 Min — `file-type` Package hinzufügen

---

**ENDE DES DOSSIERS**
