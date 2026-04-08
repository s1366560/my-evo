import { ASSET_COLORS, BREAKPOINTS, COLORS, RADIUS, SPACING, TYPOGRAPHY } from './design-tokens';

describe('design tokens', () => {
  test('semantic colors resolve to css variables', () => {
    expect(COLORS.background).toBe('var(--color-background)');
    expect(COLORS.foreground).toBe('var(--color-foreground)');
    expect(COLORS.ring).toBe('var(--color-ring)');
  });

  test('asset colors and spacing scales stay aligned with the design system', () => {
    expect(ASSET_COLORS).toEqual({
      gene: 'var(--color-gene-green)',
      capsule: 'var(--color-capsule-blue)',
      recipe: 'var(--color-recipe-amber)',
    });

    expect(SPACING).toEqual({
      xs: 'var(--spacing-xs)',
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
      '2xl': 'var(--spacing-2xl)',
    });
  });

  test('typography, radius, and breakpoints expose shared primitives', () => {
    expect(TYPOGRAPHY.fontFamily).toContain('var(--font-sans');
    expect(TYPOGRAPHY.monoFamily).toContain('var(--font-mono');
    expect(RADIUS.default).toBe('var(--radius)');
    expect(RADIUS.full).toBe('9999px');
    expect(BREAKPOINTS.lg).toBe('1024px');
    expect(BREAKPOINTS['2xl']).toBe('1536px');
  });
});
