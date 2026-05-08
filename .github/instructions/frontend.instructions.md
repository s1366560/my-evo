---
applyTo: "frontend/**/*.{ts,tsx}"
---

# Frontend conventions (Next.js 14 App Router + TypeScript)

## Routing
- Pages live under [frontend/src/app/](../../frontend/src/app/) (App Router). Each route folder contains `page.tsx` (and optional `layout.tsx`, `loading.tsx`, `error.tsx`).
- Server components by default. Add `'use client'` at the top **only** when you need state, effects, browser APIs, or event handlers.
- Use the `(group)` syntax for layout grouping without affecting URL (see [frontend/src/app/(app)/](../../frontend/src/app/(app)/)).

## Backend access — never call the backend directly from the browser
- All UI calls go through Next.js route handlers under `frontend/src/app/api/frontend/**/route.ts`.
- Each route handler reads `process.env.BACKEND_URL` (default `http://localhost:3001`) and `fetch`-forwards to the Express API.
- Pattern (see [frontend/src/app/api/frontend/auth/login/route.ts](../../frontend/src/app/api/frontend/auth/login/route.ts)):
  ```ts
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const res = await fetch(`${backendUrl}/auth/login`, { ... });
  ```
- Client components call `/api/frontend/...` (relative URL, same origin). Don't import `axios` baseURLs that point at `:3001`.

## State
- **Zustand** for client state — stores in [frontend/src/store/](../../frontend/src/store/) (`authStore`, `mapStore`, etc.). One store per concern.
- No Redux. No React Context for global state unless purely for theming/i18n.
- Server data: prefer fetching in server components or route handlers; React Query is **not** installed despite SPEC mentions.

## UI / styling
- **Tailwind only** — see [frontend/tailwind.config.js](../../frontend/tailwind.config.js). Use the CSS variables `bg-background` / `text-foreground` for theme-aware colors.
- shadcn/ui primitives are in `frontend/src/components/ui/`. Compose, don't fork. Use `clsx` + `tailwind-merge` (re-exported as `cn`) for conditional classes.
- Animations via `framer-motion`. Icons via `lucide-react`. Charts via `recharts`.
- No CSS-in-JS, no CSS modules, no inline `style={{}}` for anything Tailwind can express.

## Components
- Feature components in `frontend/src/components/<feature>/` (e.g. `marketplace/`, `bounty/`, `map/`). Layout chrome in `frontend/src/components/layout/`.
- Filenames: PascalCase for components (`AssetCard.tsx`), camelCase for hooks/utilities.
- Prefer named exports; default exports only for `page.tsx` / `layout.tsx` / `route.ts` per Next.js requirements.

## TypeScript
- Strict TS. Avoid `any` — use `unknown` at boundaries and narrow.
- `next-env.d.ts` is auto-generated; do not edit.

## Don'ts
- Don't add a unit-test runner without coordinating — current test surface is Playwright at the repo root and in [frontend/tests/](../../frontend/tests/).
- Don't add API routes outside `frontend/src/app/api/frontend/**` (the BFF boundary).
- Don't hardcode `http://localhost:3001` in client code; only route handlers may read `BACKEND_URL`.
