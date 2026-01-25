# CV Auto-Fill Feature — Acceptance Criteria

**Version:** 1.0  
**Erstellt:** 25. Januar 2026  
**Format:** Given/When/Then (Gherkin-Style)  

---

## Szenario-Übersicht

| # | Kategorie | Szenario |
|---|-----------|----------|
| 01 | Upload | Erfolgreicher PDF-Upload (Text-basiert) |
| 02 | Upload | Erfolgreicher PDF-Upload (OCR-Fallback) |
| 03 | Upload | DOCX-Upload mit Formatting |
| 04 | Upload | Bild-Upload (PNG/JPG) mit OCR |
| 05 | Validation | Datei zu groß (>10MB) |
| 06 | Validation | Ungültiger Dateityp |
| 07 | Validation | Zu viele Seiten (>20) |
| 08 | Extraction | Vollständige Extraktion aller Felder |
| 09 | Extraction | Partielle Extraktion (nur Pflichtfelder) |
| 10 | Mapping | Ambiguous Label Mapping (Ethnicity → canton) |
| 11 | Mapping | Multi-Value Fields (mehrere Telefonnummern) |
| 12 | Mapping | Experience Array Extraktion |
| 13 | Mapping | Education Array Extraktion |
| 14 | Mapping | Skills Extraktion und Matching |
| 15 | Mapping | Languages mit Level-Erkennung |
| 16 | UI | User Override Mapping |
| 17 | UI | Unmapped Item ignorieren |
| 18 | UI | Abbruch vor Übernahme |
| 19 | Integration | Daten in bestehendes Form übernehmen |
| 20 | Integration | Final Confirm schreibt Candidate |
| 21 | Error | Keine Daten im CV gefunden |
| 22 | Error | Netzwerkfehler während Extraktion |
| 23 | Security | PII wird nicht geloggt |

---

## Szenario 01: Erfolgreicher PDF-Upload (Text-basiert)

```gherkin
Feature: CV Upload - Text PDF

Scenario: User lädt ein text-basiertes PDF hoch
  Given der User ist auf "/dashboard/candidates/new"
  And das Candidate-Form ist leer
  When der User auf "Mit CV Felder automatisiert ausfüllen" klickt
  And der User eine PDF-Datei (text-basiert, 2 Seiten, 500KB) auswählt
  Then wird ein Loading-State "CV wird analysiert..." angezeigt
  And nach max. 5 Sekunden erscheint der Mapping Report
  And die Extraktion nutzt die Methode "text" (nicht OCR)
  And mindestens "firstName" und "lastName" sind in "filledFields"
```

---

## Szenario 02: Erfolgreicher PDF-Upload (OCR-Fallback)

```gherkin
Feature: CV Upload - Scanned PDF

Scenario: User lädt ein gescanntes PDF hoch
  Given der User ist auf "/dashboard/candidates/new"
  And das Candidate-Form ist leer
  When der User auf "Mit CV Felder automatisiert ausfüllen" klickt
  And der User eine PDF-Datei (gescannt, keine selektierbaren Texte) auswählt
  Then wird ein Loading-State "CV wird analysiert..." angezeigt
  And das System erkennt automatisch, dass OCR benötigt wird
  And nach max. 15 Sekunden erscheint der Mapping Report
  And metadata.extractionMethod ist "ocr"
  And mindestens ein Feld ist in "filledFields" oder "ambiguousFields"
```

---

## Szenario 03: DOCX-Upload mit Formatting

```gherkin
Feature: CV Upload - DOCX

Scenario: User lädt ein Word-Dokument hoch
  Given der User ist auf "/dashboard/candidates/new"
  When der User eine DOCX-Datei mit Tabellen und Formatierung hochlädt
  Then werden die Texte aus allen Abschnitten extrahiert
  And Tabellen-Inhalte werden korrekt als Zeilen/Spalten interpretiert
  And der Mapping Report enthält strukturierte Daten
```

---

## Szenario 04: Bild-Upload (PNG/JPG) mit OCR

```gherkin
Feature: CV Upload - Image

Scenario: User lädt ein Bild eines CVs hoch
  Given der User ist auf "/dashboard/candidates/new"
  When der User eine PNG-Datei (Foto eines gedruckten CVs) hochlädt
  Then wird OCR automatisch verwendet
  And der Mapping Report wird nach max. 15 Sekunden angezeigt
  And extrahierte Felder haben tendenziell niedrigere Confidence-Werte
```

