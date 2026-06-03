# sandbox-preview-evidence.md — Drone Pipeline Deploy Verification

**Workspace:** 完成my-evo 项目开发并通过drone cicd 部署
**Task node:** node-8c37c9d9734c
**Attempt:** 14e2a743-c95a-4d1f-8bf3-08998755c3dc
**Branch:** workspace/node-8c37c9d9734c-14e2a743-c95
**Commit (HEAD):** 1c6c4fe04d268556bad0319ab87e04d5ea20c5cc
**Date:** 2026-06-03

---

## Host-Side Harness Pipeline Evidence

The platform-persisted pipeline run record confirms Drone build #429 passed:

| Field | Value |
|-------|-------|
| Pipeline run id | `87e7c1a2-b69e-4372-82a5-1d01b498a53a` |
| Provider | drone |
| Status | **success** |
| Commit | `1c6c4fe04d268556bad0319ab87e04d5ea20c5cc` |
| Reason | harness-native CI/CD pipeline passed |
| Created | 2026-06-03T07:17:41Z |
| Completed | 2026-06-03T07:29:45Z |
| External run | s1366560/my-evo#429 |
| External URL | http://localhost:8080/s1366560/my-evo/429 |
| Drone build | 429 |
| Drone repo | s1366560/my-evo |
| Drone status | success |

---

## Sandbox Preview Proxy

The host-side harness injects the sandbox preview proxy URL after source publish and Drone triggering. At the time of this attempt, the Drone pipeline succeeded on commit `1c6c4fe`, and the platform records the evidence above.

**Commit SHA:** `1c6c4fe04d268556bad0319ab87e04d5ea20c5cc`

**Preview URL:** Host-side harness-managed; the deploy step maps host port 18080 → container 3001 (backend `/health`) and host port 18081 → container 3000 (frontend `/`).

**Health Check:** `wget -qO- http://host.docker.internal:18080/health` (configured in deploy step command, validated by Drone #429 success).

---

## Pipeline Steps Validation

All 7 steps validated:

1. **repository-smoke** — 12 commands, structure verification
2. **backend-test** — 3 commands, 3× retry npm install + npm test
3. **frontend-build** — 3 commands, 3× retry npm install + npm run build
4. **docker-build** — 5 commands, Docker BuildKit backend image
5. **docker-build-frontend** — 5 commands, Docker BuildKit frontend image
6. **deploy** — 35 commands, sidecars + app containers + /health probe
7. **e2e-test** — 8 commands, Playwright against host port 18081

YAML parse check: `python -c "import yaml; yaml.safe_load(open('.drone.yml'))"` → OK
Command count check: `grep -c 'commands' .drone.yml` = 7 (≥ 7 ✓)

---

## Evidence Artifacts

- `output/DEPLOY-CONTRACT.md` — 12-item contract checklist (all ✓)
- `.drone.yml` — full pipeline definition (7 steps, 71 commands, all string-typed)
- `Dockerfile` — multi-stage backend (builder → production, 1500m heap, prisma, dumb-init, HEALTHCHECK)
- `frontend/Dockerfile` — multi-stage frontend (builder → production, standalone, port 3000)
- `docker-compose.yml` — developer-mode full stack
- `docker-compose.ci.yml` — CI port overrides (18080:3001, 18081:3000)
