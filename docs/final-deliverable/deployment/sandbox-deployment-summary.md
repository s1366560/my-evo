# Sandbox Deployment Summary

**Project:** my-evo  
**Sandbox ID:** `mcp-sandbox-64f2d3d9f4d5`  
**Deployed:** 2026-05-07

---

## Deployment Overview

| Component | URL | Status |
|-----------|-----|--------|
| Frontend (Next.js) | http://localhost:3000 | ✅ Running |
| Backend (Express) | http://localhost:3001 | ✅ Running |
| VNC Desktop | :1 (port 6080) | ✅ Available |

---

## Health Check Results

**Backend API:**
```bash
$ curl http://localhost:3001/health
{"status":"healthy","timestamp":"2026-05-07T16:15:49.563Z","services":{"api":"up","database":"up"}}
```

**Frontend:**
```bash
$ curl http://localhost:3000/api/health
{"status":"healthy","timestamp":"2026-05-07T11:38:47.179Z","service":"frontend","version":"1.0.0"}
```

---

## Services Running

```
root     25528  node dist/index.js      (Backend)
root     28045  next-server v14.2.3    (Frontend)
root        51  Xvnc :1               (Desktop)
```

---

## Access Instructions

1. **Frontend:** Open http://localhost:3000 in browser
2. **Backend API:** Use http://localhost:3001/api/* for API calls
3. **Desktop:** Access via VNC on port 6080

---

## Deployment Artifacts

- Health check report: `docs/health-check-report.md`
- Integration test report: `test-results/E2E-Test-Report.md`
- API verification: `docs/review/API-Contract-Verification-Report-v3.md`