---

## Szenario 05: Datei zu groß (>10MB)

```gherkin
Feature: CV Upload - Validation

Scenario: User versucht eine zu große Datei hochzuladen
  Given der User ist auf "/dashboard/candidates/new"
  When der User eine Datei mit 15MB auswählt
  Then wird der Upload sofort blockiert
  And eine Fehlermeldung "Datei ist zu groß. Maximum: 10 MB" erscheint
  And der Mapping Report wird NICHT angezeigt
  And das Form bleibt unverändert
```

---

## Szenario 06: Ungültiger Dateityp

```gherkin
Feature: CV Upload - Validation

Scenario: User versucht eine EXE-Datei hochzuladen
  Given der User ist auf "/dashboard/candidates/new"
  When der User eine Datei "malware.exe" auswählt
  Then wird der Upload blockiert
  And eine Fehlermeldung "Nur PDF, PNG, JPG oder DOCX erlaubt" erscheint
  And keine Server-Anfrage wird gesendet
```

---

## Szenario 07: Zu viele Seiten (>20)

```gherkin
Feature: CV Upload - Validation

Scenario: User lädt ein PDF mit 30 Seiten hoch
  Given der User ist auf "/dashboard/candidates/new"
  When der User eine PDF-Datei mit 30 Seiten hochlädt
  Then wird nach der Seitenzahl-Prüfung eine Fehlermeldung angezeigt
  And die Meldung lautet "Zu viele Seiten. Maximum: 20"
  And die Extraktion wird abgebrochen
```

---

## Szenario 08: Vollständige Extraktion aller Felder

```gherkin
Feature: CV Extraction - Complete

Scenario: CV enthält alle relevanten Informationen
  Given der User lädt ein vollständiges CV hoch mit:
    | Feld | Wert |
    | Name | Max Mustermann |
    | Email | max@example.com |
    | Telefon | +41 79 123 45 67 |
    | LinkedIn | linkedin.com/in/maxmustermann |
    | Adresse | Bahnhofstrasse 1, 8001 Zürich |
    | Erfahrung | 5 Jahre |
    | Skills | Java, Python, SQL |
    | Sprachen | Deutsch (Muttersprache), Englisch (C1) |
    | Ausbildung | BSc Informatik, ETH Zürich, 2015-2019 |
    | Berufserfahrung | Software Engineer, Google, 2019-heute |
  When die Extraktion abgeschlossen ist
  Then enthält der Mapping Report:
    | Kategorie | Anzahl |
    | filledFields | >= 10 |
    | ambiguousFields | 0-2 |
    | unmappedItems | 0-3 |
  And alle Pflichtfelder (firstName, lastName) haben confidence "high"
```

---

## Szenario 09: Partielle Extraktion (nur Pflichtfelder)

```gherkin
Feature: CV Extraction - Minimal

Scenario: CV enthält nur minimale Informationen
  Given der User lädt ein minimalistisches CV hoch mit nur:
    | Feld | Wert |
    | Name | Anna Beispiel |
  When die Extraktion abgeschlossen ist
  Then enthält filledFields mindestens firstName und lastName
  And alle anderen Felder bleiben leer oder in unmappedItems
  And der User kann trotzdem "Daten übernehmen" klicken
```

---

## Szenario 10: Ambiguous Label Mapping (Ethnicity → canton)

```gherkin
Feature: CV Extraction - Ambiguous

Scenario: CV enthält Label "Ethnicity: Swiss German"
  Given der User lädt ein CV hoch mit dem Text "Ethnicity: Swiss German"
  When die Extraktion abgeschlossen ist
  Then erscheint dieses Feld in "ambiguousFields"
  And suggestedTargets enthält:
    | targetField | confidence | reason |
    | canton | medium | "Label similarity" |
    | notes | low | "Fallback" |
  And der User sieht ein Dropdown zur Auswahl des Zielfeldes
```

---

## Szenario 11: Multi-Value Fields (mehrere Telefonnummern)

```gherkin
Feature: CV Extraction - Multi-Value

Scenario: CV enthält mehrere Telefonnummern
  Given der User lädt ein CV hoch mit:
    | Label | Wert |
    | Mobile | +41 79 111 22 33 |
    | Office | +41 44 444 55 66 |
    | WhatsApp | +41 79 111 22 33 |
  When die Extraktion abgeschlossen ist
  Then wird die erste Telefonnummer in "phone" gemappt (filledFields)
  And die weiteren Nummern erscheinen in "unmappedItems"
  And unmappedItems[].suggestedTargets enthält "phone" mit Hinweis "bereits befüllt"
```

