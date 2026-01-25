# XMB Admin Portal

Admin Portal für XMB Group - gebaut mit Next.js 16, Drizzle ORM, und Neon PostgreSQL.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Sprache:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Radix UI)
- **Datenbank:** PostgreSQL (Neon Serverless)
- **ORM:** Drizzle ORM
- **Auth:** Auth.js v5 (NextAuth)

## Lokale Entwicklung

### Voraussetzungen

- Node.js 20+
- npm oder pnpm
- Neon PostgreSQL Datenbank

### Setup

1. **Dependencies installieren:**

```bash
npm install
```

2. **Umgebungsvariablen konfigurieren:**

Erstelle eine `.env.local` Datei:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# Auth.js (NextAuth v5) - generiere mit: openssl rand -base64 32
AUTH_SECRET="your-secret-key"
```

3. **Datenbank-Migrationen ausführen:**

```bash
npm run db:push
```

4. **Entwicklungsserver starten:**

```bash
npm run dev
```

## Vercel Deployment

### Wichtig: Root Directory

Bei Vercel muss das **Root Directory** auf `admin-xmb` gesetzt werden, da sich das Projekt in einem Unterordner befindet.

### Umgebungsvariablen in Vercel

Füge folgende Environment Variables in den Vercel Project Settings hinzu:

| Variable | Beschreibung |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL Connection String |
| `AUTH_SECRET` | Auth.js Secret (min. 32 Zeichen) |

### Deployment Steps

1. Repository mit Vercel verbinden
2. **Root Directory:** `admin-xmb` setzen
3. **Framework Preset:** Next.js (automatisch erkannt)
4. Environment Variables konfigurieren
5. Deploy

### Nach dem ersten Deployment

Datenbank-Schema initialisieren:

```bash
npx drizzle-kit push
```

Oder im Vercel Dashboard unter "Functions" → "Terminal":

```bash
npm run db:push
```

## Datenbank

### Schema generieren

```bash
npm run db:generate
```

### Schema pushen

```bash
npm run db:push
```

## Scripts

| Script | Beschreibung |
|--------|-------------|
| `npm run dev` | Startet den Entwicklungsserver |
| `npm run build` | Erstellt den Production Build |
| `npm run start` | Startet den Production Server |
| `npm run lint` | Führt ESLint aus |
| `npm run db:generate` | Generiert Drizzle Migrationen |
| `npm run db:push` | Pusht Schema zur Datenbank |

## Projektstruktur

```
src/
├── actions/       # Server Actions
├── app/           # App Router Pages
├── components/    # React Components
│   └── ui/        # shadcn/ui Components
├── db/            # Drizzle Schema & Connection
└── lib/           # Utilities & Constants
```
