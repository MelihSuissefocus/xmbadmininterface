# CV Extraction System v2.0

## Overview

This document describes the CV auto-fill feature powered by **Azure AI Document Intelligence**. The system extracts structured data from uploaded CV documents (PDF, DOCX, PNG, JPG) and maps them to candidate form fields.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ CV Upload    │───▶│ Server       │───▶│ CV Mapping Modal     │   │
│  │ Button       │    │ Actions      │    │ (Review & Confirm)   │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Server Actions                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ uploadCV     │───▶│ createCv     │───▶│ processCvAnalysisJob │   │
│  │ (validate)   │    │ AnalysisJob  │    │ (async worker)       │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Azure Document Intelligence                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ prebuilt-    │───▶│ Extract      │───▶│ Return DocumentRep   │   │
│  │ layout       │    │ Key-Values,  │    │ (normalized data)    │   │
│  │ model        │    │ Tables, Text │    │                      │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Environment Variables

Add these to your `.env.local`:

```env
# Azure Document Intelligence Configuration
AZURE_DI_ENDPOINT=https://documentai-xmb.cognitiveservices.azure.com/
AZURE_DI_KEY=<your-api-key>
```

**Note:** Use `key1` or `key2` from your Azure resource for `AZURE_DI_KEY`.

## Features

### Azure Document Intelligence Integration

- **Model:** `prebuilt-layout`
- **Features enabled:**
  - `keyValuePairs` - Extracts labeled key-value pairs from documents
  - `languages` - Detects document languages (DE/EN supported)
- **Timeout:** 120 seconds
- **Max file size:** 10MB
- **Max pages:** 20

### Asynchronous Processing

The system uses a job-based architecture:

1. Client uploads file → Job created in `pending` state
2. Server processes asynchronously → Job moves to `processing`
3. Client polls for status until `completed` or `failed`
4. Results returned with evidence for each extracted field

### Security Features

1. **Authentication Required**
   - All CV analysis endpoints require an authenticated session
   - Only users with `admin` or `recruiter` roles can analyze CVs

2. **Magic Byte Validation**
   - File content is validated against magic bytes before processing
   - Prevents file type spoofing attacks

3. **Filename Sanitization**
   - Filenames are sanitized to prevent path traversal
   - Special characters are replaced with underscores

4. **Rate Limiting**
   - CV analysis: 10 requests per minute per user
   - CV upload: 20 requests per minute per user

5. **No File Storage**
   - Original CV files are **NOT** stored
   - Files are processed in memory only
   - Only extracted metadata is persisted

6. **PII Redaction in Logs**
   - Error messages are redacted to remove:
     - Email addresses
     - Phone numbers
     - Credit card numbers
     - Social security numbers (SSN)
     - Swiss AHV numbers

### Evidence Tracking

Every extracted field includes evidence:

```typescript
interface FieldEvidence {
  page: number;           // Page number where found
  polygon?: Polygon;      // Bounding polygon coordinates
  boundingBox?: BoundingBox;
  exactText: string;      // Original text as extracted
  confidence: number;     // 0-1 confidence score
}
```

### Extracted Fields

The system attempts to extract:

| Field | Confidence | Source |
|-------|-----------|--------|
| firstName | high | Key-value pairs, first page name detection |
| lastName | high | Key-value pairs, first page name detection |
| email | high | Regex pattern matching |
| phone | high | Regex pattern matching (Swiss/international) |
| street | medium | Key-value pairs |
| postalCode | high | Key-value pairs, Swiss postal code pattern |
| city | high | Key-value pairs |
| canton | high | Key-value pairs |
| linkedinUrl | high | URL pattern matching |
| targetRole | medium | Key-value pairs |

## Database Schema

### cv_analysis_jobs Table

```sql
CREATE TABLE cv_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status cv_analysis_status NOT NULL DEFAULT 'pending',
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

Status enum: `pending`, `processing`, `completed`, `failed`

## API Reference

### Server Actions

#### `createCvAnalysisJob`

Creates a new CV analysis job.

```typescript
async function createCvAnalysisJob(
  base64: string,      // Base64-encoded file content
  fileName: string,    // Original filename
  fileExtension: string, // File extension (pdf, docx, png, jpg)
  fileSize: number     // File size in bytes
): Promise<ActionResult<{ jobId: string }>>
```

#### `getCvAnalysisJobStatus`

Gets the status and result of an analysis job.

```typescript
async function getCvAnalysisJobStatus(
  jobId: string
): Promise<ActionResult<JobStatusResult>>
```

#### `getLatestCvAnalysisJobs`

Lists recent analysis jobs for the current user.

```typescript
async function getLatestCvAnalysisJobs(
  limit?: number // Default: 5
): Promise<ActionResult<JobStatusResult[]>>
```

## Limitations

1. **Scanned PDFs:** While Azure DI handles OCR, very low-quality scans may produce poor results
2. **Non-standard CV formats:** Highly creative CV layouts may not extract well
3. **Languages:** Optimized for German (DE) and English (EN) documents
4. **Complex tables:** Nested or merged cells may not extract perfectly
5. **Handwritten content:** Not supported

## Error Handling

| Error Code | Description | Retryable |
|------------|-------------|-----------|
| FILE_TOO_LARGE | File exceeds 10MB limit | No |
| INVALID_FILE_TYPE | Unsupported file format | No |
| TOO_MANY_PAGES | Document exceeds 20 pages | No |
| TIMEOUT | Analysis took too long | Yes |
| RATE_LIMITED | Too many requests | Yes |
| AUTH_FAILED | Invalid Azure credentials | No |
| ANALYSIS_FAILED | General analysis error | Yes |

## Migration from v1.0

The previous system used `pdf2json` and `tesseract.js` for extraction. To migrate:

1. Add Azure DI environment variables
2. Run `npm install` to install `@azure/ai-form-recognizer`
3. Generate database migration: `npm run db:generate`
4. Push migration: `npm run db:push`

The old extraction code is deprecated but can be re-enabled via feature flag if needed.

## Placeholders

### AV Scan Hook

```typescript
// TODO: Implement antivirus scan hook
// Location: src/lib/file-validation.ts
// 
// async function scanForMalware(bytes: Uint8Array): Promise<boolean> {
//   // Integrate with ClamAV or similar service
//   return true; // Safe
// }
```

## Monitoring

### Recommended Metrics

- Analysis job duration (p50, p95, p99)
- Success/failure rate by file type
- Rate limit hits per user
- Azure DI API latency

### Log Format

All logs follow structured format with PII redaction:

```
[CV-ANALYSIS] job_id=xxx status=completed duration_ms=1234 pages=2
```

## Support

For issues with CV extraction:

1. Check Azure DI service status
2. Verify environment variables are set
3. Check rate limits haven't been exceeded
4. Review job error message in database

