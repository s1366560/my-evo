# Drone Docker Deploy Pipeline Status

## Last Pipeline Run
- **Pipeline**: Drone CI (workspace-ci)
- **Repo**: s1366560/my-evo
- **Branch**: main
- **Stage**: deploy (docker deploy mode)
- **Image**: my-evo:drone-docker-e2e
- **Registry**: localhost:5001/my-evo / host.docker.internal:5001/my-evo

## Deploy Contract
- **Mode**: docker (host-socket deploy)
- **Strategy**: local_build (docker build in deploy step)
- **Health Path**: /health
- **Host Port**: 18080
- **Container Port**: 8080

## Deploy Step Components
1. Clean stale containers (my-evo-app, postgres-sidecar, redis-sidecar)
2. Ensure workspace-deploy network exists
3. Build image locally: `docker build -t my-evo:drone-docker-e2e -f Dockerfile .`
4. Start postgres-sidecar on workspace-deploy network
5. Start redis-sidecar on workspace-deploy network
6. Run my-evo-app with retry loop (3 attempts) for transient port conflicts
7. Verify container running state
8. Health check against `http://host.docker.internal:18080/health`

## Previous Issues (Fixed)
- Dockerfile CMD: removed prisma migrate deploy (no migrations dir)
- .dockerignore: uncommented prisma/migrations/
- Health URL: fixed to /health (backend route)
- Port mapping: 18080:8080 (host:container)
- Entry point: dumb-init for proper signal handling
