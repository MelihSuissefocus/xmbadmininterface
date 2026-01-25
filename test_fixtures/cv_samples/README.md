# CV Test Samples

Dieses Verzeichnis enthält anonymisierte Test-CVs für die CV Auto-Fill Funktion.

## ⚠️ Wichtig: Keine echten Personendaten!

Alle Dateien hier enthalten **ausschließlich fiktive Testdaten**.
Keine echten Namen, Adressen, Telefonnummern oder andere PII.

## Dateien

| Datei | Beschreibung | Erwartete Extraktion |
|-------|--------------|---------------------|
| `sample_cv_german.txt` | Deutscher Lebenslauf, vollständig | Name, Email, Phone, Adresse, Erfahrung, Ausbildung |
| `sample_cv_english.txt` | English Resume, Standard-Format | Name, Email, Phone, Experience, Education |
| `sample_cv_minimal.txt` | Minimaler CV | Nur Name + Email |

## Verwendung in Tests

### TypeScript Tests

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'test_fixtures', 'cv_samples');

describe('CV Parser', () => {
  it('should parse German CV', () => {
    const content = readFileSync(
      join(FIXTURES_DIR, 'sample_cv_german.txt'),
      'utf-8'
    );
    const result = parseCV(content);
    
    expect(result.name).toBe('Max Mustermann');
    expect(result.email).toBe('max.mustermann@example.com');
    expect(result.phone).toBe('+49 123 4567890');
  });

  it('should parse English CV', () => {
    const content = readFileSync(
      join(FIXTURES_DIR, 'sample_cv_english.txt'),
      'utf-8'
    );
    const result = parseCV(content);
    
    expect(result.name).toBe('Jane Doe');
    expect(result.email).toBe('jane.doe@example.com');
  });

  it('should handle minimal CV', () => {
    const content = readFileSync(
      join(FIXTURES_DIR, 'sample_cv_minimal.txt'),
      'utf-8'
    );
    const result = parseCV(content);
    
    expect(result.name).toBe('Erika Musterfrau');
    expect(result.email).toBe('erika.musterfrau@example.com');
    expect(result.phone).toBeUndefined();
  });
});
```

## Erwartete Extraktions-Ergebnisse

### sample_cv_german.txt

```json
{
  "name": "Max Mustermann",
  "email": "max.mustermann@example.com",
  "phone": "+49 123 4567890",
  "address": {
    "street": "Musterstraße 123",
    "postalCode": "12345",
    "city": "Musterstadt"
  },
  "experiences": [
    {
      "title": "Senior Entwickler",
      "company": "Beispiel GmbH",
      "from": "2020",
      "to": "heute"
    },
    {
      "title": "Entwickler",
      "company": "Test AG",
      "from": "2017",
      "to": "2020"
    }
  ],
  "education": [
    {
      "degree": "B.Sc. Informatik",
      "institution": "Muster-Universität",
      "from": "2013",
      "to": "2017"
    }
  ],
  "skills": ["Python", "TypeScript", "SQL", "FastAPI", "React", "Next.js"],
  "languages": [
    { "language": "Deutsch", "level": "Muttersprache" },
    { "language": "Englisch", "level": "fließend" }
  ]
}
```

### sample_cv_english.txt

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "phone": "+1 555 123 4567",
  "experiences": [
    {
      "title": "Software Engineer",
      "company": "Example Corp",
      "from": "2019",
      "to": "Present"
    },
    {
      "title": "Junior Developer",
      "company": "Startup Inc",
      "from": "2017",
      "to": "2019"
    }
  ],
  "education": [
    {
      "degree": "B.S. Computer Science",
      "institution": "Example University",
      "year": "2017"
    }
  ],
  "skills": ["JavaScript", "Python", "Go", "Git", "Docker", "Kubernetes"]
}
```

### sample_cv_minimal.txt

```json
{
  "name": "Erika Musterfrau",
  "email": "erika.musterfrau@example.com",
  "yearsOfExperience": 5
}
```

## Akzeptanzkriterien-Referenz

Diese Samples werden referenziert in:
- `specs/cv_autofill_prd.md` - Akzeptanzkriterien
- `tasks/cv_autofill_task.md` - Task 7.1 und 7.2 (Tests)

## Hinzufügen neuer Samples

1. Erstelle neue `.txt` Datei mit fiktiven Daten
2. Dokumentiere erwartete Extraktion in dieser README
3. Füge entsprechende Tests hinzu
