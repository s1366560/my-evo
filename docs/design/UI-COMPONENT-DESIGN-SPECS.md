# UI Component Design Specifications
## EvoMap - My Evo Project

**Document Date**: 2026-05-08
**Purpose**: Detailed design solutions for 5 remaining UI features

---

## Table of Contents
1. DataImportPanel with Drag-Drop + CSV + JSON + Import Wizard
2. Marketplace Pagination + Preview Modal
3. Config Presets Panel
4. Map PNG Export Improvements
5. Accessibility Fixes
6. Implementation Order

---

## 1. DataImportPanel

### Current State
- Drag-drop handler exists at `frontend/src/app/map/page.tsx:159-256`
- Basic file validation (.json, .csv)
- Simple CSV parsing with header detection

### Design Requirements

#### 1.1 Dedicated DataImportPanel Component
```typescript
// frontend/src/components/map/DataImportPanel.tsx
interface DataImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (nodes: Node[], edges: Edge[]) => void;
}

// Component Structure
- Modal overlay with drag-drop zone
- Tab interface: [Drag & Drop] [File Browser] [Paste Data]
- File type indicators and validation feedback
- Preview table showing parsed data before confirmation
- Column mapping UI for CSV files
```

#### 1.2 Drag-Drop Zone Specs
```
Visual States:
- Default: Dashed border (#8b5cf6), icon centered
- Drag Over: Solid border, scale(1.02), pulsing icon
- Processing: Spinner overlay
- Error: Red border, error message
- Success: Green checkmark, preview summary

Accepted Formats:
- .json: { nodes: [], edges: [] } structure
- .csv: Flexible headers (id, label, type, score)
- .tsv: Tab-separated values
- .xlsx: Excel files (via xlsx library)
```

#### 1.3 CSV Import Wizard Flow
```
Step 1: File Upload - Drag-drop or file picker, show metadata
Step 2: Column Mapping - Auto-detect headers, manual override dropdowns
Step 3: Data Preview - Table view with pagination (20 rows/page)
Step 4: Confirmation - Select types, choose edge strategy, import
```

#### 1.4 File Size Limits
```
Max file size: 10MB
Max nodes per import: 5000
Max edges per import: 10000
Large file warning: >1MB shows confirmation dialog
```

#### 1.5 Implementation File Structure
```
frontend/src/components/map/
├── DataImportPanel.tsx      # Main import wizard
├── DragDropZone.tsx         # Reusable drop zone
├── ColumnMapper.tsx          # CSV column mapping UI
├── DataPreview.tsx           # Table preview component
└── index.ts
```

---

## 2. Marketplace Pagination + Preview Modal

### Current State
- Basic pagination at `frontend/src/app/marketplace/page.tsx:81-202`
- AssetPreviewModal at `frontend/src/components/marketplace/AssetPreviewModal.tsx`

### Design Requirements

#### 2.1 Enhanced Pagination Component
```typescript
// frontend/src/components/ui/Pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  maxVisible?: number;
}
```

**Pagination Design Specs:**
```
Layout: [First] [Prev] [1] [2] [3 ...] [5] [6] [7] [Next] [Last]

Visual States:
- Current page: bg-purple-600, white text, shadow
- Adjacent pages: bg-gray-800, hover:bg-gray-700
- Ellipsis: text-gray-500, no click
- Disabled: opacity-50, cursor-not-allowed
- Badge: "Showing 1-20 of 156 assets"

URL Sync: ?page=2 query param for shareable links
Scroll: Smooth scroll to top on page change
Keyboard: Arrow keys navigate when focused
```

#### 2.2 Preview Modal Enhancements
```typescript
interface EnhancedAssetPreviewModalProps {
  asset: Asset;
  onClose: () => void;
  onAddToCollection?: (assetId: string) => void;
  onViewOnMap?: (nodeId: string) => void;
  relatedAssets?: Asset[];
}
```