---

## Szenario 12: Experience Array Extraktion

```gherkin
Feature: CV Extraction - Experience Array

Scenario: CV enthält mehrere Berufserfahrungen
  Given der User lädt ein CV hoch mit Berufserfahrungen:
    | Rolle | Firma | Von | Bis |
    | Senior Developer | Google | Jan 2022 | heute |
    | Developer | Microsoft | Mar 2019 | Dec 2021 |
    | Junior Developer | Startup AG | Sep 2017 | Feb 2019 |
  When die Extraktion abgeschlossen ist
  Then enthält filledFields ein Array experience[] mit 3 Einträgen
  And experience[0].current ist true
  And experience[0].endMonth und experience[0].endYear sind leer
  And experience[1].startMonth ist "03"
  And experience[1].startYear ist "2019"
  And experience[2].endMonth ist "02"
  And experience[2].endYear ist "2019"
```

---

## Szenario 13: Education Array Extraktion

```gherkin
Feature: CV Extraction - Education Array

Scenario: CV enthält mehrere Ausbildungen
  Given der User lädt ein CV hoch mit Ausbildungen:
    | Abschluss | Institution | Von | Bis |
    | MSc Computer Science | ETH Zürich | 2019 | 2021 |
    | BSc Informatik | Uni Bern | 2015 | 2019 |
  When die Extraktion abgeschlossen ist
  Then enthält filledFields ein Array education[] mit 2 Einträgen
  And education[0].degree ist "MSc Computer Science"
  And education[0].institution ist "ETH Zürich"
  And education[1].startYear ist "2015"
```

---

## Szenario 14: Skills Extraktion und Matching

```gherkin
Feature: CV Extraction - Skills

Scenario: CV enthält Skills die im System existieren
  Given im System existieren folgende Skills:
    | name |
    | Java |
    | Python |
    | JavaScript |
    | SQL |
  And der User lädt ein CV hoch mit Text "Skills: Java, Python, C++, Machine Learning"
  When die Extraktion abgeschlossen ist
  Then enthält filledFields.skills ["Java", "Python"]
  And "C++" und "Machine Learning" erscheinen in unmappedItems
  And unmappedItems[].suggestedTargets für "C++" enthält "skills" mit Hinweis "Skill nicht im System"
```

---

## Szenario 15: Languages mit Level-Erkennung

```gherkin
Feature: CV Extraction - Languages

Scenario: CV enthält Sprachen mit verschiedenen Level-Formaten
  Given der User lädt ein CV hoch mit:
    | Sprache | Level (im CV) |
    | German | Native |
    | English | Fluent (C1) |
    | French | Intermediate |
    | Spanish | A2 |
  When die Extraktion abgeschlossen ist
  Then enthält filledFields.languages:
    | language | level |
    | Deutsch | Muttersprache |
    | Englisch | C1 |
    | Französisch | B1 |
    | Spanisch | A2 |
  And die Sprachen werden auf WORLD_LANGUAGES gemappt
  And die Level werden auf LANGUAGE_LEVELS normalisiert
```

---

## Szenario 16: User Override Mapping

```gherkin
Feature: CV Mapping - User Override

Scenario: User ändert ein vorgeschlagenes Mapping
  Given der Mapping Report zeigt:
    | extractedLabel | extractedValue | suggestedTarget |
    | Nationality | Swiss | canton |
  When der User das Dropdown für dieses Feld öffnet
  And der User "Ignorieren" auswählt
  Then wird selectedTarget auf null gesetzt
  And das Feld wird NICHT in das Form übernommen
  When der User stattdessen "notes" auswählt
  Then wird selectedTarget auf "notes" gesetzt
  And beim "Daten übernehmen" wird der Wert in das Notes-Feld geschrieben
```

---

## Szenario 17: Unmapped Item ignorieren

```gherkin
Feature: CV Mapping - Ignore

Scenario: User ignoriert ein unmapped Item
  Given der Mapping Report enthält in unmappedItems:
    | extractedValue | suggestedTargets |
    | "Hobbies: Hiking, Skiing" | [notes] |
  When der User für dieses Item "Ignorieren" auswählt
  Then wird das Item ausgegraut dargestellt
  And beim "Daten übernehmen" wird dieses Item nicht ins Form übernommen
```

