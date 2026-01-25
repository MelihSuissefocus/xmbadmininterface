# PROMPTING_RULES.md - Automatische Workflow-Regeln für AI-Assistenz

**Version:** 1.0  
**Gültig ab:** 25. Januar 2026  
**Abhängig von:** AGENTS.md (v1.2)

---

## 1. Default Interpretation Rules

1.1. **Jeder Prompt ist ein Change Request.** Es gibt keine "Informations-Prompts" ohne Implementierung, es sei denn explizit mit "Frage:" oder "Erkläre:" eingeleitet.

1.2. **Feature-Prompts implizieren vollständige Implementierung.** Ein Prompt wie "Füge Kategorie zu Candidates hinzu" bedeutet: Schema → Migration → Apply → Code → UI → ci:local grün.

1.3. **DB-Impact wird IMMER zuerst geprüft.** Vor jeder Code-Änderung: Mentale Prüfung, ob Datenmodell betroffen sein könnte (siehe Sektion 2).

1.4. **Kurze Prompts = maximale Automatisierung.** Je kürzer der Prompt, desto mehr Entscheidungen treffe ich eigenständig basierend auf diesen Regeln.

---

## 2. DB Impact Detection

### 2.1 Trigger-Keywords (automatische DB-Prüfung)

Wenn einer dieser Begriffe im Prompt vorkommt, prüfe Schema-Impact:

| Trigger | Typische DB-Änderung |
|---------|---------------------|
| "neues Feld", "neue Eigenschaft", "Attribut hinzufügen" | Neue Spalte in bestehender Tabelle |
| "neue Kategorie", "neuer Typ", "neuer Status" | Enum erweitern ODER neue Lookup-Tabelle |
| "neue Entität", "neue Tabelle", "neues Objekt" | Neue Tabelle mit Relations |
| "Beziehung", "verknüpfen", "zuordnen" | FK-Spalte ODER Junction-Table |
| "filtern nach", "sortieren nach" | Ggf. Index erforderlich |
| "Historie", "Verlauf", "Protokoll" | Neue Log-Tabelle ODER Audit-Erweiterung |
| "Berechtigung", "Permission", "Rolle" | Erweiterung `user_role` Enum ODER neue Tabelle |
| "Report", "Statistik", "Aggregation" | Ggf. Views ODER denormalisierte Spalten |
| "Pflichtfeld", "required", "NOT NULL" | Breaking Change → Phased Migration |
| "umbenennen", "refactoren" | Spalten-Rename → Breaking Change |
| "löschen", "entfernen" | Destruktive Änderung → explizite Bestätigung nötig |

### 2.2 Domain-Modelle (Repo-spezifische Terminologie)

| Begriff (DE) | Begriff (EN) | Tabelle | Primäre Enum(s) |
|--------------|--------------|---------|-----------------|
| Kandidat | Candidate | `candidates` | `candidate_status` |
| Stelle, Job | Job | `jobs` | `job_type`, `job_status` |
| Zuweisung | Assignment | `job_candidates` | `assignment_status` |
| Benutzer | User | `users` | `user_role` |
| Skill, Fähigkeit | Skill | `skills` | - |
| Organisation | Organization | `organizations` | `company_type` |
| E-Mail-Vorlage | Email Template | `email_templates` | - |
| System-Einstellung | System Setting | `system_settings` | - |
| Audit-Log | Audit Log | `audit_logs` | `audit_action` |
| Passwort-Reset-Token | Password Reset Token | `password_reset_tokens` | - |

### 2.3 Bestehende Enums

```typescript
job_type:         ["contract", "permanent"]
job_status:       ["draft", "published", "archived"]
candidate_status: ["new", "reviewed", "rejected", "placed"]
assignment_status:["proposed", "interviewing", "offered", "rejected", "placed"]
contract_billing: ["payroll", "company", "hybrid"]
company_type:     ["ag", "gmbh", "einzelunternehmen"]
user_role:        ["admin", "recruiter", "viewer"]
audit_action:     ["create", "update", "delete", "login", "logout", "password_reset"]
```

---

## 3. Mandatory Execution Steps for Features

