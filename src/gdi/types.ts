/**
 * GDI (Genetic Diversity Index) Scoring Engine Types
 * 
 * GDI评分引擎定义五种核心维度：
 * - structural: 结构完整性（代码结构、模块化、依赖关系）
 * - semantic: 语义正确性（功能符合描述、逻辑正确）
 * - specificity: 特异性（与现有资产的区分度、创新性）
 * - strategy: 策略质量（使用场景适配度、配置合理性）
 * - validation: 验证完整性（测试覆盖、验证命令执行结果）
 */

import type { AssetType } from '../shared/types';

// ===== GDI Scoring Dimensions =====

/**
 * GDI评分维度
 * 每个维度 0-100 分
 */
export interface GDIDimensions {
  /** 结构完整性：代码结构、模块化、依赖关系质量 */
  structural: number;
  /** 语义正确性：功能符合描述、逻辑正确性 */
  semantic: number;
  /** 特异性：与现有资产的区分度、创新性 */
  specificity: number;
  /** 策略质量：使用场景适配度、配置合理性 */
  strategy: number;
  /** 验证完整性：测试覆盖、验证命令执行结果 */
  validation: number;
}

/**
 * 可配置的GDI权重
 */
export interface GDIWeights {
  structural: number;
  semantic: number;
  specificity: number;
  strategy: number;
  validation: number;
}

/**
 * GDI评分配置
 */
export interface GDIConfig {
  weights: GDIWeights;
  thresholds: {
    promotion: number;
    archive: number;
    minConfidence: number;
  };
}

/**
 * 原始资产数据（用于评分计算）
 */
export interface AssetForScoring {
  asset_id: string;
  asset_type: AssetType;
  name: string;
  description: string;
  content: string | null;
  signals: string[];
  author_id: string;
  downloads: number;
  rating: number;
  version: number;
  carbon_cost: number;
  parent_id: string | null;
  generation: number;
  ancestors: string[];
  fork_count: number;
  config: Record<string, unknown> | null;
  gene_ids: string[] | null;
  created_at: Date | string;
  updated_at: Date | string;
  validation_results?: ValidationResult[];
  test_coverage?: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  type: 'syntax' | 'security' | 'unit_test' | 'integration' | 'benchmark';
  passed: boolean;
  score: number; // 0-100
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * GDI评分结果
 */
export interface GDIScoreResult {
  asset_id: string;
  asset_type: AssetType;
  overall: number;
  dimensions: GDIDimensions;
  weights: GDIWeights;
  confidence: number;
  gdi_mean: number;
  gdi_lower: number;
  calculated_at: string;
  metadata: GDIScoreMetadata;
}

/**
 * 评分元数据
 */
export interface GDIScoreMetadata {
  content_length: number;
  signal_count: number;
  unique_signals: number;
  validation_passed: number;
  validation_total: number;
  lineage_depth: number;
  fork_count: number;
  age_days: number;
}

/**
 * 评分请求
 */
export interface ScoreRequest {
  asset: AssetForScoring;
  /** 可选：自定义权重（覆盖默认配置） */
  customWeights?: Partial<GDIWeights>;
  /** 可选：包含的现有资产列表（用于特异性计算） */
  existingAssets?: AssetForScoring[];
}

/**
 * 批量评分请求
 */
export interface BatchScoreRequest {
  assets: AssetForScoring[];
  customWeights?: Partial<GDIWeights>;
}

/**
 * 批量评分响应
 */
export interface BatchScoreResult {
  scores: GDIScoreResult[];
  failed: Array<{ asset_id: string; error: string }>;
  calculated_at: string;
}

/**
 * 评分历史记录
 */
export interface GDIScoreHistory {
  asset_id: string;
  history: GDIScoreSnapshot[];
}

/**
 * 单次评分快照
 */
export interface GDIScoreSnapshot {
  overall: number;
  dimensions: GDIDimensions;
  calculated_at: string;
}

// ===== Default Configuration =====

export const DEFAULT_GDI_WEIGHTS: GDIWeights = {
  structural: 0.20,
  semantic: 0.25,
  specificity: 0.20,
  strategy: 0.15,
  validation: 0.20,
};

export const DEFAULT_GDI_CONFIG: GDIConfig = {
  weights: DEFAULT_GDI_WEIGHTS,
  thresholds: {
    promotion: 70,
    archive: 20,
    minConfidence: 0.5,
  },
};

// ===== Validation Constants =====

export const STRUCTURAL_SCORE_BENCHMARKS = {
  min_content_length: 100,
  ideal_content_length: 5000,
  max_content_length: 100000,
  min_signals: 1,
  max_signals: 20,
  module_bonus: 10,
  documentation_bonus: 5,
} as const;

export const SEMANTIC_SCORE_BENCHMARKS = {
  name_min_length: 3,
  name_max_length: 100,
  description_min_length: 10,
  description_max_length: 5000,
  signals_match_bonus: 15,
  clarity_penalty_factor: 0.5,
} as const;

export const SPECIFICITY_SCORE_BENCHMARKS = {
  min_unique_signals: 2,
  novelty_bonus: 10,
  ancestor_penalty: 2, // per ancestor
  fork_bonus: 3, // per fork
  max_ancestor_penalty: 20,
  max_fork_bonus: 15,
} as const;

export const STRATEGY_SCORE_BENCHMARKS = {
  ideal_carbon_cost: 10,
  version_bonus: 2, // per version
  max_version_bonus: 10,
  config_complexity_penalty: 0.1,
  type_penalty: {
    gene: 0,
    capsule: 5,
    recipe: 10,
  },
} as const;

export const VALIDATION_SCORE_BENCHMARKS = {
  test_coverage_weight: 0.6,
  validation_result_weight: 0.4,
  min_test_coverage: 0.3,
  ideal_test_coverage: 0.8,
  syntax_penalty: 30,
  security_penalty: 50,
  benchmark_bonus: 10,
} as const;
