---
active: true
iteration: 402
max_iterations: 0
completion_promise: null
started_at: "2026-01-25T16:52:31Z"
---

GOAL: Fix CV upload/extraction so it works in the REAL frontend flow (no SSR/runtime warnings/errors) and then prove it end-to-end by programmatically uploading , running the extraction + mapping flow, and creating a real candidate using ONLY existing system endpoints/actions.

YOU MUST REPRODUCE THE EXACT FAILURE I SEE IN FRONTEND/SSR:
- Warning: Cannot load '@napi-rs/canvas'
- Warning: Cannot polyfill Path2D
- Error: Setting up fake worker failed: missing pdf.worker.mjs
- CV extraction error: Failed to extract text from PDF

READ & OBEY FIRST: CLAUDE.md, AGENTS.md, PROMPTING_RULES.md, specs/cv_autofill_prd.md, specs/cv_autofill_acceptance.md, specs/cv_autofill_schema.json, tasks/cv_autofill_task.md.

HARD CONSTRAINTS:
- Keep draft-only workflow: NEVER auto-save final candidate from CV; user confirmation/apply-to-form is required; final persist uses existing create flow.
- Only modify files within allowed paths in tasks/cv_autofill_task.md (plus a single smoke-test script under adminportalxmb/testing/ or scripts/ if that path is allowed by the task file).
- After every meaningful change run: npm run ci:local (must be green at the end).
- DB: Drizzle schema + new migrations only; never edit old migrations.

MANDATORY TECHNICAL FIX (stop using the pdfjs worker/canvas path):
1) Identify the exact extractor code path used by the frontend CV upload route/handler.
2) REMOVE any dependency/path that pulls in pdfjs-dist legacy worker or canvas polyfills at runtime (this is what causes the pdf.worker.mjs + DOMMatrix/Path2D issues on Vercel/SSR).
3) Implement a Node-safe PDF TEXT extraction that does NOT require workers or canvas:
   - Prefer  as the primary PDF text extractor (pure JS, no pdf.worker, no DOMMatrix/Path2D).
   - Keep OCR only as fallback (for scanned PDFs) and ensure OCR is separate from PDF text extraction.
4) Ensure the CV extraction route/handler runs in Node runtime (not Edge): set runtime = 'nodejs' where applicable.
5) The mapping/normalization and UI modal must continue to work unchanged; only the extracted_text source becomes real and file-dependent.

END-TO-END PROOF (must be automated and real):
Create ONE smoke script (allowed path) that runs in production mode and performs the full system flow:
A) Build + start the app in production mode (the same conditions that generate /var/task SSR behavior):
   - npm run build
   - start server (child process) on a port
B) Upload  through the SAME API endpoint the UI uses (multipart/form-data).
C) Confirm extraction succeeds (non-empty extracted text; real name/email/phone present).
D) Use ONLY existing system endpoints/actions to apply mappings / create the candidate (simulate the user flow):
   - Apply extracted draft to the candidate form payload
   - Call the existing 'create candidate' endpoint/action (the same one used by /dashboard/candidates/new submit)
E) Verify candidate creation succeeded (e.g., response contains candidate id OR a subsequent read/list confirms it).
F) Tear down server process cleanly.
The smoke script must FAIL with non-zero exit if any step fails.

STOP CONDITIONS (must all be true):
- Uploading a real PDF from the frontend flow no longer throws the worker/canvas/DOMMatrix/Path2D errors.
- Extraction works for  via the real API route (non-empty; file-dependent).
- Candidate is actually created via the system create flow (proof by id/readback).
- npm run ci:local is green.
- Output exactly: CV_FRONTEND_END2END_FIXED

--max-iterations 80 --completion-promise "CV_FRONTEND_END2END_FIXED"