**Reihenfolge ist NICHT verhandelbar:**

### 3.1 Impact Analysis
- Betroffene Tabellen identifizieren
- Betroffene Actions (`src/actions/`) identifizieren
- Betroffene UI-Komponenten (`src/components/`, `src/app/`) identifizieren
- Breaking Change? (NULL→NOT NULL, Spalten-Rename, Typ-Änderung)

### 3.2 Datenmodell-Entscheidung
- Entscheide: Neue Spalte vs. Neue Tabelle vs. Enum-Erweiterung vs. Lookup-Table
- Dokumentiere Entscheidung mit Begründung (siehe Sektion 6)

### 3.3 Drizzle Schema Update
- Datei: `src/db/schema.ts`
- Spalten/Tabellen hinzufügen
- Relations definieren falls nötig
- Type Exports prüfen/erweitern

### 3.4 Migration Generieren
```bash
npm run db:generate
# Alias für: npx drizzle-kit generate
```
- Generierte Migration in `drizzle/` prüfen
- Bei Breaking Changes: Backfill-SQL manuell einfügen

### 3.5 Migration Apply (via ci:local)
```bash
npm run ci:local
# Führt aus: npx tsx scripts/migrate-settings.ts
```
- Alternativ manuell: `npm run db:migrate`

### 3.6 Code Implementieren
- Actions in `src/actions/` anpassen (Validation, CRUD-Logik)
- Zod-Schemas aktualisieren
- Server Actions testen

### 3.7 UI Updaten
- Formulare in `src/components/` anpassen
- Tabellen/Listen in `src/app/dashboard/` anpassen
- Neue Seiten erstellen falls nötig

### 3.8 Quality Gate
```bash
npm run ci:local
```
**MUSS grün sein.** Enthält:
1. ESLint (`npm run lint`)
2. TypeScript Build (`npm run build`)
3. Migrations Apply (`npx tsx scripts/migrate-settings.ts`)
4. Schema Check (`npx drizzle-kit check`)

---

## 4. Output Contract

**Bei JEDEM Feature-Prompt MUSS mein finaler Output enthalten:**

### 4.1 Pflicht-Report-Format

```markdown
## ✅ Implementierung abgeschlossen: <Feature-Name>

### DB-Änderungen
- Tabelle(n): <Liste oder "Keine">
- Spalten: <Liste mit Typ>
- Constraints: <z.B. NOT NULL, UNIQUE, FK>
- Indizes: <Liste oder "Keine neuen">
- Enums: <Erweiterungen oder "Unverändert">

### Migration(s)
- `drizzle/<filename>.sql`

### Ausgeführte Commands
```bash
npm run db:generate   # ✅
npm run ci:local      # ✅
```

### Manuelle Verifikation
1. <Schritt 1>
2. <Schritt 2>
3. ...

### Offene Punkte (falls vorhanden)
- <TODO oder "Keine">
```

### 4.2 Minimal-Report (bei reinen Code-Änderungen ohne DB)

```markdown
## ✅ Implementierung abgeschlossen: <Feature-Name>

### DB-Änderungen
Keine.

### Ausgeführte Commands
```bash
npm run ci:local      # ✅
```

### Manuelle Verifikation
1. <Schritt>
```

---

## 5. Safe Defaults

5.1. **Additive Änderungen bevorzugen.**
- Neue Spalten: IMMER nullable ODER mit Default-Wert
- Neue Enums: Nur Werte hinzufügen, nie entfernen

5.2. **Destruktive Änderungen nur auf explizite Anweisung.**
- Spalten löschen: NUR wenn Prompt "lösche Spalte X" enthält
- Enum-Werte entfernen: NUR wenn Prompt dies explizit verlangt + Migrationsstrategie angegeben
- Tabellen löschen: NUR wenn Prompt "lösche Tabelle X" enthält

5.3. **Breaking Changes: Phased Migration.**
- NULL → NOT NULL: Backfill zuerst, Constraint danach
- Spalten-Rename: Neue Spalte + Backfill + Code-Migration + Alte Spalte löschen (4 Phasen)

