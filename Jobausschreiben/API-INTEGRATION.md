# Job Board API Integration Guide

This document explains how to connect the XMB Group website job board (`jobs.html`) to your admin panel backend so you can create, edit, and publish jobs from the admin panel.

---

## How it works right now

The job board in `js/jobs.js` has an `API_CONFIG` object at the top:

```javascript
const API_CONFIG = {
    baseUrl: '',        // empty = demo mode (uses hardcoded jobs)
    endpoints: {
        jobs: '/api/jobs',
        job: '/api/jobs/:id',
        apply: '/api/applications',
    },
    apiKey: ''
};
```

When `baseUrl` is empty, the board falls back to the built-in demo data. As soon as you set a `baseUrl`, it will fetch real data from your API instead.

---

## Step 1: Build these endpoints in your admin panel backend

Your admin panel API needs to expose **3 endpoints** that the website will call:

### `GET /api/jobs` — List all published jobs

Returns an array of published job objects.

**Response:**

```json
[
  {
    "id": "job-001",
    "referenceNumber": "XMB-2025-042",
    "title": "Core Banking Migration auf Cloud-Native Architektur",
    "role": "Senior Java Developer",
    "description": "Für ein führendes Schweizer Finanzinstitut...",
    "requirements": [
      { "text": "Mindestens 7 Jahre Erfahrung mit Java/Spring Boot", "type": "must" },
      { "text": "Kenntnisse in Kafka oder RabbitMQ", "type": "nice" }
    ],
    "location": "Zürich",
    "workMode": "hybrid",
    "workload": "80-100%",
    "type": "freelancer",
    "startDate": "2025-04-01",
    "endDate": "2025-12-31",
    "industry": "Finanzdienstleistungen",
    "skills": ["Java", "Spring Boot", "Kubernetes", "Docker"],
    "language": [
      { "lang": "Deutsch", "level": "C1" },
      { "lang": "Englisch", "level": "B2" }
    ],
    "published": true,
    "publishedAt": "2025-02-01",
    "contactPerson": "Melih Özkan"
  }
]
```

**Important:** Only return jobs where `published: true`. The filtering of unpublished/draft jobs should happen server-side.

### `GET /api/jobs/:id` — Get a single job

Returns one job object by its `id`. Used when someone opens a job detail page.

**Response:** Same shape as a single object from the array above.

**Error (404):**
```json
{ "error": "Job not found" }
```

### `POST /api/applications` — Receive an application

Receives a `multipart/form-data` request when someone submits the application form.

**Form fields sent:**

| Field | Type | Description |
|---|---|---|
| `jobId` | string | The job ID being applied to |
| `jobRef` | string | The reference number (e.g. XMB-2025-042) |
| `firstName` | string | Applicant first name |
| `lastName` | string | Applicant last name |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `street` | string | Street address |
| `zip` | string | Postal code |
| `city` | string | City |
| `country` | string | Country code (CH, DE, AT, etc.) |
| `nationality` | string | Nationality code |
| `permit` | string | Work permit type (B, C, G, L) — only if not Swiss |
| `rate` | string | Hourly rate expectation in CHF |
| `availability` | string | Available from date (YYYY-MM-DD) |
| `desiredWorkload` | string | Desired workload (e.g. "80-100%") |
| `preferredWorkMode` | string | onsite / hybrid / remote |
| `billing` | string | "payroll" or "firma" |
| `companyName` | string | Company name (if billing = firma) |
| `companyUid` | string | UID number (if billing = firma) |
| `cv` | file | CV as PDF (max 10 MB) |
| `references` | file[] | Work references as PDFs (multiple files, each max 10 MB) |
| `other` | file[] | Other documents (multiple files, each max 10 MB) |

**Success response:**
```json
{ "success": true, "message": "Bewerbung eingereicht." }
```

**Error response:**
```json
{ "success": false, "message": "Validation error details..." }
```

---

## Step 2: Enable CORS on your admin panel API

Since the website is hosted on a different domain than your admin panel, you need to allow cross-origin requests. Add these headers to your API responses:

