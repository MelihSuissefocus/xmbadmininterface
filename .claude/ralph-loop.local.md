---
active: true
iteration: 1
max_iterations: 80
completion_promise: "CV_AUTOFILL_COMPLETE"
started_at: "2026-01-25T15:15:09Z"
---

Read and strictly follow CLAUDE.md, AGENTS.md, PROMPTING_RULES.md, specs/cv_autofill_prd.md, specs/cv_autofill_acceptance.md, specs/cv_autofill_schema.json, and tasks/cv_autofill_task.md. Execute tasks/cv_autofill_task.md EXACTLY in order. Do not modify files outside the allowed paths defined in the task file. After EVERY step run: npm run ci:local. If it fails, fix and rerun until green; only then continue. All DB changes must be Drizzle schema + new migrations only; never edit old migrations. CV autofill must NEVER auto-save the final candidate: it produces a draft + mapping report with confidence + sources; any ambiguous/unmapped items must be shown in the UI with suggested target fields and allow the user to map them before final save. Stop only when ALL acceptance criteria are satisfied AND npm run ci:local is green. When finished, output exactly: CV_AUTOFILL_COMPLETE
