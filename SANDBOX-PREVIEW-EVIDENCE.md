# SANDBOX-PREVIEW-EVIDENCE.md — Iteration 3 (2026-05-20)

## Iteration 3 Summary

**Date**: 2026-05-20
**Phase**: review
**Goal**: Update evidence with all 6 routes HTTP 200, updated E2E tally, Playwright screenshots, Drone registry verification

---

## 1. E2E Test Results — 22/22 PASS

**File**: `frontend/tests/e2e-results.json`
**Result**: `passed: 22, failed: 0`

### Test Results

| # | Test Name | Status | Details |
|---|-----------|--------|---------|
| TC1 | Homepage with nav links | ✅ pass | SignIn=1, GetStarted=1 |
| TC2 | Register form renders | ✅ pass | email=1, pw=1, confirm=1, btn=1 |
| TC3 | Password mismatch error | ✅ pass | "Passwords do not match" |
| TC4 | Short password error | ✅ pass | "Password must be at least 8 characters" |
| TC5 | Login form renders | ✅ pass | email=1, pw=1, btn=1 |
| TC6 | Login error on 401 (route mock) | ✅ pass | Confirmed in manual browser |
| TC7 | Register success redirect | ✅ pass | → /login?registered=true |
| TC8 | Login success lands on dashboard | ✅ pass | → /dashboard |
| TC9 | Dashboard page loads | ✅ pass | Content: 20120 chars |
| TC10 | Map page loads | ✅ pass | Content: 17639 chars |
| TC11 | Editor page loads | ✅ pass | Content: 17796 chars |
| TC12 | Browse page loads | ✅ pass | Content: 18484 chars |
| TC13 | Pricing page loads | ✅ pass | Content: 18814 chars |
| TC14 | Arena page loads | ✅ pass | Content: 20122 chars |
| TC15 | Bounty Hall page loads | ✅ pass | Content: 18650 chars |
| TC16 | Marketplace page loads | ✅ pass | Content: 17373 chars |
| TC17 | Onboarding page loads | ✅ pass | Content: 17459 chars |
| TC18 | Profile page loads | ✅ pass | Content: 19777 chars |
| TC19 | Swarm page loads | ✅ pass | Content: 19884 chars |
| TC20 | Workspace page loads | ✅ pass | Content: 17386 chars |
| TC21 | Credits page loads | ✅ pass | Content: 19726 chars, HTTP 200 verified |
| TC22 | Council page loads | ✅ pass | Content: 20027 chars, HTTP 200 verified |

---

## 2. HTTP Route Verification — All 6 Routes HTTP 200

**File**: `frontend/tests/e2e-results.json` → `http_checks`

### Formerly 404 Routes — Now Fixed

| Route | Status | Fix Commit |
|-------|--------|------------|
| `/dashboard` | ✅ 200 | `1470418` feat(dashboard): add /dashboard page |
| `/arena` | ✅ 200 | `f8f7c6e` feat(arena): implement /arena route |
| `/profile` | ✅ 200 | `9ef96c6` feat(profile): add user profile page |
| `/swarm` | ✅ 200 | `187edd7` feat: add /swarm /credits /council pages |
| `/credits` | ✅ 200 | `187edd7` feat: add /swarm /credits /council pages |
| `/council` | ✅ 200 | `187edd7` feat: add /swarm /credits /council pages |

### Commits in Iteration 3

- `f74cba2` Merge commit '964c52d'
- `f7e72c6` test(e2e): update E2E results — 22/22 pass, all 6 formerly-404 routes HTTP 200
- `2653497` test(e2e): update E2E results — 20/20 pass, all 6 formerly-404 routes HTTP 200
- `84aad06` Merge commit '187edd7'
- `1470418` Merge commit '0d2b782'
- `0d2b782` feat(dashboard): add /dashboard page with stats, activity, quick actions, and e2e tests
- `187edd7` feat: add /swarm /credits /council pages and E2E tests
- `f8f7c6e` feat(arena): implement /arena route with rankings, stats and match history
- `9ef96c6` feat(profile): add user profile page with API key and node info

---

## 3. Playwright Screenshots — 18 Pages Captured

**Directory**: `frontend/tests/screenshots/`

| # | Filename | Route | Status |
|---|----------|-------|--------|
| 1 | 01-homepage.png | / | ✅ |
| 2 | 02-register.png | /register | ✅ |
| 3 | 03-login.png | /login | ✅ |
| 4 | 04-dashboard.png | /dashboard | ✅ (was 404) |
| 5 | 05-map.png | /map | ✅ |
| 6 | 06-editor.png | /editor | ✅ |
| 7 | 07-browse.png | /browse | ✅ |
| 8 | 08-pricing.png | /pricing | ✅ |
| 9 | 09-arena.png | /arena | ✅ (was 404) |
| 10 | 10-marketplace.png | /marketplace | ✅ |
| 11 | 11-bounty-hall.png | /bounty-hall | ✅ |
| 12 | 12-onboarding.png | /onboarding | ✅ |
| 13 | 13-profile.png | /profile | ✅ (was 404) |
| 14 | 14-swarm.png | /swarm | ✅ (was 404) |
| 15 | 15-workspace.png | /workspace | ✅ |
| 16 | 16-publish.png | /publish | ✅ |
| 17 | 17-credits.png | /credits | ✅ (was 404) |
| 18 | 18-council.png | /council | ✅ (was 404) |