5.4. **Backfills als separater Schritt.**
- Backfill-SQL in Migration nur wenn:
  a) Datenvolumen klein (< 10k Rows geschätzt) ODER
  b) Prompt explizit Backfill anfordert
- Bei großen Tabellen: Separate Migration + Hinweis an User

5.5. **Default-Werte bei neuen NOT NULL Spalten.**
- Immer `.default()` setzen
- Sinnvolle Defaults wählen (leerer String, 0, `new`, etc.)

---

## 6. Decision Rules for Categorization-like Features

### 6.1 Entscheidungsbaum

```
Ist die Kategorie...
├── Statisch & klein (< 10 Werte, ändert sich nie)?
│   └── → Enum (pgEnum in schema.ts)
│       Beispiel: job_type, candidate_status
│
├── Semi-statisch (< 50 Werte, Admin-änderbar)?
│   └── → Lookup-Tabelle mit FK
│       Beispiel: skills (bereits implementiert)
│
├── Dynamisch & groß (beliebig viele, User-generiert)?
│   └── → Lookup-Tabelle mit FK + CRUD UI
│
└── Multi-Select (mehrere Werte pro Entity)?
    └── → Junction-Table ODER jsonb Array
        Beispiel: job_candidates (Junction), skills in candidates (jsonb)
```

### 6.2 Dokumentationspflicht

Bei jeder Kategorisierungs-Entscheidung dokumentiere:

```markdown
### Datenmodell-Entscheidung: <Feature>
**Gewählt:** <Enum | Lookup-Table | Junction-Table | jsonb>
**Begründung:** <1-2 Sätze>
**Alternativen verworfen:** <warum nicht Option X>
```

### 6.3 Bestehende Patterns als Referenz

| Pattern | Beispiel im Repo | Wann verwenden |
|---------|------------------|----------------|
| Enum | `job_status`, `user_role` | Feste Werte, System-kontrolliert |
| Lookup-Table | `skills` | Verwaltbare Liste, Name als Display |
| Junction-Table | `job_candidates` | M:N Beziehung mit Metadaten |
| jsonb Array | `candidates.skills`, `candidates.languages` | Embedded Data, keine Referenzen nötig |

---

## 7. No Questions Unless Blocked

### 7.1 Entscheide selbstständig wenn:

- Eine Option klar sicherer/additiver ist
- Repo bereits ähnliches Pattern verwendet
- AGENTS.md eine Empfehlung gibt
- Default aus Sektion 5 oder 6 anwendbar ist

### 7.2 Frage NUR wenn:

- Zwei Designs gleich plausibel UND keine Repo-Präferenz erkennbar
- Destruktive Änderung impliziert aber nicht explizit angefordert
- Feature mehrere unabhängige Interpretationen zulässt
- Externe Abhängigkeit/Integration unklar

### 7.3 Format bei Nachfrage

```markdown
## ⚠️ Klärung benötigt

**Kontext:** <1 Satz>

**Optionen:**
A) <Option> – <Vor-/Nachteile>
B) <Option> – <Vor-/Nachteile>

**Meine Tendenz:** Option X, weil <Grund>.

Soll ich mit X fortfahren?
```

---

## 8. Quick Reference Commands

| Aktion | Command |
|--------|---------|
| Schema ändern | `src/db/schema.ts` editieren |
| Migration generieren | `npm run db:generate` |
| Migration apply (manuell) | `npm run db:migrate` |
| Schema sync (dev only) | `npm run db:push` |
| Schema validieren | `npx drizzle-kit check` |
| Alle Gates laufen | `npm run ci:local` |
| Dev Server | `npm run dev` |
| Production Build | `npm run build` |

---

## 9. Checkliste vor Abschluss

- [ ] Schema in `src/db/schema.ts` aktualisiert (falls DB-Änderung)
- [ ] Migration generiert mit `npm run db:generate` (falls DB-Änderung)
- [ ] Migration geprüft (SQL in `drizzle/` angeschaut)
- [ ] `npm run ci:local` grün
- [ ] Output Contract erfüllt (Sektion 4)
- [ ] Manuelle Verifikationsschritte dokumentiert

---

**END OF PROMPTING_RULES.MD**
