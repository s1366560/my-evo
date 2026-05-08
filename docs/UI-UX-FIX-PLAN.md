# UI/UX Fix Plan - My Evo

**Plan Date**: 2026-05-08
**Task**: Plan UI/UX fixes and prioritize issues
**Status**: PLANNED
**Reference**: `docs/ui-ux-research/frontend-ui-ux-research-report.md`, `docs/ui-comparison/UI-Parity-Status.md`

---

## 1. Executive Summary

Based on the UI/UX research findings from Task 1, this plan prioritizes the remaining gaps and defines acceptance criteria for each fix. Current UI parity is approximately **75%** against EvoMap.ai patterns.

### Completed Fixes (from previous iterations)
| Fix | File | Status |
|-----|------|--------|
| Drag-and-drop import | `app/map/page.tsx` | ✅ DONE |
| CSV format support | `app/map/page.tsx` | ✅ DONE |
| Config presets | `components/map/DataConfigPanel.tsx` | ✅ DONE |
| Map PNG export | `app/map/page.tsx` | ✅ DONE |
| Breadcrumbs | `components/layout/Breadcrumbs.tsx` | ✅ DONE |

---

## 2. Priority Matrix

| Priority | Impact | Effort | Issues | Status |
|----------|--------|--------|--------|--------|
| P1 (Critical) | High | Low-Med | 3 issues | To Fix |
| P2 (High) | Medium | Medium | 3 issues | To Fix |
| P3 (Medium) | Low | Low | 3 issues | To Fix |
| P4 (Low) | Low | High | 2 issues | Backlog |

---

## 3. P1 - Critical Priority Fixes

### 3.1 Import Wizard Component

**Gap**: Multi-step import wizard for data ingestion is completely missing.

**Current State**: Only basic JSON file upload exists.

**Target State**: Step-by-step wizard with data preview, validation feedback, and template download.

**Files to Modify**:
- `frontend/src/components/map/ImportWizard.tsx` (NEW)
- `frontend/src/app/map/page.tsx` (integrate wizard)

**Before**:
```tsx
// Simple file input only
<input type="file" accept=".json" onChange={handleFileUpload} />
```

**After**:
```tsx
// Multi-step wizard with:
<ImportWizard
  onComplete={(data) => setNodes(data.nodes)}
  onCancel={() => setShowWizard(false)}
/>
```

**Acceptance Criteria**:
- [ ] Wizard displays 4 steps: Upload → Preview → Validate → Import
- [ ] Drag-and-drop zone for file upload (JSON + CSV)
- [ ] Data preview table showing first 10 rows
- [ ] Validation errors shown inline with row/column references
- [ ] Sample template download button
- [ ] Paste data textarea alternative to file upload
- [ ] Progress indicator showing current step
- [ ] Cancel/Back/Next navigation between steps

**Verification**:
```bash
npm run build  # Must compile without errors
# Browser: Navigate to /map, click "Import Data", verify wizard opens
```

---

### 3.2 Marketplace Pagination

**Gap**: All assets displayed at once; no pagination or infinite scroll.

**Current State**: `app/marketplace/page.tsx` renders all assets from API/mock.

**Target State**: Page-based pagination with 20 items per page and page controls.

**Files to Modify**:
- `frontend/src/app/marketplace/page.tsx`

**Before**:
```tsx
{filteredAssets.map((asset) => (
  <AssetCard key={asset.id} {...asset} />
))}
```

**After**:
```tsx
const [currentPage, setCurrentPage] = useState(1);
const ITEMS_PER_PAGE = 20;
const paginatedAssets = filteredAssets.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);

{paginatedAssets.map((asset) => (
  <AssetCard key={asset.id} {...asset} />
))}

<Pagination
  currentPage={currentPage}
  totalPages={Math.ceil(filteredAssets.length / ITEMS_PER_PAGE)}
  onPageChange={setCurrentPage}
/>
```

**Acceptance Criteria**:
- [ ] Display shows "Showing X-Y of Z assets"
- [ ] Page numbers displayed with Previous/Next buttons
- [ ] Jump to first/last page buttons
- [ ] Smooth transition when changing pages
- [ ] Filter changes reset to page 1
- [ ] Loading skeleton shown during page change

**Verification**:
```bash
npm run build  # Must compile without errors
# Browser: Navigate to /marketplace, verify pagination controls appear
```

---

### 3.3 Real-Time Marketplace Data

**Gap**: Marketplace uses mock/static data instead of live API data.

