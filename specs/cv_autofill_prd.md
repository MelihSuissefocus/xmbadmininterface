# CV Auto-Fill Feature — Product Requirements Document (PRD)

**Version:** 1.0  
**Erstellt:** 25. Januar 2026  
**Status:** Draft  
**Owner:** Product Team  

---

## 1. Executive Summary

Dieses Feature ermöglicht es Recruitern, Kandidatendaten automatisch aus einem hochgeladenen CV (PDF, PNG, JPG, DOCX) zu extrahieren und in das bestehende Candidate-Create-Formular unter `/dashboard/candidates/new` zu übertragen. Der User behält die volle Kontrolle: Extrahierte Daten werden **niemals** automatisch gespeichert, sondern immer erst nach expliziter Bestätigung.

---

## 2. Scope

### 2.1 In Scope

- Neuer Button "Mit CV Felder automatisiert ausfüllen" oberhalb des Candidate-Forms
- Upload von CV-Dateien (PDF, PNG, JPG, DOCX)
- Extraktion strukturierter Daten aus dem CV
- Befüllung aller mappbaren Formularfelder
- Anzeige nicht-zuordenbarer Items ("Unmapped Items") mit Vorschlägen
- User-Mapping-UI für ambige Felder (z.B. Ethnicity → Nationality)
- Confidence-Scores pro extrahiertem Feld
- Finaler Confirm-Step vor dem Speichern
- OCR-Fallback für gescannte PDFs und Bilder

### 2.2 Out of Scope

- Automatisches Speichern ohne User-Bestätigung
- Batch-Upload mehrerer CVs
- CV-Speicherung in separater Dokumentenbibliothek (außer `originalCvUrl`)
- Integration mit externen ATS-Systemen
- KI-basierte Skill-Matching-Algorithmen

---

## 3. User Stories

| ID | Als... | möchte ich... | damit... |
|----|--------|---------------|----------|
| US-01 | Recruiter | einen CV hochladen können | ich nicht alle Kandidatendaten manuell eintippen muss |
| US-02 | Recruiter | sehen welche Felder erfolgreich extrahiert wurden | ich die Qualität der Extraktion einschätzen kann |
| US-03 | Recruiter | Confidence-Scores pro Feld sehen | ich unsichere Extraktionen priorisiert prüfen kann |
| US-04 | Recruiter | nicht-zuordenbare Items sehen | ich entscheiden kann ob/wie diese gemappt werden |
| US-05 | Recruiter | Vorschläge für ambige Mappings erhalten | ich schneller das richtige Zielfeld finden kann |
| US-06 | Recruiter | Mappings per Dropdown anpassen können | ich Fehler der Extraktion korrigieren kann |
| US-07 | Recruiter | alle Daten vor dem Speichern prüfen können | keine falschen Daten in die DB gelangen |
| US-08 | Recruiter | den Vorgang abbrechen können | ich bei Problemen von vorne beginnen kann |
| US-09 | Recruiter | auch gescannte PDFs nutzen können | ältere CVs ebenfalls verarbeitet werden |
| US-10 | Recruiter | Bilder (PNG/JPG) von CVs hochladen können | ich auch Screenshots/Fotos verwenden kann |

---

## 4. UX Flow

### 4.1 Happy Path

```
[1] User klickt "Mit CV Felder automatisiert ausfüllen"
     ↓
[2] File-Upload Dialog öffnet sich
     ↓
[3] User wählt Datei (PDF/PNG/JPG/DOCX, max 10MB, max 20 Seiten)
     ↓
[4] Loading-State: "CV wird analysiert..."
     ↓
[5] Mapping Report wird angezeigt:
    ├── ✅ Filled Fields (grün) — erfolgreich gemappt
    ├── ⚠️ Ambiguous Fields (gelb) — Vorschläge vorhanden
    └── ❓ Unmapped Items (grau) — nicht zuordenbar
     ↓
[6] User prüft/korrigiert Mappings in der Review-UI
     ↓
[7] User klickt "Daten übernehmen"
     ↓
[8] Formularfelder werden befüllt
     ↓
[9] User kann weiter editieren und final "Kandidat erstellen" klicken
```

### 4.2 Review-UI Komponenten

1. **Mapping Panel** (Modal oder Sidebar)
   - Drei-Spalten-Layout: Quelle | Extrahierter Wert | Zielfeld
   - Confidence-Badge pro Zeile (High/Medium/Low)
   - Dropdown für Zielfeld-Auswahl bei ambigen Items

2. **Unmapped Items Section**
   - Liste aller nicht-gemappten Werte
   - Pro Item: Dropdown mit vorgeschlagenen Zielfeldern
   - Option: "Ignorieren" oder "Manuell zuweisen"

