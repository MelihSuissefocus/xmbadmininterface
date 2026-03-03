# CV Generator

Generates branded PDF CVs from candidate data using `@react-pdf/renderer`.

## Architecture

```
POST /api/cv-generator
  │
  ├─ Auth (NextAuth session + role check)
  ├─ Zod validation
  ├─ Load candidate from DB (Drizzle)
  ├─ normalizeCandidateToCVData()  →  CVData
  ├─ renderToPdfBuffer()           →  Buffer
  ├─ Write to public/uploads/cvs/
  └─ Return { pdfUrl, createdAt, candidateId, variant }
```

### Key files

| File | Purpose |
|------|---------|
| `src/app/api/cv-generator/route.ts` | API route handler |
| `src/lib/cv/renderers/e3Inspired/CvPdf.tsx` | React-PDF document component |
| `src/lib/cv/renderers/e3Inspired/renderToPdfBuffer.ts` | Server-side render to Buffer |
| `src/lib/cv/renderers/e3Inspired/normalizeCandidateToCVData.ts` | DB Candidate → CVData mapper |
| `src/lib/cv/renderers/e3Inspired/types.ts` | CVData type definitions |

## Setup

No additional setup required beyond the existing project dependencies.

The renderer uses **Helvetica** (built-in PDF font), so no font files or network requests are needed.

```bash
npm install          # @react-pdf/renderer is already in package.json
npm run dev          # Start Next.js dev server
```

## API

### `POST /api/cv-generator`

**Auth:** Requires NextAuth session. Roles `admin`, `recruiter`, `viewer` are allowed.

**Request body:**

```json
{
  "candidateId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "variant": "customer"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `candidateId` | `string` (UUID) | Candidate ID from database |
| `variant` | `"customer" \| "internal"` | `customer` = external (no contact info), `internal` = with contact info |

**Response (200):**

```json
{
  "pdfUrl": "/uploads/cvs/a1b2c3d4-.../20260303-120000-customer.pdf",
  "createdAt": "2026-03-03T12:00:00.000Z",
  "candidateId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "variant": "customer"
}
```

**Error responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | Zod validation message | Invalid body (missing fields, bad UUID) |
| 401 | `Unauthorized` | No session |
| 403 | `Forbidden` | User inactive or unknown role |
| 404 | `Candidate not found` | No candidate with given ID |
| 500 | `PDF_RENDER_FAILED` | Renderer threw an error |

**cURL example:**

```bash
curl -X POST http://localhost:3000/api/cv-generator \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=<session-cookie>" \
  -d '{"candidateId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","variant":"customer"}'
```

### Side effects

- **File written** to `public/uploads/cvs/<candidateId>/<timestamp>-<variant>.pdf`
- **`brandedCvUrl` updated** on the candidate row (only for `variant: "customer"`)

## Storage

Generated PDFs are stored at `public/uploads/cvs/` on the local filesystem, consistent with the existing application upload pattern (`public/uploads/applications/`).

**Important for serverless deployments (Vercel, etc.):** The `public/` filesystem is ephemeral — files written at runtime do not persist across deployments or cold starts. For production use, consider migrating to:

- **Vercel Blob** (already referenced in `.project_spec.md` for CV uploads)
- **S3 / R2** or another object store

The API response returns a relative `pdfUrl` that can be served directly by Next.js in development. In production with external storage, the URL format would change to an absolute URL.

## Tests

```bash
# Run all CV generator tests
npx vitest run src/lib/cv/renderers/e3Inspired/__tests__/
npx vitest run src/app/api/cv-generator/__tests__/

# Run everything
npx vitest run
```

| Test file | Tests | What it covers |
|-----------|-------|----------------|
| `e3Inspired/__tests__/render.test.ts` | 5 | PDF render, content extraction, variant behavior |
| `e3Inspired/__tests__/normalizeCandidateToCVData.test.ts` | 6 | DB→CVData mapping, period labels, null handling |
| `cv-generator/__tests__/route.test.ts` | 7 | Auth (401), validation (400), role (403), not-found (404), success (200) |