**Current State**: `generateMockAssets()` provides static sample data.

**Target State**: Live data from backend API with loading states and error handling.

**Files to Modify**:
- `frontend/src/app/marketplace/page.tsx`

**Before**:
```tsx
// Fallback to mock on API failure
setAssets(generateMockAssets());
```

**After**:
```tsx
// Implement polling for live updates
const POLL_INTERVAL = 30000; // 30 seconds

useEffect(() => {
  fetchMarketplaceData();
  const interval = setInterval(fetchMarketplaceData, POLL_INTERVAL);
  return () => clearInterval(interval);
}, []);

// Add "Last updated" timestamp
<span>Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}</span>
```

**Acceptance Criteria**:
- [ ] Remove mock data fallback in production
- [ ] Add "Last updated" timestamp to header
- [ ] Show loading skeleton on initial load
- [ ] Handle API errors gracefully with retry button
- [ ] Implement auto-refresh every 30 seconds
- [ ] Manual refresh button available

**Verification**:
```bash
# Backend must be running with seeded data
curl http://localhost:3001/api/v1/marketplace/assets
# Should return real data, not mock
```

---

## 4. P2 - High Priority Fixes

### 4.1 Real-Time Config Preview

**Gap**: Configuration panel changes don't update map in real-time.

**Current State**: `DataConfigPanel.tsx` calls `onConfigChange` but changes require manual refresh.

**Target State**: Immediate visual feedback as users adjust settings.

**Files to Modify**:
- `frontend/src/components/map/DataConfigPanel.tsx`
- `frontend/src/store/mapStore.ts` (add reactive config)

**Before**:
```tsx
const updateConfig = (key, value) => {
  const newConfig = { ...config, [key]: value };
  setConfig(newConfig);
  onConfigChange?.(newConfig);
};
```

**After**:
```tsx
// Use Zustand store for reactive updates
const { config, updateConfig } = useMapStore();

// Config changes immediately reflected in canvas
useEffect(() => {
  // Re-render canvas when config changes
  forceRender();
}, [config]);

// Add debounced preview for expensive operations
const debouncedUpdate = useMemo(
  () => debounce(updateConfig, 150),
  []
);
```

**Acceptance Criteria**:
- [ ] Map re-renders within 200ms of config change
- [ ] Smooth transitions for style changes (150ms)
- [ ] Debounce expensive operations (layout changes)
- [ ] Visual indicator showing "Preview updating..." for slow operations

**Verification**:
```bash
# Change color scheme in DataConfigPanel
# Map should update immediately without lag
```

---

### 4.2 Asset Preview Modal

**Gap**: Asset cards don't show detailed preview on click.

**Current State**: Basic card display with limited info.

**Target State**: Modal with full asset details, code snippet, and integration instructions.

**Files to Modify**:
- `frontend/src/components/marketplace/AssetPreviewModal.tsx` (NEW)
- `frontend/src/app/marketplace/page.tsx`

**Before**:
```tsx
// Simple card click
<Card onClick={() => router.push(`/marketplace/${asset.id}`)}>
```

**After**:
```tsx
const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

<Card onClick={() => setPreviewAsset(asset)}>
{previewAsset && (
  <AssetPreviewModal
    asset={previewAsset}
    onClose={() => setPreviewAsset(null)}
  />
)}
```

**Acceptance Criteria**:
- [ ] Modal opens with fade-in animation (200ms)
- [ ] Shows full asset name, description, tags
- [ ] Code snippet displayed with syntax highlighting
- [ ] "Copy Integration Code" button
- [ ] "View on GitHub" link if available
- [ ] Similar assets suggestions
- [ ] Close on backdrop click or Escape key

**Verification**:
```bash
npm run build
# Browser: Click any asset card, modal should appear
```

---

### 4.3 Inline Form Validation

**Gap**: Forms lack inline validation feedback.

**Current State**: Validation errors only logged to console.

**Target State**: Real-time validation with visual feedback.

**Files to Modify**:
- `frontend/src/app/onboarding/page.tsx`
- `frontend/src/app/publish/page.tsx`
- `frontend/src/components/ui/Input.tsx` (enhance)

**Before**:
```tsx
// Errors only in console
console.error('Invalid email format');
```

**After**:
```tsx
// Add validation state to inputs
const [errors, setErrors] = useState<Record<string, string>>({});
const [touched, setTouched] = useState<Record<string, boolean>>({});

const validateEmail = (email: string) => {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email';
  return null;
};

<input
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  onBlur={() => setTouched({ ...touched, email: true })}
  error={touched.email ? errors.email : undefined}
/>
```