3. **Action Buttons**
   - "Daten übernehmen" — befüllt das Form
   - "Abbrechen" — verwirft alle Extraktionen

---

## 5. Zielfelder (Form Fields)

Basierend auf `src/components/candidates/candidate-form.tsx` und `src/db/schema.ts`:

### 5.1 Persönliche Daten (Basic Info)
| Feld | Typ | Required | Extrahierbar |
|------|-----|----------|--------------|
| `firstName` | text | ✅ | Hoch |
| `lastName` | text | ✅ | Hoch |
| `email` | text | ❌ | Hoch |
| `phone` | text | ❌ | Hoch |
| `street` | text | ❌ | Mittel |
| `postalCode` | text | ❌ | Mittel |
| `city` | text | ❌ | Mittel |
| `canton` | enum (CH-Kantone) | ❌ | Niedrig |
| `linkedinUrl` | text | ❌ | Hoch |
| `targetRole` | text | ❌ | Mittel |

### 5.2 Berufliche Informationen (Professional Info)
| Feld | Typ | Required | Extrahierbar |
|------|-----|----------|--------------|
| `yearsOfExperience` | integer | ❌ | Mittel (berechnet) |
| `currentSalary` | integer | ❌ | Niedrig |
| `expectedSalary` | integer | ❌ | Niedrig |
| `desiredHourlyRate` | integer | ❌ | Niedrig |
| `isSubcontractor` | boolean | ❌ | Niedrig |
| `companyName` | text | ❌ | Mittel |
| `companyType` | enum (ag/gmbh/einzelunternehmen) | ❌ | Niedrig |
| `workloadPreference` | text | ❌ | Niedrig |
| `noticePeriod` | text | ❌ | Mittel |
| `availableFrom` | date | ❌ | Mittel |
| `status` | enum | ❌ | ❌ (System-Feld) |
| `notes` | text | ❌ | ❌ (User-Feld) |

### 5.3 Arrays (Nested Fields)

#### Skills
| Feld | Typ | Extrahierbar |
|------|-----|--------------|
| `skills` | string[] | Hoch |

#### Languages
| Feld | Typ | Extrahierbar |
|------|-----|--------------|
| `languages[].language` | string (aus WORLD_LANGUAGES) | Hoch |
| `languages[].level` | enum (A1-C2, Muttersprache) | Mittel |

#### Certificates
| Feld | Typ | Extrahierbar |
|------|-----|--------------|
| `certificates[].name` | string | Hoch |
| `certificates[].issuer` | string | Mittel |
| `certificates[].date` | date | Mittel |

#### Education
| Feld | Typ | Extrahierbar |
|------|-----|--------------|
| `education[].degree` | string | Hoch |
| `education[].institution` | string | Hoch |
| `education[].startMonth` | string (01-12) | Mittel |
| `education[].startYear` | string (YYYY) | Hoch |
| `education[].endMonth` | string (01-12) | Mittel |
| `education[].endYear` | string (YYYY) | Hoch |

#### Experience
| Feld | Typ | Extrahierbar |
|------|-----|--------------|
| `experience[].role` | string | Hoch |
| `experience[].company` | string | Hoch |
| `experience[].startMonth` | string (01-12) | Mittel |
| `experience[].startYear` | string (YYYY) | Hoch |
| `experience[].endMonth` | string (01-12) | Mittel |
| `experience[].endYear` | string (YYYY) | Hoch |
| `experience[].current` | boolean | Mittel |
| `experience[].description` | string | Hoch |

#### Highlights
| Feld | Typ | Extrahierbar |
|------|-----|--------------|
| `highlights` | string[] (max 4) | Niedrig |

---

## 6. Mapping Report Struktur

Der Mapping Report ist das zentrale Datenmodell zwischen Extraktion und Form-Befüllung:

