// GDI score can be either a flat number or a structured object.
// Normalize to structured form so all consumers receive a consistent shape.

export interface GDIStructured {
  overall: number;
  dimensions: {
    usefulness: number;
    novelty: number;
    rigor: number;
    reuse: number;
  };
  /** Set to true when `dimensions` are placeholders from a flat score */
  _flat?: boolean;
}

export function normalizeGDI(raw: number | GDIStructured): GDIStructured {
  if (typeof raw === 'number') {
    return {
      overall: raw,
      dimensions: {
        usefulness: raw,
        novelty: raw,
        rigor: raw,
        reuse: raw,
      },
      _flat: true,
    };
  }
  return raw;
}
