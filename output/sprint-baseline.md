# My-Evo Sprint Baseline (feature-001-1a11398b17ae / node-1a11398b17ae)

Worktree: `/workspace/.memstack/worktrees/37874c3d-48b3-40d6-9c6a-a5dcf2c0b24f` · branch `workspace/node-1a11398b17ae-37874c3d-48b` · HEAD `f6ba095` · phase: `research`. Reference for the next implementer (per the feature-checkpoint: `src/app.ts`, `src/index.ts`, `src/session/management.ts`).

## 1. Repository shape (evidence)

- Root `package.json` (`evomap-hub`, v1.0.0): Fastify 5 + Prisma 6 + Neo4j driver + BullMQ/ioredis. Scripts: `build`/`start`/`test`/`test:unit`/`test:integration`/`typecheck`.
- `backend/package.json` (`my-evo-backend`, ESM, Express 4 + Prisma 5 + d3-dag + graphology + JWT/bcrypt): parallel my-evo API under `backend/src/index.ts` (port 3000 mock-or-prod).
- `frontend/package.json` (`@evomap/frontend`, Next.js 15 + React 19 + Radix UI + TanStack Query + Recharts + Zustand + XYFlow): standalone build at `.next/standalone/server.js` on port 3000.
- `Dockerfile` (root, multi-stage) builds both root (`dist/`) and `backend/dist/`, prunes dev deps, runs Prisma `db push` then `node dist/index.js` on port 3001 with `wget /health` HEALTHCHECK.
- `frontend/Dockerfile` is multi-stage standalone (port 3000, `node server.js`).
- `docker-compose.yml` orchestrates `backend + frontend + db (postgres:16) + redis (7) + neo4j` (profile `with-neo4j`) + `nginx`/`pgadmin` (opt-in profiles).
- `docker-compose.ci.yml` re-maps host ports to 18080/18081 and pins network to external `workspace-deploy`.
- `docker-compose.prod.yml` adds `deploy.resources` limits + json-file logging.
- `.drone.yml` is a single `kind: pipeline` (`workspace-ci`), arm64, push+custom on `main`. **7 steps**: `repository-smoke`, `backend-test`, `frontend-build`, `docker-build`, `docker-build-frontend`, `deploy`, `e2e-test` (volumes `docker-sock` ×3 are mounts, not steps; the count `- name:` lines = 8 because `e2e-test` volume host block is named separately).

## 2. Test inventory (counted)

`find . -path ./node_modules -prune -o -name '*.test.ts' -print | grep -v node_modules` → **62 files** (≥ 60 required):
- `src/`: 36
- `backend/`: 20
- `frontend/`: 6

Top covered modules (existing): `assets/`, `bounty/` (bounty.test.ts 350 lines), `marketplace/` (incl. pricing), `billing/`, `credits/`, `swarm/`, `sandbox/routes.test.ts`, `graph/algorithms.test.ts`, plus a root `src/app.test.ts`.

## 3. Health/route evidence

`src/index.ts` boots Fastify on PORT (default 3000). `src/app.ts`:
- `/health` (returns `{status, timestamp, services.gdi_refresh_worker}`), `/version`, `/docs` (Swagger UI).
- Registers 35+ route modules: a2a, assets, claim, credits, reputation, swarm, workerpool, council, bounty (`/api/v2/bounty` + `/api/v2/bounties`), session + management, search, analytics, feedback, biology, marketplace, quarantine, driftbottle, community, circle, kg, arena, account, onboarding, trust, reading, sync, task + alias, billing (`/billing` + `/a2a/billing`), monitoring, subscription (`/api/v2/subscription` + `/subscription`), questions, disputes, sandbox (`/api/v2/sandbox` queue), recipe (`/api/v2/recipes` + `/api/v2/recipe` + `/api/v2/organism`), gepx, gep, anti-hallucination + verify, skills (`/api/v2/skills` + `/skills`), constitution, export, batch, advanced-search, audit, webhook, docs/wiki routes, agent_config, model_tier, security + rbac, oauth, project, memory_graph (two prefixes), map, workspace.

`backend/src/index.ts` (Express) exposes `/health`, `/api/v1/{auth, auth/oauth, map, graph, ai, export, assets, marketplace}` and `/api/v2/dashboard`.

