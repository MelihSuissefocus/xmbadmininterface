# Settings Setup Guide

## Übersicht

Die `/settings` Seite wurde umfassend erweitert mit folgenden Features:

### ✅ Neue Funktionalitäten

1. **Benutzerverwaltung**
   - Neue Benutzer hinzufügen
   - Benutzer aktivieren/deaktivieren
   - Passwort zurücksetzen
   - Benutzer löschen
   - Rollen verwalten (Admin, Recruiter, Viewer)

2. **Skills Management**
   - Skills hinzufügen und löschen
   - Bereits vorhanden, jetzt im Tab-Interface integriert

3. **Unternehmenseinstellungen**
   - Firmeninformationen verwalten
   - Kontaktdaten pflegen
   - Adresse hinterlegen
   - Branding-Farben konfigurieren

4. **Systemeinstellungen**
   - Key-Value Einstellungen für globale Konfiguration
   - Kategorisierte Einstellungen (Allgemein, E-Mail, Sicherheit, etc.)
   - Einfache Verwaltung über UI

5. **E-Mail-Vorlagen**
   - E-Mail-Vorlagen erstellen und bearbeiten
   - Vorlagen aktivieren/deaktivieren
   - Betreff und Nachrichteninhalt verwalten

6. **Audit Logs**
   - Protokollierung aller wichtigen Aktionen
   - Benutzer-Tracking
   - IP-Adresse und User-Agent Speicherung
   - Übersicht der letzten 50 Aktivitäten

7. **Passwort-Reset-Funktion**
   - Öffentliche Seite für "Passwort vergessen" (`/forgot-password`)
   - Token-basierter Passwort-Reset (`/reset-password`)
   - Automatische Token-Validierung und Ablauf

## Datenbank-Migration

### Neue Tabellen

Die folgenden Tabellen wurden hinzugefügt:

- `password_reset_tokens` - Tokens für Passwort-Reset
- `email_templates` - E-Mail-Vorlagen
- `system_settings` - Globale Systemeinstellungen
- `organizations` - Unternehmenseinstellungen
- `audit_logs` - Audit-Protokolle

### Migration ausführen

```bash
# 1. Migrationen anwenden
npx drizzle-kit push

# ODER bei Bedarf neu generieren (falls Änderungen am Schema)
npx drizzle-kit generate
npx drizzle-kit push
```

**Wichtig:** Die Migration-Datei `0003_add_settings_tables.sql` wurde bereits erstellt und muss ausgeführt werden.

## Neue Server Actions

Folgende Server Actions wurden hinzugefügt:

- `src/actions/password-reset.ts` - Passwort-Reset-Logik
- `src/actions/email-templates.ts` - E-Mail-Vorlagen CRUD
- `src/actions/system-settings.ts` - Systemeinstellungen CRUD
- `src/actions/organizations.ts` - Unternehmenseinstellungen CRUD
- `src/actions/audit-logs.ts` - Audit-Log Funktionen

## Neue UI-Komponenten

Die folgenden shadcn/ui Komponenten wurden hinzugefügt:

- `components/ui/tabs.tsx` - Tab-Navigation
- `components/ui/dialog.tsx` - Modal-Dialoge
- `components/ui/select.tsx` - Dropdown-Auswahl
- `components/ui/textarea.tsx` - Mehrzeilige Texteingabe

## Settings-Komponenten

Neue spezielle Komponenten für die Settings-Seite:

- `components/settings/user-management.tsx`
- `components/settings/organization-settings.tsx`
- `components/settings/system-settings-panel.tsx`
- `components/settings/email-templates-panel.tsx`
- `components/settings/audit-logs-panel.tsx`

## Öffentliche Seiten

Neue öffentlich zugängliche Seiten:

- `/forgot-password` - Passwort-Reset anfragen
- `/reset-password?token=...` - Neues Passwort setzen

Diese Seiten sind in der `middleware.ts` als öffentlich konfiguriert.

## Verwendung

1. **Migrationen ausführen** (siehe oben)
2. **Development Server starten:**
   ```bash
   npm run dev
   ```
3. **Zur Settings-Seite navigieren:** `/dashboard/settings`

## Tab-Übersicht

Die Settings-Seite ist in 6 Tabs organisiert:

1. **Benutzer** - Benutzerverwaltung
2. **Skills** - Skills-Verwaltung
3. **Unternehmen** - Unternehmenseinstellungen
4. **System** - Systemeinstellungen
5. **E-Mail-Vorlagen** - E-Mail-Vorlagen verwalten
6. **Audit Logs** - Aktivitätsprotokolle

## Weitere Features

### Passwort-Reset-Flow

1. Benutzer klickt auf "Passwort vergessen?" auf der Login-Seite
2. Gibt E-Mail-Adresse ein
3. Token wird generiert und kann dem Benutzer gesendet werden
4. Benutzer öffnet `/reset-password?token=...`
5. Setzt neues Passwort

### Audit Logging

Um Audit-Logs zu erstellen, verwende die Funktion `createAuditLog`:

```typescript
import { createAuditLog } from "@/actions/audit-logs";

await createAuditLog({
  userId: session.user.id,
  action: "create",
  entity: "job",
  entityId: newJob.id,
  details: { title: newJob.title },
  ipAddress: req.headers.get("x-forwarded-for"),
  userAgent: req.headers.get("user-agent"),
});
```

## Nächste Schritte

- [ ] E-Mail-Versand implementieren (für Passwort-Reset)
- [ ] Weitere Systemeinstellungen definieren
- [ ] E-Mail-Vorlagen mit Variablen erweitern
- [ ] Audit-Logs Filter und Suche hinzufügen
- [ ] Unternehmens-Logo Upload implementieren

## Support

Bei Fragen oder Problemen, bitte die Dokumentation im Code-Repository konsultieren.

