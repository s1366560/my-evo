import { normalizeGDI, type GDIStructured } from './normalizers';

describe('normalizeGDI', () => {
  test('converts flat scores into structured placeholder dimensions', () => {
    expect(normalizeGDI(88)).toEqual({
      overall: 88,
      dimensions: {
        usefulness: 88,
        novelty: 88,
        rigor: 88,
        reuse: 88,
      },
      _flat: true,
    });
  });

  test('returns structured scores without mutation', () => {
    const structured: GDIStructured = {
      overall: 91,
      dimensions: {
        usefulness: 92,
        novelty: 90,
        rigor: 93,
        reuse: 89,
      },
    };

    const result = normalizeGDI(structured);

    expect(result).toBe(structured);
    expect(result._flat).toBeUndefined();
  });
});