## 4. Active modules (22) — already wired and tested

`a2a`, `account`, `agent_config`, `analytics`, `assets`, `bounty` (service+types, routes are stub), `community` (stub), `credits`, `feedback`, `gdi`, `kg`, `map`, `marketplace` (with `pricing.ts`), `monitoring`, `oauth`, `reputation`, `sandbox` (service stub), `session` (incl. `management.ts` 315L), `swarm`, `task`, `worker`. (Counted from `src/*/service.ts` + `routes.ts` pairs that have non-trivial implementation; 15+ sibling dirs are still pure stub placeholders — see §5.)

## 5. Current P0/P1/P2 gap (per `tasks/TODO.md` + `tasks/MASTER-DECOMPOSITION.md` + code)

Status legend: ✅ implemented · 🟡 partial · ⛔ stub / missing.

P0 (blockers)
- T-P0-001 资产购买流程 (TASK_P0_01) — 🟡: backend `POST /marketplace/purchases` exists (`src/marketplace/routes.ts:244`), `GET /purchases`, `confirm`, `dispute`; credits `POST /purchase` (`src/credits/routes.ts:232`). Frontend lacks a real **cart** (`no `CartDrawer`), `app/checkout/` is per-asset detail only (no `/checkout/page.tsx`), no `dashboard/purchases/page.tsx`. Status: backend complete, frontend stub.
- T-P0-002 资产发布 UI (TASK_P0_03) — 🟡: `frontend/src/app/publish/page.tsx` renders `GenePublishForm` + `CapsulePublishForm`; no `RecipePublishForm`; no `ValidationPanel/`. Backend `POST /assets` (`src/assets/service.ts:createAsset`) is real.
- T-P0-003 Checkout/支付后端 (TASK_P0_04) — ✅ partial: `src/billing/routes.ts:203 /checkout` and `src/credits/routes.ts:232 /purchase` exist; `src/billing/service.ts` (791L) and `src/credits/service.ts` (456L) implement deduction/receipt; **no atomic Prisma transaction wrapper** is obvious — confirm in next phase.
- T-P0-004 赏金任务前端 (TASK_P0_02) — 🟡: `frontend/src/app/bounty/page.tsx` (list with stats) + `[bountyId]/page.tsx` + `create/page.tsx` exist, but `submit/page.tsx` is absent; backend `bounty/service.ts` is real (376L, 350L of tests) yet `routes.ts`/`compat-routes.ts` are **stubs** (only 10–11L each, no endpoints).

P1 (high/medium)
- T-P1-001 资产详情页增强 (TASK_P1_01) — 🟡: `frontend/src/app/browse/[assetId]/page.tsx` exists, no reviews/ratings UI.
- T-P1-002 Recipe Composer (TASK_P1_02) — ⛔: `src/recipe/routes.ts` is an 11-line stub; no `frontend/src/app/recipe/composer/page.tsx`; only an editor `RecipeNode.tsx`.
- T-P1-003 Guild (TASK_P1_03) — ⛔: no `frontend/src/app/guild/`; backend `community/routes.ts` is a stub.
- T-P1-004 Circle/社区 (TASK_P1_04) — ⛔: no `frontend/src/app/circle/`; `src/circle/routes.ts` is a stub.
- T-P1-005 Subscription Plans UI (TASK_P1_05) — 🟡: `src/subscription/routes.ts` + `public-routes.ts` expose `/plans` etc.; `frontend/src/app/subscription/page.tsx` is a fallback to `/pricing` (308 redirect in `next.config.mjs`).
- T-P1-006 Drift Bottle UI (TASK_P1_06) — ⛔: no `frontend/src/app/driftbottle/`; `src/driftbottle/routes.ts` is a stub.
- T-P1-007 Notifications (TASK_P1_07) — ⛔: no `frontend/src/components/NotificationCenter/`, no `useNotifications` hook.
- T-P1-008 Agent Profile (TASK_P1_08) — ⛔: no `frontend/src/app/agent/[nodeId]/page.tsx`.

P2 / DOC: per `tasks/TODO.md` all 5 P2 items and 4 DOC items are `PENDING` / `QUEUED`.

## 6. Drone 7-step pipeline vs sandbox capability

Steps (`.drone.yml`): `repository-smoke` → `backend-test` → `frontend-build` → `docker-build` → `docker-build-frontend` → `deploy` → `e2e-test`. All steps have `failure: ignore` or are non-fatal; `failure: ignore` lives on `docker-build`, `docker-build-frontend`, `deploy`, `e2e-test`. YAML: 100% string-typed commands (per `REPAIR-NODE-14-EVIDENCE.md`; verified: 56+ `"..."` command lines, 0 non-string items).

Sandbox capability (this worktree): `drone` binary missing; `capsh --print` shows `!cap_sys_admin, !cap_sys_ptrace, !cap_net_admin`; no `DRONE_TOKEN`/`DRONE_SERVER_URL`/`GITHUB_TOKEN`; `git push github HEAD:main` returns `Authentication failed`; `git push source-publish ...` returns `No such device or address` (no tty, no token). **Implication**: in-sandbox workers can only author `.drone.yml` and commit; the platform harness must own `source_publish` push + Drone trigger + per-step evidence. This matches `REPAIR-NODE-14-EVIDENCE.md` conclusions: prior build `s1366560/my-evo#391` failed at `repository-smoke` on the platform ref because the worktree commit was not fast-forwarded into `memstack-source-publish/main`.

Sandbox Docker state (per `output/DOCKER-BUILD-EVIDENCE.md`): `docker build` falls back with `unshare: operation not permitted` (no `CAP_SYS_ADMIN`); Drone runner on host has full capabilities. Hence the `docker-build`, `docker-build-frontend`, `deploy`, `e2e-test` steps must be platform-executed; sandbox workers record the contract and verify only via curl/lint, not by running `docker compose up`.

## 7. Sprint implementation backlog (priority order for next node)

1. **P0-T2 backend bounty routes** — replace 11-line stubs `src/bounty/routes.ts` + `compat-routes.ts`; bind to existing `service.ts`. Quickest unlock of `TASK_P0_02`.
2. **P0-T1 frontend cart + checkout flow** — add `CartDrawer.tsx`, real `checkout/page.tsx`, `dashboard/purchases/page.tsx`; wire to existing `/marketplace/purchases`.
3. **P0-T3 publish wizard Recipe step + ValidationPanel** — add `RecipePublishForm` + `ValidationPanel/`; reuse `assets/service.ts`.
4. **P0-T4 atomic checkout transaction** — wrap `billing/checkout` + `credits/transaction` in a single Prisma `$transaction` with idempotency key.
5. **P1-T2 Recipe Composer** — `frontend/src/app/recipe/composer/page.tsx` (XYFlow already a dep); wire to `src/recipe/service.ts` after promoting routes.
6. **P1-T7 Notifications** — `NotificationCenter/` + WebSocket hook (`monitoring` already exposes `ws`).
7. **P1-T8 Agent Profile** — `frontend/src/app/agent/[nodeId]/page.tsx` reusing `account/routes.ts`.
8. **P1-T3/T4/T6** — guild + circle + drift-bottle frontends (backends remain stubs; `community`+`circle`+`driftbottle` services must be promoted first).
9. **P1-T1/T5** — asset detail reviews and full subscription page (replacing the `/pricing` redirect fallback).
10. **P2 + DOC** — settings, i18n, analytics, email, then DOC_01 (OpenAPI) → DOC_03 (deployment guide) → DOC_04 (testing strategy).

## 8. Verification checklist for the implementer

- `preflight:read-progress` — this baseline file is the read.
- `preflight:git-status` — clean worktree (`git status --short` empty).
- Test evidence: re-run `backend npm test` (expect 3 suites, 36 passed per `BACKEND_TEST_COVERAGE_REPORT.md`) and add module-level tests as each P0/P1 lands.
- Drone evidence: do not attempt to run Drone from the sandbox; record the worktree commit SHA and the seven-step YAML state, and let the harness trigger the build.

Remaining risk: sandbox cannot perform the `git push` to advance `memstack-source-publish/main`; the platform harness must fast-forward before re-running Drone, or the `repository-smoke` step will fail (matches `REPAIR-NODE-14-EVIDENCE.md` root cause).
