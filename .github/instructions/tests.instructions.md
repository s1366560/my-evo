---
applyTo: "{e2e-test.js,edge-case-test.js,integration-test.js,test-*.js,test-suites/**/*.js,frontend/tests/**}"
---

# Test scripts (Playwright at repo root)

These are **standalone Node scripts**, not a configured test runner. They use the root [package.json](../../package.json) which only declares `playwright` and `@axe-core/playwright`.

## Running
- Servers must be up first: `cd backend && npm run dev` (`:3001`) and `cd frontend && npm run dev` (`:3002`, or `npm start` for `:3000`).
- Then: `node e2e-test.js`, `node integration-test.js`, etc. There is no `npm test` aggregator at the root.

## Conventions in existing scripts
- Use `const { chromium } = require('playwright')` (CommonJS — these are `.js`, not TS).
- Test users: time-stamped emails (`e2e_${Date.now()}@test.com`) so re-runs don't collide with the SQLite `users.email` unique index.
- Output: write screenshots to `test-results/<suite>-screenshots/` and reports to `test-results/*.md`. The whole `test-results/` tree is git-ignored — fine to overwrite.
- Do not assume which port the frontend runs on: scripts hit `127.0.0.1:3000` (prod-style `next start`). Confirm with the user before changing.

## Don'ts
- Don't migrate these to TypeScript or Jest without coordination — they are run ad-hoc and from CI workflows in [.github/workflows/](../../.github/workflows/).
- Don't add a Playwright config file at the repo root (`playwright.config.ts`) — scripts launch the browser manually via `chromium.launch()`.
- Backend Jest tests live in `backend/src/__tests__/` and are governed by [backend.instructions.md](backend.instructions.md) — don't mix the two surfaces.
