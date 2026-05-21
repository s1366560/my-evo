# SANDBOX-PREVIEW-EVIDENCE.md

## Iteration 5 - Post-Merge Verification

**Date:** 2026-05-21
**Worktree:** workspace/node-c51e55334dec-8046ee84-6f4
**Branch:** workspace/node-c51e55334dec-8046ee84-6f4
**Base Ref:** HEAD (25380a5)

---

## Preflight Checks

| Check | Status |
|-------|--------|
| git-status | Clean worktree (no uncommitted changes) |
| read-progress | Read from worktree path |
| git diff | No staged/unstaged changes |

---

## Post-Merge Status

### Merge Information
- **Merged Branch:** refs/remotes/memstack-source-publish/main
- **Worktree HEAD:** 25380a54e0c9dcaf34fe357a7958317ec419af1c
- **Latest Platform Pipeline:** 1941a3f9-3d6e-4351-9223-3c4fb573d971
- **Pipeline Commit:** f355f3f0d850fdf0c97db6a024282c24455ded08
- **Drone Build:** s1366560/my-evo#142

### Test Verification
- **Playwright Journey:** All 18 routes HTTP 200, no regressions
- **Test Commit:** 25380a5 (test: run playwright journey - all 18 routes HTTP 200, no regressions)

---

## Drone CI/CD Pipeline

**Latest Pipeline Run:** 1941a3f9-3d6e-4351-9223-3c4fb573d971
**Provider:** Drone
**Status:** success
**Commit:** f355f3f0d850fdf0c97db6a024282c24455ded08
**Build:** s1366560/my-evo#142
**External URL:** http://localhost:8080/s1366560/my-evo/142
**Deploy Mode:** docker
**Deploy Stage:** deploy
**Deployment Status:** deployed
**Deploy Validation:** explicit_deploy_step_v1

---

## Docker Deploy Configuration

| Setting | Value |
|---------|-------|
| Docker Registry | localhost:5001 |
| Drone Registry | host.docker.internal:5001 |
| Deploy Local Tag | my-evo:drone-docker-e2e |
| Host Port | 18080 |
| Container Port | 8080 |
| Health Path | /api/health |
| Health Check | wget -qO- http://host.docker.internal:18080/api/health |
| Docker Tags | drone-docker-e2e |

---

## Route Verification

All 18 routes return HTTP 200 (verified via Playwright journey):

| Route | Status | Route | Status |
|-------|--------|-------|--------|
| / | 200 | /marketplace | 200 |
| /register | 200 | /bounty-hall | 200 |
| /login | 200 | /onboarding | 200 |
| /dashboard | 200 | /workspace | 200 |
| /map | 200 | /publish | 200 |
| /editor | 200 | /arena | 200 |
| /browse | 200 | /profile | 200 |
| /pricing | 200 | /swarm | 200 |
| /credits | 200 | /council | 200 |

---

## Worktree Status

- **Current Branch:** workspace/node-c51e55334dec-8046ee84-6f4
- **Current Commit:** 25380a54e0c9dcaf34fe357a7958317ec419af1c
- **Worktree Status:** Clean (no uncommitted changes)
- **Previous Evidence Commit:** 38060fe4b6d5a8f257ee8c2e88bdcccd14147c1b

---

## Summary

Post-merge verification complete:
- memstack-source-publish/main merged successfully
- All 18 routes verified HTTP 200 via Playwright journey test
- Drone pipeline #142 passed (success)
- Deployment status: deployed
- No regressions detected
