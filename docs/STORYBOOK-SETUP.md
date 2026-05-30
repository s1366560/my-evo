# Storybook Setup Guide

## Installation

From `frontend/` directory:

```bash
npm install --save-dev @storybook/react @storybook/nextjs @storybook/addon-essentials @storybook/addon-interactions @storybook/addon-webpack5-compiler-swc @storybook/react-vite
```

## Run Storybook

```bash
npm run storybook
# Opens at http://localhost:6006
```

## Build Static Storybook

```bash
npm run build-storybook
# Output: frontend/storybook-static/
```

## Existing Stories

| Story | File |
|---|---|
| Button | `src/stories/Button.stories.tsx` |
| Badge | `src/stories/Badge.stories.tsx` |
| MapCanvas | `src/stories/EditorCanvas.stories.tsx` |

## Adding New Stories

Create a `*.stories.tsx` file next to your component:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { YourComponent } from "@/components/your-path/YourComponent";

const meta: Meta<typeof YourComponent> = {
  title: "Category/ComponentName", // appears in sidebar
  component: YourComponent,
  tags: ["autodocs"],               // auto-generates docs page
};
export default meta;
type Story = StoryObj<typeof YourComponent>;

export const Default: Story = { args: { /* default props */ } };
export const Variant: Story = { args: { /* variant props */ } };
```

## Configuration

- `.storybook/main.ts` — framework, addons, story glob patterns
- `.storybook/preview.ts` — global parameters (backgrounds, layout, controls)
- `src/stories/` — story files live here (glob: `../src/**/*.stories.@(js|jsx|mjs|ts|tsx)`)

## Backgrounds

Configured for evomap design system:
- **evomap-dark** (default): `#09090b`
- **evomap-light**: `#fafafa`

## Auto-Docs

Stories tagged `["autodocs"]` auto-generate a documentation page.
Access via the Docs tab in Storybook or at `/docs` in the Storybook UI.

## CI / Build

```yaml
# .github/workflows/storybook.yml
- name: Build Storybook
  run: npm run build-storybook
- name: Upload Storybook
  uses: actions/upload-pages-artifact@v3
```