```typescript
interface MappingReport {
  // Erfolgreich gemappte Felder
  filledFields: FilledField[];
  
  // Felder mit mehreren möglichen Zielen
  ambiguousFields: AmbiguousField[];
  
  // Nicht zuordenbare Items
  unmappedItems: UnmappedItem[];
  
  // Metadaten
  metadata: {
    fileName: string;
    fileType: "pdf" | "png" | "jpg" | "docx";
    fileSize: number;
    pageCount: number;
    extractionMethod: "text" | "ocr";
    processingTimeMs: number;
    timestamp: string;
  };
}

interface FilledField {
  targetField: string;          // z.B. "firstName", "experience[0].company"
  extractedValue: unknown;      // String, Number, oder komplexes Objekt
  confidence: "high" | "medium" | "low";
  source: {
    text: string;               // Original-Text aus CV
    page?: number;              // Seitennummer (falls PDF)
    position?: string;          // z.B. "header", "section:education"
  };
}

interface AmbiguousField {
  extractedLabel: string;       // z.B. "Ethnicity"
  extractedValue: string;
  suggestedTargets: {
    targetField: string;        // z.B. "canton"
    confidence: "high" | "medium" | "low";
    reason: string;             // z.B. "Label similarity"
  }[];
  selectedTarget?: string;      // User-Auswahl
  source: {
    text: string;
    page?: number;
  };
}

interface UnmappedItem {
  extractedLabel?: string;
  extractedValue: string;
  category?: string;            // z.B. "contact", "date", "text"
  suggestedTargets: {
    targetField: string;
    confidence: "low";
    reason: string;
  }[];
  selectedTarget?: string;      // User-Auswahl oder null für "ignorieren"
  source: {
    text: string;
    page?: number;
  };
}
```

---

## 7. Performance Requirements

| Metrik | Ziel |
|--------|------|
| Upload-Zeit (10MB PDF) | < 2 Sekunden |
| Extraktion (Text-PDF, 5 Seiten) | < 5 Sekunden |
| Extraktion (OCR-PDF, 5 Seiten) | < 15 Sekunden |
| UI Response nach Extraktion | < 500ms |

---

## 8. PII & Security

### 8.1 Datenschutz

- Hochgeladene Dateien werden **nur temporär** verarbeitet
- Keine Speicherung von CVs ohne explizite User-Aktion
- Original-CV-URL wird nur bei finaler Kandidaten-Erstellung gespeichert
- Logs enthalten **keine** PII (redaktiert)

### 8.2 Validierung

| Check | Limit |
|-------|-------|
| Dateigröße | max. 10 MB |
| Seitenzahl | max. 20 Seiten |
| Dateitypen | PDF, PNG, JPG, JPEG, DOCX |
| Dateiname | keine executable Extensions |

### 8.3 Logging (redaktiert)

```
✅ OK:  "CV extraction completed: 15 fields mapped, 3 ambiguous, 2 unmapped"
❌ BAD: "Extracted email: john.doe@example.com"
```

---

## 9. Fehlerfälle

| Fehler | User-Feedback | Aktion |
|--------|---------------|--------|
| Datei zu groß (>10MB) | "Datei ist zu groß. Maximum: 10 MB" | Upload blockiert |
| Falscher Dateityp | "Nur PDF, PNG, JPG oder DOCX erlaubt" | Upload blockiert |
| Zu viele Seiten (>20) | "Zu viele Seiten. Maximum: 20" | Upload blockiert |
| OCR fehlgeschlagen | "Text konnte nicht erkannt werden" | Manuell fortfahren |
| Keine Daten extrahiert | "Keine Kandidatendaten gefunden" | Manuell fortfahren |
| Netzwerkfehler | "Verbindungsfehler. Bitte erneut versuchen" | Retry-Button |
| Server-Timeout | "Analyse dauert zu lange. Bitte erneut versuchen" | Retry-Button |

---

## 10. Dependencies

### 10.1 Bestehende Module (kein Change)
- `src/components/candidates/candidate-form.tsx` — Form-Struktur
- `src/actions/candidates.ts` — createCandidate/updateCandidate
- `src/db/schema.ts` — candidates Table
- `src/lib/constants.ts` — WORLD_LANGUAGES, LANGUAGE_LEVELS, etc.

### 10.2 Neue Module (zu erstellen)
- `src/components/candidates/cv-upload-button.tsx` — Upload-Trigger
- `src/components/candidates/cv-mapping-modal.tsx` — Review-UI
- `src/actions/cv-extraction.ts` — Server Action für Extraktion
- `src/lib/cv-parser.ts` — Parsing-Logik

### 10.3 Externe Services (TBD)
- OCR-Provider für gescannte PDFs (z.B. Tesseract.js, Google Vision API)
- Optional: LLM für semantische Extraktion

---

## 11. Success Metrics

| KPI | Ziel |
|-----|------|
| Adoption Rate | 70% der neuen Kandidaten via CV-Upload |
| Field Accuracy | >90% korrekt gemappte Pflichtfelder |
| Time Saved | 50% weniger Zeit für Kandidatenerfassung |
| Error Rate | <5% Abbrüche im Upload-Flow |

---

## 12. Open Questions

1. Welcher OCR-Provider soll verwendet werden?
2. Soll die Original-CV-Datei in Cloud Storage (z.B. Vercel Blob) gespeichert werden?
3. Gibt es Pläne für Multi-Language-Support bei der Extraktion?
4. Sollen extrahierte Daten für ML-Training geloggt werden (anonymisiert)?

---

**END OF PRD**
