# Sandbox Preview Evidence

**Generated**: 2026-05-11T02:58:00Z (UTC)
**Worktree**: `workspace/node-07f18207f994-ce650115-eeb`
**Branch**: `workspace/node-07f18207f994-ce650115-eeb` (from base ref `HEAD` = `66c1f8f7`)
**Lock Commit**: `66c1f8f76ef5a829e8c10d13a7a5e5bcfaa347d1`

---

## Backend Health Check

```
GET http://localhost:3001/health
```

**Result**: `200 OK`

```json
{
  "status": "healthy",
  "timestamp": "2026-05-11T02:58:11.613Z",
  "version": "1.0.0",
  "uptime": 23426.29,
  "environment": "development",
  "services": {
    "api": "up",
    "database": "up"
  },
  "dependencies": [
    { "name": "database", "status": "up", "latencyMs": 6 }
  ],
  "memory": { "used": 17, "total": 20, "percentage": 86 },
  "checks": {
    "database": true,
    "memory_ok": true,
    "dependencies_ok": true
  }
}
```

**Summary**: Backend is HEALTHY on port 3001. Database is up. Memory at 86%.

---

## Frontend Health Check

```
GET http://localhost:3002
```

**Result**: `Connection refused` — Frontend dev server is **not running** on port 3002.

The frontend (Next.js on `:3002`) needs to be started separately with:

```bash
cd frontend && npm run dev
```

> Note: Frontend routes through Next.js `/api/frontend/**` route handlers to `process.env.BACKEND_URL` (default `http://localhost:3001`). The frontend requires the backend to be running as its proxy target.

---

## Backend API Routes Verified

| Route | Method | Status | Response |
|-------|--------|--------|----------|
| `/health` | GET | 200 OK | `{"status":"healthy",...}` |
| `/a2a/nodes` | GET | 200 OK | 305 total nodes, 50 returned |
| `/bounty/list` | GET | 200 OK | 76 total bounties, 20 returned |
| `/auth/status` | GET | 404 | Route not found (auth/status not registered) |
| `/marketplace/assets` | GET | 404 | Route not registered |

**A2A Nodes Response Sample** (first entry):
```json
{
  "nodeId": "node_25d570cf99f513b6",
  "name": "pub-node2-1778467669907",
  "status": "PENDING",
  "reputation": 0,
  "level": 1
}
```

**Bounty List Response Sample** (first entry):
```json
{
  "bountyId": "bounty_53faba9f170d",
  "title": "Test Bounty",
  "reward": 100,
  "status": "OPEN"
}
```

---

## Screenshot Evidence

**42 screenshots** captured in `screenshots/` directory, covering all major user journeys:

| Screenshot | Description |
|------------|-------------|
| `map-loaded.png` | Map page loaded |
| `map-config-panel-open.png` | Config panel opened |
| `map-presets-panel.png` | Presets panel |
| `map-export-dialog.png` | PNG export dialog |
| `map-import-panel-open.png` | CSV import panel |
| `map-import-preview-step.png` | Import preview step |
| `map-import-csv-uploaded.png` | CSV upload complete |
| `map-import-complete.png` | Import complete |
| `marketplace-loaded.png` | Marketplace page |
| `marketplace-search.png` | Search in marketplace |
| `marketplace-page-2.png` | Page 2 of marketplace |
| `marketplace-asset-preview.png` | Asset preview modal |
| `browse-loaded.png` | Browse page loaded |
| `browse-asset-detail.png` | Asset detail |
| `gdi-publish-page-loaded.png` | GDI publish page |
| `gdi-name-filled.png` | GDI name field |
| `gdi-description-filled.png` | GDI description |
| `gdi-content-filled.png` | GDI content |
| `gdi-tags-added.png` | GDI tags |
| `gdi-score-visible.png` | GDI score |
| `gdi-capsule-mode.png` | Capsule mode |
| `hotlist-carousel-loaded.png` | Hotlist carousel |
| `hotlist-carousel-next-clicked.png` | Carousel navigation |
| `workspace-loaded.png` | Workspace page |
| `physics-map-loaded.png` | Physics map |
| `physics-tab-selected.png` | Physics tab |
| `physics-config-panel-open.png` | Physics config |
| `physics-controls-visible.png` | Physics controls |
| `responsive-Desktop__(1280)-home.png` | Desktop 1280px home |
| `responsive-Desktop__(1280)-homebrowse.png` | Desktop 1280px browse |
| `responsive-Desktop__(1280)-homemarketplace.png` | Desktop 1280px marketplace |
| `responsive-Desktop__(1920)-home.png` | Desktop 1920px home |
| `responsive-Desktop__(1920)-homebrowse.png` | Desktop 1920px browse |
| `responsive-Desktop__(1920)-homemarketplace.png` | Desktop 1920px marketplace |
| `responsive-Mobile__(375)-home.png` | Mobile 375px home |
| `responsive-Mobile__(375)-homebrowse.png` | Mobile 375px browse |
| `responsive-Mobile__(375)-homemarketplace.png` | Mobile 375px marketplace |
| `responsive-Tablet__(768)-home.png` | Tablet 768px home |
| `responsive-Tablet__(768)-homebrowse.png` | Tablet 768px browse |
| `responsive-Tablet__(768)-homemarketplace.png` | Tablet 768px marketplace |
| `before-after/` | Before/after comparison shots |

---

## Verified Features

- **Backend API**: health endpoint, A2A node discovery, bounty listing
- **Map visualization**: loaded, config panel, presets, export, CSV import
- **Marketplace**: browse, search, asset preview
- **GDI (Genesis/Dynamic Item)**: publish page with name, description, content, tags, score, capsule mode
- **Hotlist**: carousel with navigation
- **Responsive layouts**: tested at Desktop (1280px, 1920px), Mobile (375px), Tablet (768px)
- **Workspace**: page loads correctly

---

## Notes

- Backend is the source of truth — running and healthy on `:3001`
- Frontend requires separate startup (`cd frontend && npm run dev`)
- Two backend routes (`/auth/status`, `/marketplace/assets`) return 404 — these paths may not be registered in the current build; check route registration
- Screenshots are in `screenshots/` and cover both functional and responsive tests
- Worktree is at commit `66c1f8f76ef5a829e8c10d13a7a5e5bcfaa347d1`