**Modal Enhancement Specs:**
```
Header: Asset icon, name, type badge, creator, close button

Stats Grid (4 columns):
- GDI Score (star icon)
- Views (eye icon) - real data from API
- Calls (zap icon) - real data from API
- Created date

Description: Full text with read more/less toggle
Tags: Full list with click-to-filter
Integration Code: Syntax highlighted, one-click copy, language tabs (JS/Python/cURL)

Asset Details Table: Asset ID (copyable), Model, Node ID (clickable), Status

Footer: View on GitHub | Add to Collection | Close

Keyboard: Escape closes, Tab navigates, Enter activates
```

#### 2.3 AssetCard Enhancement
```typescript
interface EnhancedAssetCardProps {
  asset: Asset;
  onPreview: (asset: Asset) => void;
  onAddToCollection?: (assetId: string) => void;
}
```

**AssetCard Enhancement Specs:**
```
Card Layout:
- Type badge (top-left), GDI Score (top-right)
- Asset name (h3, 2 lines max)
- Description (3 lines max, gradient fade)
- Tags (first 3, +N more)
- Meta row: date, model
- Footer: View Details | Add to Collection

Interactions:
- Hover: Border glow, -translate-y-0.5
- Click: Open preview modal
- Enter/Space: Opens modal
```

---

## 3. Config Presets Panel

### Current State
- Basic presets in `frontend/src/components/map/DataConfigPanel.tsx:42-83`
- localStorage persistence, simple save/load/delete

### Design Requirements

#### 3.1 Enhanced Preset System
```typescript
interface MapPreset {
  id: string;
  name: string;
  description?: string;
  config: MapConfig;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
  thumbnail?: string;
}

interface PresetsPanelProps {
  config: MapConfig;
  onApplyPreset: (config: MapConfig) => void;
  onSavePreset: (name: string, config: MapConfig) => void;
  onDeletePreset: (id: string) => void;
}
```

**Presets Panel Specs:**
```
Section Header: "Presets" label, "Save Current" button, collapse toggle

Preset Card shows: name, config summary, mini thumbnail, date, actions

Preset Card States:
- Default: bg-gray-800/50
- Hover: bg-gray-800, border glow
- Active/Applied: purple border, checkmark
- Default presets: star icon indicator

Built-in Presets:
- "Default View": Force layout, scores shown
- "Heatmap Mode": Heatmap colors, all visible
- "Minimal": No labels, fixed nodes
- "Focus on Genes": Gene nodes highlighted
```

#### 3.2 Preset Management Features
```
Import/Export:
- Export all presets as JSON
- Import presets from JSON file
- Share preset via URL (encoded config)

Auto-save:
- "Remember last session" option
- Auto-apply last used preset on page load

Storage: localStorage for user presets, app defaults bundled
```

#### 3.3 Preset Quick-Apply Bar
```
Location: Above map canvas, below toolbar
- Horizontal scrollable list of preset buttons
- Active preset highlighted
- Click to apply instantly
- Right-click for options menu
```

---

## 4. Map PNG Export Improvements

### Current State
- Basic export at `frontend/src/app/map/page.tsx:258-273`
- Canvas toDataURL export, fixed filename with timestamp

### Design Requirements

#### 4.1 Enhanced Export Options
```typescript
interface ExportOptions {
  format: 'png' | 'svg' | 'json';
  scale: 1 | 2 | 3 | 4;
  includeBackground: boolean;
  backgroundColor?: string;
  padding: number;
  filename?: string;
  quality?: number;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  preview?: string;
}
```

**Export Dialog Specs:**
```
Dialog Layout:
- Modal title: "Export Map"
- Preview thumbnail
- Format: PNG | SVG | JSON (radio buttons)
- Scale: 1x, 2x, 3x, 4x (with file size estimate)
- Background: toggle + color picker
- Padding: 0-100px slider
- Filename input (default: evo-map-{date})
- Export button

PNG: Scale options, recommended 2x for retina
SVG: Vector output, best for print
JSON: Raw node/edge data export
```