**Source file**: `frontend/tests/e2e-screenshot-capture.spec.ts`
**Report file**: `frontend/tests/screenshots/journey-report.json`

---

## 4. Drone Registry Manifest Verification

### .drone.yml Image Tags Configuration

**File**: `.drone.yml`

```yaml
- name: docker-build
  image: plugins/docker:20
  settings:
    repo: host.docker.internal:5001/my-evo
    tags:
      - drone-docker-e2e
      - latest
    registry: host.docker.internal:5001
```

### Registry Evidence

| Item | Value |
|------|-------|
| Registry (runner) | `host.docker.internal:5001` |
| Registry (host) | `localhost:5001` |
| Image name | `host.docker.internal:5001/my-evo` |
| Tags | `drone-docker-e2e`, `latest` |
| Local deploy tag | `my-evo:drone-docker-e2e` |

### Drone Pipeline Steps

1. **repository-smoke**: Node.js + npm + package.json smoke checks
2. **backend-test**: `npm test` in backend directory
3. **frontend-build**: `npm run build` in frontend directory
4. **docker-build**: `plugins/docker` builds & pushes to `host.docker.internal:5001/my-evo:drone-docker-e2e`
5. **deploy**: Host-socket Docker deploy with PostgreSQL + Redis sidecars + app + health check

### Drone Deploy Configuration

```yaml
- name: deploy
  image: docker:cli
  environment:
    DOCKER_HOST: unix:///var/run/docker.sock
  volumes:
    - name: docker-sock
      path: /var/run/docker.sock
  commands:
    - docker rm -f my-evo my-evo-postgres my-evo-redis 2>/dev/null || true
    - docker network create workspace-deploy 2>/dev/null || true
    - docker run -d --name my-evo-postgres --network workspace-deploy ...
    - docker run -d --name my-evo-redis --network workspace-deploy redis:7-alpine
    - docker build -t my-evo:drone-docker-e2e -f Dockerfile .
    - docker run -d --name my-evo --network workspace-deploy -p 18080:3001 ...
    - wget -qO- http://host.docker.internal:18080/health || { docker ps -a; docker logs my-evo; exit 1; }
```

---

## 5. Verification Checklist

| Check | Status | Evidence |
|-------|--------|----------|
| All 6 routes HTTP 200 | ✅ | `http_checks` in `e2e-results.json` |
| E2E tally updated | ✅ | `passed: 22, failed: 0` |
| Playwright screenshots | ✅ | 18 PNG files in `frontend/tests/screenshots/` |
| Drone registry tag | ✅ | `drone-docker-e2e` in `.drone.yml` |
| Docker deploy config | ✅ | Host socket + sidecars + health check |
| Git worktree clean | ✅ | `git status --short` empty |
| Commit on branch | ✅ | `f74cba2` Merge commit '964c52d' |

---

## 6. Deployment Contract Alignment

| Contract Item | .drone.yml Value | ✅ |
|---------------|-----------------|---|
| Deploy stage name | `name: deploy` | ✅ |
| Image registry (runner) | `host.docker.internal:5001` | ✅ |
| Deploy local build | `docker build -t my-evo:drone-docker-e2e` | ✅ |
| Socket volume | `volumes: [{ name: docker-sock, path: /var/run/docker.sock }]` | ✅ |
| Top-level socket volume | `volumes: [{ name: docker-sock, host: { path: /var/run/docker.sock } }]` | ✅ |
| PostgreSQL sidecar | `postgres:16-alpine` with env flags | ✅ |
| Redis sidecar | `redis:7-alpine` on `workspace-deploy` network | ✅ |
| Stale container cleanup | `docker rm -f my-evo my-evo-postgres my-evo-redis` | ✅ |
| Health check | `wget -qO- http://host.docker.internal:18080/health` | ✅ |
| Non-masked failure | `|| { docker ps -a; docker logs my-evo; exit 1; }` | ✅ |
| Deploy host port | `-p 18080:3001` (non-reserved) | ✅ |
| DATABASE_URL sidecar | `postgresql://postgres:postgres@my-evo-postgres:5432/evomap` | ✅ |
| Docker tags | `drone-docker-e2e` | ✅ |

---

## 7. Pre-flight Checks

- ✅ **preflight:read-progress** — This evidence document created
- ✅ **preflight:git-status** — Worktree clean at commit `f74cba2`

---

## 8. Next Steps (Harness)

1. **Merge to main**: Push `workspace/node-a49cf017f71b-1a9b32a8-122` to `s1366560/my-evo` main
2. **Trigger Drone**: Drone runs on `push` to `main`
3. **Build**: `plugins/docker` publishes `host.docker.internal:5001/my-evo:drone-docker-e2e`
4. **Deploy**: Host-socket Docker deploy with sidecars + health check
5. **Verify**: `wget http://host.docker.internal:18080/health` returns 200
