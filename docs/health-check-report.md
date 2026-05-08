# Sandbox Health Check Report

**Date:** 2026-05-07  
**Environment:** MCP Sandbox Container  
**Sandbox ID:** `mcp-sandbox-64f2d3d9f4d5`

---

## 1. Service Health Status

### Backend API (Express Server)
- **Port:** 3001
- **Health Endpoint:** `http://localhost:3001/health`
- **Status:** ✅ HEALTHY

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-07T16:15:49.563Z",
  "services": {
    "api": "up",
    "database": "up"
  }
}
```

### Frontend (Next.js Server)
- **Port:** 3000
- **Health Endpoint:** `http://localhost:3000/api/health`
- **Status:** ✅ HEALTHY

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-07T11:38:47.179Z",
  "service": "frontend",
  "version": "1.0.0"
}
```

---

## 2. Process Status

**Running Services:**
| Service | PID | Status |
|---------|-----|--------|
| Backend (node dist/index.js) | 25528 | Running |
| Frontend (next-server v14.2.3) | 28045 | Running |
| VNC Desktop (:1) | 51 | Running |

---

## 3. Recent API Activity (from logs)

**Successful endpoints observed:**
- `GET /` - 200 OK
- `GET /health` - 200 OK
- `POST /auth/register` - 201 Created
- `POST /auth/login` - 200 OK
- `GET /map/nodes` - 200 OK
- `GET /map/edges` - 200 OK
- `GET /map/graph` - 200 OK
- `POST /a2a/heartbeat` - 200 OK

**Known 404 issues (minor):**
- `GET /assets` - 404 (endpoint path mismatch)
- `GET /api/map/graph` - 404 (API route not configured)

---

## 4. Sandbox Deployment URL

**Preview URL:** Available via sandbox proxy  
**Frontend:** http://localhost:3000  
**Backend API:** http://localhost:3001  

For external access, the sandbox provides a proxy URL based on the sandbox ID: `mcp-sandbox-64f2d3d9f4d5`

---

## 5. Conclusion

Both frontend and backend services are **operational and healthy**. The deployment is ready for:
- Internal testing via localhost
- External preview via sandbox proxy
- E2E testing via Playwright