#### 4.2 Export Quality Improvements
```typescript
// Improved implementation:
const exportToPNG = (options: ExportOptions) => {
  // 1. Create offscreen canvas at target resolution
  const exportCanvas = document.createElement('canvas');
  const scale = options.scale || 2;
  exportCanvas.width = (canvasWidth + options.padding * 2) * scale;
  exportCanvas.height = (canvasHeight + options.padding * 2) * scale;
  
  // 2. Scale and center the content
  const ctx = exportCanvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.translate(options.padding, options.padding);
  
  // 3. Draw background if requested
  if (options.includeBackground) {
    ctx.fillStyle = options.backgroundColor || '#0a0a0f';
    ctx.fillRect(-options.padding, -options.padding, 
                 canvasWidth + options.padding * 2, 
                 canvasHeight + options.padding * 2);
  }
  
  // 4. Redraw map content (scaled)
  
  // 5. Export
  const dataUrl = exportCanvas.toDataURL('image/png');
  downloadFile(dataUrl, options.filename || 'evo-map.png');
};
```

#### 4.3 Export Button Improvements
```
Enhanced dropdown menu:
- Export as PNG
- Export as SVG
- Export as JSON
- Export Selection (if nodes selected)
- Copy to Clipboard

Tooltip: "Export map as image or data"
Keyboard: Ctrl/Cmd + E shortcut
```

---

## 5. Accessibility Fixes

### Current State
- Skip links in Navigation.tsx
- Some aria-labels on buttons
- Basic heading hierarchy

### Design Requirements

#### 5.1 Focus Management
```css
/* globals.css additions */

:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

#### 5.2 ARIA Improvements
```typescript
// Map Canvas - Add role and description
<canvas
  ref={canvasRef}
  role="img"
  aria-label={`Evolution map with ${nodes.length} nodes and ${edges.length} connections`}
  aria-describedby="map-instructions"
  tabIndex={0}
/>

// Hidden instructions for screen readers
<p id="map-instructions" className="sr-only">
  Use arrow keys to pan, plus/minus to zoom. Click nodes to select. 
  Press Enter to edit selected node.
</p>

// Live region for dynamic updates
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only"/>
```

#### 5.3 Keyboard Navigation Map
```
Map Page Keyboard Controls:
- Arrow keys: Pan the map
- Plus/Minus: Zoom in/out
- 0: Reset zoom to 100%
- F: Toggle fullscreen
- Escape: Deselect node / close panels
- Tab: Navigate toolbar buttons
- Enter: Edit selected node
- Delete/Backspace: Delete selected node
- Ctrl+S: Save map
- Ctrl+E: Export dialog
- Space: Play/pause animation

Modal Keyboard Controls:
- Escape: Close modal
- Tab: Navigate within modal
- Shift+Tab: Navigate backwards
- Enter: Activate primary action
```

#### 5.4 Color Contrast
```
Ensure WCAG AA compliance (4.5:1):

Current issues:
- Gray-400 (#9ca3af) on dark bg: ~4.2:1 - borderline
- Gray-500 (#6b7280) on dark bg: ~3.1:1 - FAIL

Fixes:
- Body text: Use gray-300 (#dcdcdc) minimum
- Secondary text: gray-400 acceptable for small text only

Tooltips:
- Background: gray-900
- Text: white
- Border: gray-700
```

#### 5.5 Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. Implementation Order

### Phase 1: Core Infrastructure (Week 1)
1. **Pagination Component** - Extract to reusable UI component
2. **Export Dialog** - Create export options modal
3. **Focus Management CSS** - globals.css fixes

### Phase 2: Enhanced UX (Week 2)
4. **DataImportPanel** - Full import wizard with column mapping
5. **Preset System** - Enhanced with thumbnails and built-in presets
6. **Keyboard Navigation** - Full keyboard support for map

---

## Appendix: File Locations

| Feature | Files to Create/Modify |
|---------|------------------------|
| Pagination | `frontend/src/components/ui/Pagination.tsx` |
| Export Dialog | `frontend/src/components/map/ExportDialog.tsx` |
| DataImportPanel | `frontend/src/components/map/DataImportPanel.tsx`, `DragDropZone.tsx`, `ColumnMapper.tsx` |
| Presets | `frontend/src/components/map/DataConfigPanel.tsx` (enhance) |
| Accessibility | `frontend/src/app/globals.css`, `frontend/src/app/map/page.tsx` |

---

**Document Generated**: 2026-05-08
**Version**: 1.0