---

## Szenario 18: Abbruch vor Übernahme

```gherkin
Feature: CV Mapping - Cancel

Scenario: User bricht den Vorgang ab
  Given der Mapping Report wird angezeigt
  And einige Felder wurden bereits manuell angepasst
  When der User auf "Abbrechen" klickt
  Then wird ein Bestätigungsdialog angezeigt: "Änderungen verwerfen?"
  When der User bestätigt
  Then wird der Mapping Report geschlossen
  And das Candidate-Form bleibt im ursprünglichen Zustand (leer oder vorherige Daten)
  And keine Daten werden gespeichert
```

---

## Szenario 19: Daten in bestehendes Form übernehmen

```gherkin
Feature: CV Integration - Apply to Form

Scenario: User übernimmt extrahierte Daten ins Form
  Given der Mapping Report zeigt:
    | targetField | extractedValue |
    | firstName | Max |
    | lastName | Mustermann |
    | email | max@example.com |
    | experience[0].role | Software Engineer |
  When der User auf "Daten übernehmen" klickt
  Then wird der Mapping Report geschlossen
  And das Candidate-Form zeigt:
    | Feld | Wert |
    | Vorname | Max |
    | Nachname | Mustermann |
    | E-Mail | max@example.com |
  And die Experience-Sektion enthält einen Eintrag mit Rolle "Software Engineer"
  And der "Kandidat erstellen" Button ist weiterhin sichtbar (kein Auto-Save)
```

---

## Szenario 20: Final Confirm schreibt Candidate

```gherkin
Feature: CV Integration - Final Save

Scenario: User speichert den Kandidaten nach CV-Import
  Given der User hat Daten via CV-Upload ins Form übernommen
  And der User hat optional weitere manuelle Änderungen gemacht
  When der User auf "Kandidat erstellen" klickt
  Then wird die bestehende createCandidate Action aufgerufen
  And die Daten werden in die candidates Tabelle geschrieben
  And der User wird zu "/dashboard/candidates" weitergeleitet
  And eine Erfolgsmeldung "Kandidat erfolgreich erstellt" erscheint
```

---

## Szenario 21: Keine Daten im CV gefunden

```gherkin
Feature: CV Extraction - No Data

Scenario: CV ist leer oder unleserlich
  Given der User lädt ein leeres PDF hoch
  When die Extraktion abgeschlossen ist
  Then wird eine Meldung angezeigt: "Keine Kandidatendaten gefunden"
  And ein Button "Manuell fortfahren" ist verfügbar
  When der User darauf klickt
  Then wird der Mapping Report geschlossen
  And das Form bleibt leer
  And der User kann manuell Daten eingeben
```

---

## Szenario 22: Netzwerkfehler während Extraktion

```gherkin
Feature: CV Extraction - Network Error

Scenario: Verbindung bricht während Extraktion ab
  Given der User hat ein CV hochgeladen
  And der Loading-State wird angezeigt
  When ein Netzwerkfehler auftritt
  Then wird eine Fehlermeldung angezeigt: "Verbindungsfehler. Bitte erneut versuchen"
  And ein "Erneut versuchen" Button ist verfügbar
  When der User darauf klickt
  Then wird die Extraktion erneut gestartet
```

---

## Szenario 23: PII wird nicht geloggt

```gherkin
Feature: CV Security - PII

Scenario: Logs enthalten keine personenbezogenen Daten
  Given der User lädt ein CV hoch mit sensiblen Daten
  When die Extraktion durchgeführt wird
  Then enthalten die Server-Logs:
    | Erlaubt | Beispiel |
    | Anzahl Felder | "15 fields mapped" |
    | Dateimetadaten | "PDF, 2 pages, 450KB" |
    | Processing Zeit | "completed in 2.3s" |
  And die Server-Logs enthalten NICHT:
    | Verboten | Beispiel |
    | Namen | "Max Mustermann" |
    | Email | "max@example.com" |
    | Telefon | "+41 79 123 45 67" |
    | Adressen | "Bahnhofstrasse 1" |
  And alle extrahierten Werte sind im Log redaktiert als "[REDACTED]"
```

---

**END OF ACCEPTANCE CRITERIA**
