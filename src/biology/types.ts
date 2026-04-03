export type {
  GeneCategory,
  PhylogenyNode,
  SymbioticRelationship,
  MacroEvent,
  EmergentPattern,
} from '../shared/types';

export interface FitnessCell {
  row: number;
  col: number;
  label: string;
  count: number;
  avg_gdi: number;
}

export interface FitnessLandscape {
  grid_size: number;
  grid: FitnessCell[][];
  x_axis_label: string;
  y_axis_label: string;
}

export interface DiversityIndex {
  shannon: number;
  simpson: number;
  gini: number;
  total_categories: number;
  distribution: Record<string, number>;
}

export interface RedQueenEffect {
  period_days: number;
  avg_mutation_rate: number;
  avg_gdi_change: number;
  coevolution_pairs: number;
  arms_race_detected: boolean;
}
