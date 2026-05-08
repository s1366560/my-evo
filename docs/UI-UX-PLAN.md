# UI/UX Improvement Plan — My Evo

**Document Version:** 1.0  
**Created:** 2026-05-08  
**Based on:** PBAKAUS-IMPECCABLE-RESEARCH.md, FRONTEND-CODEBASE-AUDIT.md, UI-Parity-Status.md

---

## Executive Summary

This plan maps **pbakaus/impeccable** accessibility and interaction patterns to existing My Evo frontend components. The plan prioritizes high-impact, low-effort improvements and provides implementation guidance for each pattern.

---

## 1. Impeccable Patterns to Apply

### 1.1 ARIA Patterns (Priority: HIGH)

| Pattern | Pattern Name | Target Components |
|---------|--------------|-------------------|
| `aria-live` | Live Region | Form feedback, status messages, toast notifications |
| `aria-describedby` | Field Description | All form inputs with help text |
| `aria-expanded` | Expandable State | Navigation menu, collapsible panels, modals |
| `aria-controls` | Related Element | Navigation menu toggle, modal openers |
| `aria-haspopup` | Popup Type | Dropdown menus, modal triggers |
| `role="status"` | Status Indicator | Loading states, sync indicators |
| `role="dialog"` | Dialog | Modal components |
| `role="navigation"` | Navigation | Header and footer navigation |

### 1.2 Smooth Scroll Patterns (Priority: MEDIUM)

| Pattern | Usage |
|---------|-------|
| `scroll-behavior: smooth` | Page-level CSS for anchor navigation |
| `scroll-margin-top` | Offset for sticky headers |
| `overflow-anchor: auto` | Scroll anchoring |
| `scroll-snap-type` | Section-based snap scrolling |

### 1.3 Layout Components (Priority: MEDIUM)

| Pattern | Usage |
|---------|-------|
| CSS Grid | Dashboard layouts, card grids |
| Flexbox gaps | Consistent spacing |
| CSS Custom Properties | Theme tokens |
| Container queries | Responsive component isolation |

---

## 2. Component Mapping & Implementation Plan

### 2.1 Navigation Component (`frontend/src/components/layout/Navigation.tsx`)

**Current State:**
- No `aria-expanded` on mobile menu toggle
- Missing `aria-controls` on hamburger button
- No `role="navigation"` semantic element

**Required Changes:**
```tsx
// Add to mobile menu toggle button
<button
  aria-expanded={isMenuOpen}
  aria-controls="main-navigation"
  aria-haspopup="menu"
  onClick={toggleMenu}
>
  <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
  {/* Icon */}
</button>

<nav
  id="main-navigation"
  role="navigation"
  aria-label="Main navigation"
  aria-hidden={!isMenuOpen && isMobile}
>
  {/* Navigation items */}
</nav>
```

### 2.2 Button Component (`frontend/src/components/ui/Button.tsx`)

**Current State:**
- Uses shadcn/ui Button base
- Missing `aria-disabled` for loading state

**Required Changes:**
```tsx
// When loading, add aria-busy and disable pointer events
<button
  aria-busy={loading}
  disabled={loading || disabled}
  aria-disabled={loading || disabled}
  className={cn(
    // existing classes
    loading && "cursor-wait opacity-70"
  )}
>
  {loading && <span aria-hidden="true" className="mr-2">⏳</span>}
  {children}
</button>
```

### 2.3 Input Component (`frontend/src/components/ui/Input.tsx`)

**Current State:**
- Uses shadcn/ui Input base
- Missing help text linking via `aria-describedby`

**Required Changes:**
```tsx
<input
  {...props}
  id={id || name}
  aria-describedby={
    helpText ? `${id || name}-help` : undefined
  }
  aria-invalid={error ? "true" : undefined}
  aria-required={required || undefined}
/>
{helpText && (
  <p id={`${id || name}-help`} className="text-sm text-muted-foreground">
    {helpText}
  </p>
)}
```