```
Access-Control-Allow-Origin: https://xmb-group.ch
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key
```

If you use Express.js:

```javascript
const cors = require('cors');
app.use(cors({
    origin: 'https://xmb-group.ch',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-API-Key']
}));
```

---

## Step 3: Connect the website to your API

Open `js/jobs.js` and update the config at the top of the file:

```javascript
const API_CONFIG = {
    baseUrl: 'https://your-admin-panel.example.com',
    endpoints: {
        jobs: '/api/jobs',
        job: '/api/jobs/:id',
        apply: '/api/applications',
    },
    apiKey: 'your-api-key-here'   // optional, for extra security
};
```

That's it. The website will now:
- Load jobs from `GET https://your-admin-panel.example.com/api/jobs`
- Load job details from `GET https://your-admin-panel.example.com/api/jobs/{id}`
- Send applications to `POST https://your-admin-panel.example.com/api/applications`
- If the API is unreachable, it automatically falls back to the demo data

---

## Step 4: Build the admin panel CRUD

In your admin panel project, build a UI that manages jobs via your own database. The admin panel does NOT need to interact with the website code — it just needs to serve the API above.

### Minimum admin features needed

1. **Create Job** — Form with all the fields from the schema below
2. **Edit Job** — Same form, pre-filled with existing data
3. **Publish / Unpublish** — Toggle the `published` flag
4. **Delete Job** — Remove a job
5. **View Applications** — List incoming applications for each job

### Job schema for your database

```
id               string    primary key / UUID
referenceNumber  string    unique, e.g. "XMB-2025-042"
title            string    project title
role             string    role name, e.g. "Senior Java Developer"
description      text      project description
requirements     json      array of { text: string, type: "must" | "nice" }
location         string    e.g. "Zürich"
workMode         enum      "onsite" | "hybrid" | "remote"
workload         string    e.g. "80-100%"
type             enum      "freelancer" | "festanstellung"
startDate        date      project start
endDate          date      nullable (null for permanent positions)
industry         string    e.g. "Finanzdienstleistungen"
skills           json      array of strings
language         json      array of { lang: string, level: string }
published        boolean   default false
publishedAt      datetime  set when published = true
contactPerson    string    name of contact person
createdAt        datetime  auto
updatedAt        datetime  auto
```

### Application schema for your database

```
id                  string    primary key / UUID
jobId               string    foreign key to jobs
jobRef              string    reference number
firstName           string
lastName            string
email               string
phone               string
street              string
zip                 string
city                string
country             string
nationality         string
permit              string    nullable
rate                string
availability        date
desiredWorkload     string
preferredWorkMode   string    nullable
billing             string    "payroll" | "firma"
companyName         string    nullable
companyUid          string    nullable
cvPath              string    file storage path
referencePaths      json      array of file paths
otherPaths          json      array of file paths
createdAt           datetime  auto
```

---

## API Key Authentication (optional)

If you set an `apiKey` in the config, the website sends it as a header:

```
X-API-Key: your-api-key-here
```

In your backend, validate this on every request:

```javascript
function authenticateApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    if (key !== process.env.WEBSITE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.use('/api', authenticateApiKey);
```

**Note:** This API key is visible in the client-side JavaScript. It only prevents casual abuse — it is NOT a substitute for proper server-side authorization on write endpoints (like the admin CRUD). Your admin panel should use proper authentication (JWT, sessions, etc.) for creating/editing/deleting jobs.

---

## Quick Checklist

- [ ] Build `GET /api/jobs` (returns published jobs array)
- [ ] Build `GET /api/jobs/:id` (returns single job)
- [ ] Build `POST /api/applications` (receives multipart form data with files)
- [ ] Enable CORS for the website domain
- [ ] Set `baseUrl` in `js/jobs.js` to your API URL
- [ ] (Optional) Set API key in both config and backend
- [ ] Test: open `jobs.html` — should show jobs from your API
- [ ] Test: submit an application — should arrive in your admin panel