**Acceptance Criteria**:
- [ ] Red border on invalid field after blur
- [ ] Error message displayed below field
- [ ] Green border on valid field after blur
- [ ] Checkmark icon for valid fields
- [ ] Error summary at form top for accessibility
- [ ] Submit button disabled until form valid

**Verification**:
```bash
# Submit form with empty required fields
# Errors should appear inline, not just in console
```

---

## 5. P3 - Medium Priority Fixes

### 5.1 WebGL Rendering for Large Datasets

**Gap**: Canvas 2D rendering may lag with 1000+ nodes.

**Current State**: HTML5 Canvas 2D with force simulation.

**Target State**: WebGL-accelerated rendering via PixiJS or Three.js.

**Files to Modify**:
- `frontend/src/components/map/MapCanvas.tsx` (NEW - WebGL renderer)
- `frontend/src/app/map/page.tsx`

**Acceptance Criteria**:
- [ ] Switch to WebGL renderer when node count > 500
- [ ] Maintain 30+ FPS with 1000 nodes
- [ ] Graceful degradation to Canvas 2D if WebGL unavailable
- [ ] Performance monitor showing FPS

---

### 5.2 Node Clustering

**Gap**: Dense node areas are hard to read.

**Current State**: All nodes rendered at full detail.

**Target State**: Automatic clustering with zoom-to-expand.

**Files to Modify**:
- `frontend/src/app/map/page.tsx`
- `frontend/src/components/map/ClusterRenderer.tsx` (NEW)

**Acceptance Criteria**:
- [ ] Clusters appear when nodes overlap at current zoom
- [ ] Cluster badge shows node count
- [ ] Click cluster to zoom and expand
- [ ] Smooth animation during expand/collapse

---

### 5.3 Animation Polish

**Gap**: Transitions feel abrupt; micro-interactions missing.

**Current State**: Basic transitions, minimal hover effects.

**Target State**: Polished animations matching EvoMap aesthetic.

**Files to Modify**:
- `frontend/src/app/**/*.tsx` (various)
- `frontend/src/globals.css`

**Acceptance Criteria**:
- [ ] Button hover: scale(1.02) + shadow increase
- [ ] Card hover: translateY(-2px) + border glow
- [ ] Modal: fade-in + scale(0.95 → 1)
- [ ] Page transitions: fade between routes
- [ ] Loading states: skeleton pulse animation

---

## 6. P4 - Low Priority (Backlog)

### 6.1 AI Matching for Bounty Board
- Smart recommendation engine
- Match user skills to bounty requirements

### 6.2 Advanced Physics Parameters
- Customizable attraction/repulsion forces
- Gravity controls
- Collision detection settings

---

## 7. Implementation Order

### Phase 1: Core UX (P1 items)
1. Import Wizard Component
2. Marketplace Pagination
3. Real-Time Marketplace Data

### Phase 2: Polish (P2 items)
4. Real-Time Config Preview
5. Asset Preview Modal
6. Inline Form Validation

### Phase 3: Enhancement (P3 items)
7. WebGL Rendering
8. Node Clustering
9. Animation Polish

---

## 8. Testing Strategy

### Unit Tests
```bash
npm test -- --testPathPattern="components/map"
```

### Integration Tests
```bash
npm run test:e2e -- --grep="import|pagination|preview"
```

### Manual Verification Checklist
- [ ] /map page loads with import wizard
- [ ] /marketplace shows pagination controls
- [ ] Asset card click opens preview modal
- [ ] Form validation shows inline errors
- [ ] Config changes reflect immediately on map

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Import wizard complexity | Medium | High | Use existing drag-drop component |
| WebGL fallback complexity | Low | Medium | Graceful Canvas 2D fallback |
| Performance regression | Low | High | Benchmark before/after |

---

## 10. References

- UI/UX Research Report: `docs/ui-ux-research/frontend-ui-ux-research-report.md`
- UI Parity Status: `docs/ui-comparison/UI-Parity-Status.md`
- SPEC.md: `docs/final-deliverable/spec/SPEC.md`
- EvoMap Patterns: `docs/competitor-analysis/COMPETITOR_ANALYSIS.md`

---

**Plan Status**: Ready for Implementation
**Estimated Completion**: 3-5 days for P1-P2 items
**Next Action**: Begin P1 item 1 (Import Wizard)