### 2.4 Modal/Preview Components (`frontend/src/components/marketplace/AssetPreviewModal.tsx`)

**Current State:**
- Uses `react-leaflet` but has accessibility gaps

**Required Changes:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title" className="sr-only">{title}</h2>
  {/* Modal content */}
</div>
```

### 2.5 Form Components (Register, Login, Publish)

**Required Changes for All Forms:**
1. Wrap in `<form>` with `aria-label` or `aria-labelledby`
2. Add `aria-live="polite"` region for form errors
3. Add `role="alert"` for submission failures
4. Link all labels with `htmlFor` matching input `id`

```tsx
<form aria-label="Registration form">
  <div role="group" aria-labelledby="personal-info-heading">
    <h3 id="personal-info-heading">Personal Information</h3>
    {/* Form fields */}
  </div>
  
  {/* Live region for async validation */}
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {validationMessage}
  </div>
</form>
```

### 2.6 Dashboard Components (`frontend/src/components/dashboard/UserDashboard.tsx`)

**Required Changes:**
```tsx
<section
  aria-labelledby="dashboard-title"
  role="region"
>
  <h2 id="dashboard-title" className="sr-only">User Dashboard</h2>
  {/* Dashboard content */}
</section>

{/* Status indicators */}
<div role="status" aria-live="polite">
  {syncStatus}
</div>
```

---

## 3. Global CSS Improvements (`frontend/src/app/globals.css`)

### 3.1 Smooth Scroll Support

```css
/* Add to globals.css */
html {
  scroll-behavior: smooth;
  scroll-padding-top: 5rem; /* Account for fixed headers */
}

/* Scroll anchor suppression for specific sections */
.no-scroll-anchor {
  overflow-anchor: none;
}
```

### 3.2 Focus Management

```css
/* Enhanced focus indicators */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Skip link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  z-index: 100;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
```

### 3.3 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 4. Implementation Priority Matrix

| Priority | Component | Pattern | Effort | Impact |
|----------|-----------|---------|--------|--------|
| P1 | Navigation | ARIA menu | Low | High |
| P1 | Forms (all) | Live regions | Medium | High |
| P1 | Buttons | Loading state | Low | Medium |
| P2 | Modals | Dialog role | Low | High |
| P2 | Input fields | Describedby | Low | High |
| P2 | Dashboard | Status regions | Low | Medium |
| P3 | Global CSS | Smooth scroll | Low | Medium |
| P3 | All pages | Skip links | Low | High |

---

## 5. Testing Checklist

- [ ] Run `npm run build` to verify no TypeScript errors
- [ ] Test with axe DevTools browser extension
- [ ] Verify keyboard navigation (Tab, Enter, Escape, Arrow keys)
- [ ] Test with screen reader (NVDA/VoiceOver)
- [ ] Check color contrast ratios (WCAG AA minimum)
- [ ] Validate HTML with W3C validator
- [ ] Test reduced motion preference

---

## 6. Reference Files

- **Skills Research:** `docs/skills-research/PBAKAUS-IMPECCABLE-RESEARCH.md`
- **Frontend Audit:** `docs/frontend-audit/FRONTEND-CODEBASE-AUDIT.md`
- **UI Parity:** `docs/ui-comparison/UI-Parity-Status.md`
- **Components:** `frontend/src/components/{ui,layout,marketplace,dashboard,bounty,publish}/`
- **Pages:** `frontend/src/app/{page,map,marketplace,bounty,memory,account,workspace}/page.tsx`

---

## 7. Next Steps

1. **Immediate (P1):** Implement ARIA patterns in Navigation and Form components
2. **Short-term (P2):** Add smooth scroll and focus management to globals.css
3. **Medium-term (P3):** Audit all remaining components for accessibility gaps
4. **Ongoing:** Include accessibility checks in CI/CD pipeline

---

*Document generated as part of My Evo UI/UX improvement initiative.*
