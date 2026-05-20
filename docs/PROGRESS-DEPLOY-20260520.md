# Deploy Progress Report - 2026-05-20

## Task: Drone Docker Deploy Pipeline Verification

### Problem (Build #79 Failure)
Drone build s1366560/my-evo#79 failed with two root causes:

1. **Prisma version mismatch causing crash**: The production container crashed immediately with `fatal runtime error` and `missing field enableTracing`. This is a Prisma 6 vs Prisma 5 binary incompatibility:
   - Root workspace has `@prisma/client: ^6.0.0` (installed as production dependency)
   - Backend has `@prisma/client: ^5.10.0` (Prisma 5 engine binaries missing from production image)
   - When Prisma 6 client initializes, it tries to use the query engine which expects `enableTracing` field
   - Fix: Install backend's dev deps (including Prisma engine) in production stage with `npm ci --include=dev`

2. **Port mapping confusion**: The deploy mapped `-p 18080:3001` but the container's internal port is `3001` (matching Dockerfile EXPOSE 3001). The HEALTHCHECK uses port 3001 and the Express app listens on `config.port` (defaults to 3000 but overridden by `ENV PORT=3001`). This was actually correct, but the health probe path `/health` was already fixed in previous commit.

### Fixes Applied

#### 1. Dockerfile - Fix Prisma 5 engine in production
Changed the backend production install from:
```
RUN npm ci --production --ignore-scripts
```
To:
```
RUN npm ci --include=dev --ignore-scripts && npx prisma generate
```
This ensures the Prisma 5 query engine binaries (libquery_engine) are present in the production image.

#### 2. .drone.yml - Remove stale env vars
Removed `ENABLE_TRACING=false` and `REDIS_URL` from docker run command since the backend doesn't use them.

### Files Changed
- `Dockerfile` - install backend Prisma engine in production stage
- `.drone.yml` - remove stale env vars, health probe already fixed to `/health`
- `backend/package.json` - no-op (accidental edit reverted)

### Commit
- Branch: workspace/node-b2768f4c07e7-7d794177-849
- Ready to push to trigger Drone pipeline rebuild
