# Ralph Run: CV Auto-Fill Implementation

## 🤖 Instruktion für Ralph (AI Agent)

> Diese Datei ist die offizielle Start-Instruktion für die automatisierte Ausführung des CV Auto-Fill Tasks.

---

## Vor dem Start

1. Lies vollständig: `tasks/cv_autofill_task.md`
2. Lies vollständig: `specs/cv_autofill_prd.md`
3. Prüfe: `test_fixtures/cv_samples/` existiert mit Samples
4. Prüfe: `npm run ci:local` ist aktuell grün

---

## Ausführungs-Regeln

```
EXECUTE task file `tasks/cv_autofill_task.md` in order.
RUN `npm run ci:local` after EACH task.
IF ci fails: FIX immediately, repeat until green.
DO NOT proceed to next task until current task is GREEN.
DO NOT skip any task.
STOP after Task 1.1 for initial review.
REPORT changelog after each task.
```

---

## Kontrollierter Start

### Phase 1: Nur Task 1.1

```
Führe NUR Task 1.1 aus.
Nach Abschluss: STOPP.
Report:
- Welche Dateien erstellt/geändert
- CI Status (grün/rot)
- Offene Fragen
```

### Phase 2+: Fortsetzung

Nach Review von Phase 1:
```
Setze fort mit Task 1.2.
Gleiches Vorgehen: CI nach Task, Stop bei Fail.
```

---

## Changelog Format

Nach jedem Task dieses Format nutzen:

```markdown
## Task X.Y Complete

**Dateien geändert:**
- `path/to/file.ts` – Beschreibung

**CI Status:** ✅ Grün / ❌ Rot (+ Error)

**Nächster Task:** X.Z (oder STOP für Review)
```

---

## Abbruch-Bedingungen

SOFORT STOPPEN wenn:
- [ ] CI 3x hintereinander fehlschlägt
- [ ] Änderung an BLACKLIST-Datei nötig wäre
- [ ] Unklarheit über Anforderung
- [ ] Neue Dependency benötigt würde
- [ ] Migration benötigt würde
- [ ] Änderung an `src/auth.ts`, `src/middleware.ts`, oder `src/db/schema.ts` nötig wäre

Bei Stopp: Report mit Grund und Frage an User.

---

## Quick Reference

| Command | Zweck |
|---------|-------|
| `npm run ci:local` | Lokale CI (Lint + Types + Tests) |
| `npm run lint` | Nur Linting |
| `npm run build` | Production Build |
| `npm run dev` | Dev Server starten |

---

## Pfad-Referenz

### ✅ Erlaubt (WHITELIST)
- `src/lib/cv-autofill/`
- `src/actions/cv-upload.ts`
- `src/actions/cv-extraction.ts`
- `src/components/candidates/cv-*.tsx`
- `src/lib/constants.ts`
- `test_fixtures/cv_samples/`

### 🚫 Verboten (BLACKLIST)
- `src/auth.ts`
- `src/middleware.ts`
- `src/db/schema.ts`
- `src/actions/auth.ts`
- `src/actions/password-reset.ts`
- `drizzle/`
- `.env*`
- `package.json`

---

## Wichtige Regeln

1. **Draft-Only:** CV Auto-Fill erzeugt NUR Vorschläge
2. **Kein Auto-Save:** Kandidat wird ERST nach User-Confirm gespeichert
3. **Form-State Only:** Extrahierte Daten befüllen das Form, NICHT die DB
4. **Test Fixtures:** Alle Tests nutzen `test_fixtures/cv_samples/`

---

**START:** Führe Task 1.1 aus und stoppe danach für Review.
