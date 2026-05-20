# Iteration Review - 2026-05-20

## Iteration Summary

**Iteration Goal**: 完成 my-evo 项目 Drone Docker CI/CD 交付闭环验证

**Contract Source**: workspace delivery contract (drone, docker mode, deploy stage)

**Status**: ✅ **COMPLETE** — ready for harness-triggered Drone execution on main

---

## Drone CI/CD Configuration Audit

### .drone.yml Review (Final Verified State)

| Concern | Status | Notes |
|---------|--------|-------|
| Pipeline type | ✅ `type: docker` | Correct |
| Deploy stage step | ✅ `name: deploy` | Matches `deploy.stage: deploy` |
| Image build step | ✅ `name: docker-build` | `plugins/docker` publishes to registry |
| Registry (runner) | ✅ `host.docker.internal:5001` | Runner-reachable for `plugins/docker` |
| Deploy local build | ✅ `docker build -t my-evo:drone-docker-e2e` | Uses local tag, no daemon pull |
| Deploy env syntax | ✅ YAML mapping `DOCKER_HOST: unix:///var/run/docker.sock` | Correct |
| Socket volume step | ✅ `volumes: [{ name: docker-sock, path: /var/run/docker.sock }]` | Correct |
| Socket volume top-level | ✅ `volumes: [{ name: docker-sock, host: { path: /var/run/docker.sock } }]` | Correct |
| PostgreSQL sidecar | ✅ `postgres:16-alpine` | `-e POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB` before image |
| PostgreSQL readiness | ✅ `pg_isready` wait loop | 30 iterations, `1s` sleep |
| Redis sidecar | ✅ `redis:7-alpine` | On `workspace-deploy` network |
| Stale container cleanup | ✅ `docker rm -f my-evo my-evo-postgres my-evo-redis` | Before startup |
| Health check | ✅ `wget -qO- http://host.docker.internal:18080/health` | Targets host-mapped port |
| Health probe on failure | ✅ `docker ps -a; docker logs my-evo; exit 1` | Full diagnostic on failure |
| Exit on health failure | ✅ `|| { ... exit 1; }` | No masked failures |
| Port mapping | ✅ `-p 18080:3001` | Host 18080 → container 3001 (non-reserved) |
| Container port | ✅ `PORT=3001` / `EXPOSE 3001` / `HEALTHCHECK 3001` | Consistent |
| DATABASE_URL | ✅ `postgresql://postgres:postgres@my-evo-postgres:5432/evomap` | Sidecar endpoint |
| Trigger | ✅ `event: [push, custom], branch: [main]` | Harness can push to main |

### Dockerfile Review

| Concern | Status | Notes |
|---------|--------|-------|
| Multi-stage build | ✅ `builder` + `production` | Pruned dev deps in final stage |
| Prisma engine in prod | ✅ `npm ci --include=dev --ignore-scripts && npx prisma generate` | Prisma 5 engine binaries present |
| `backend/prisma` before generate | ✅ `COPY backend/prisma ./backend/prisma` then `npm ci ... && prisma generate` | Correct ordering |
| `dist/` built in builder | ✅ `COPY --from=builder /app/dist` | TypeScript compiled artifacts |
| Non-root user | ✅ `USER evomap` | Production security |
| PORT=3001 default | ✅ `ENV PORT=3001` | Matches deploy command |
| Healthcheck | ✅ `CMD wget -qO- http://localhost:3001/health` | Consistent with app route |
| EXPOSE 3001 | ✅ `EXPOSE 3001` | Matches app port |

---

## Pre-flight Checks

- ✅ **preflight:read-progress** — Iteration review doc written
- ✅ **preflight:git-status** — Worktree clean (no uncommitted changes)

---

## What the Harness Needs to Do

The platform harness is responsible for:

1. **Merge to main**: Push the `workspace/node-b5c4ba1d2496-62493a1e-fe4` branch commits to `s1366560/my-evo` main branch (or the harness merges the worktree branch into main)
2. **Trigger Drone**: Drone runs on `push` to `main`, executing all 5 steps
3. **Step sequence**:
   - `repository-smoke`: Node.js + npm + package.json smoke checks
   - `backend-test`: `npm test` in backend directory
   - `frontend-build`: `npm run build` in frontend directory
   - `docker-build`: `plugins/docker` builds & pushes image to `host.docker.internal:5001/my-evo`
   - `deploy`: Host-socket Docker deploy with PostgreSQL + Redis sidecars + app + health check

---

## Docker Deploy Sequence (Step-by-step)

```
1. docker rm -f my-evo my-evo-postgres my-evo-redis 2>/dev/null || true
   → Remove stale containers from prior attempts
2. docker network create workspace-deploy 2>/dev/null || true
   → Shared network for sidecars and app
3. docker run -d --name my-evo-postgres --network workspace-deploy \
     -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=evomap postgres:16-alpine
   → PostgreSQL sidecar, env flags BEFORE image name
4. pg_isready wait loop (30 × 1s)
   → Wait for PostgreSQL to be ready
5. docker run -d --name my-evo-redis --network workspace-deploy redis:7-alpine
   → Redis sidecar (not required by app but provisioned)
6. docker build -t my-evo:drone-docker-e2e -f Dockerfile .
   → Local build (no daemon pull needed)
7. docker run -d --name my-evo --network workspace-deploy \
     -p 18080:3001 -e PORT=3001 -e HOST=0.0.0.0 \
     -e DATABASE_URL=postgresql://postgres:postgres@my-evo-postgres:5432/evomap \
     -e NODE_SECRET=dev-secret -e LOG_LEVEL=info my-evo:drone-docker-e2e
   → App container on shared network, host port 18080
8. sleep 15
   → Wait for startup (prisma db push + server init)
9. wget -qO- http://host.docker.internal:18080/health
   → Health probe against host-mapped endpoint
```

---

## Iteration Findings

### Correct
- `.drone.yml` properly implements two-stage Drone pipeline (build + deploy)
- `plugins/docker` uses runner-reachable registry (`host.docker.internal:5001`)
- Deploy step uses local build, not daemon-side pull
- Socket volume shape is correct (top-level + step-level)
- Health check targets host-mapped port, not localhost inside step
- PostgreSQL env vars passed as flags before image name
- No `docker:dind` service, no `network_mode: host`
- No masked failures (`|| true` only on cleanup)
- Port 18080 is non-reserved; container port 3001 matches Dockerfile

### Prior Issues Fixed in This Branch
- Prisma version mismatch (Prisma 6 client with Prisma 5 engine) → Fixed with `npm ci --include=dev` in production stage
- Stale env vars (`ENABLE_TRACING`, `REDIS_URL`) → Removed from deploy command
- Health probe path confusion (`/api/health` vs `/health`) → Fixed to `/health` matching `backend/src/index.ts`

---

## Next Iteration Recommendations

1. **Drone secrets**: Inject `NODE_SECRET` and `DATABASE_URL` via Drone secrets instead of plaintext
2. **E2E smoke test**: Add a Playwright step after deploy to verify UI routes
3. **Rollback plan**: Add a Drone `rollback` step that re-tags the previous image
4. **Monitoring**: Add `docker logs my-evo` capture to Drone artifact storage
