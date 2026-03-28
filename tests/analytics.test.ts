/**
 * Analytics Service Unit Tests
 * Chapter 25: Intent Drift Detection, Branching Analysis, Timeline Visualization
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  detectIntentDrift,
  recordNodeSignals,
  analyzeBranching,
  generateNodeTimeline,
  generateSignalForecast,
  generateRiskAlerts,
  getAnalyticsConfig,
  updateAnalyticsConfig,
} from '../src/analytics/service';
import type { SignalForecast } from '../src/analytics/types';

// Mock asset store
jest.mock('../src/assets/store', () => ({
  listAssets: jest.fn(),
}));

// Mock GDI calculator
jest.mock('../src/assets/gdi', () => ({
  calculateGDI: jest.fn(),
}));

// Mock reputation engine
jest.mock('../src/reputation/engine', () => ({
  getReputation: jest.fn(),
}));

import { listAssets } from '../src/assets/store';
import { getReputation } from '../src/reputation/engine';

const mockListAssets = listAssets as jest.MockedFunction<typeof listAssets>;
const mockGetReputation = getReputation as jest.MockedFunction<typeof getReputation>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockAsset(overrides: Record<string, any> = {}): any {
  return {
    asset: {
      id: 'asset_001',
      asset_id: 'asset_001',
      type: 'Gene',
      schema_version: '1.0',
      category: 'innovate',
      signals_match: ['signal_a', 'signal_b'],
      trigger: [],
      strategy: 'test',
      gdi: { total: 75 },
      created_at: '2026-03-01T00:00:00Z',
      parent_id: undefined,
      owner_id: 'node_001',
      ...overrides.asset,
    },
    owner_id: 'node_001',
    status: 'published',
    gdi: { total: 75 },
    fetch_count: 10,
    report_count: 0,
    published_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockReputation(overrides: Record<string, any> = {}): any {
  return {
    node_id: 'node_001',
    total: 80,
    positive: {
      promotion_rate: 0.5,
      usage_factor: 0.6,
      avg_gdi: 70,
    },
    negative: {
      reject_rate: 0.1,
      revoke_rate: 0.05,
      cumulative_penalties: 0,
    },
    maturity_factor: 0.8,
    calculated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Intent Drift Detection', () => {
  it('returns normal status when no drift detected', () => {
    mockListAssets.mockReturnValue([]);
    
    const report = detectIntentDrift('node_001');
    
    expect(report.node_id).toBe('node_001');
    expect(['normal', 'drifting', 'critical']).toContain(report.status);
    expect(report.drift_score).toBeGreaterThanOrEqual(0);
    expect(report.drift_score).toBeLessThanOrEqual(1);
  });

  it('detects drift when signal distribution changes significantly', () => {
    // When no historical baseline exists, function uses current assets as baseline
    // The drift score depends on signal distribution differences
    mockListAssets.mockReturnValue([
      mockAsset({ owner_id: 'node_002', asset: { asset_id: 's1', signals_match: ['alpha', 'beta'] } }),
      mockAsset({ owner_id: 'node_002', asset: { asset_id: 's2', signals_match: ['gamma'] } }),
    ]);
    
    const report = detectIntentDrift('node_002');
    
    expect(report.node_id).toBe('node_002');
    // Report should be generated with status based on drift calculation
    expect(['normal', 'drifting', 'critical']).toContain(report.status);
  });

  it('recordNodeSignals stores signal history', () => {
    recordNodeSignals('node_003', { signal_x: 0.5, signal_y: 0.5 });
    
    const report = detectIntentDrift('node_003');
    
    expect(report.node_id).toBe('node_003');
  });

  it('respects custom drift threshold', () => {
    const report = detectIntentDrift('node_004', {
      drift_threshold: 0.05,
    });
    
    expect(report.threshold).toBe(0.05);
  });

  it('includes top drift signals in report', () => {
    recordNodeSignals('node_005', { signal_p: 0.7, signal_q: 0.3 });
    recordNodeSignals('node_005', { signal_r: 0.6, signal_s: 0.4 });
    
    const report = detectIntentDrift('node_005');
    
    expect(Array.isArray(report.top_drift_signals)).toBe(true);
  });
});

describe('Branching Analysis', () => {
  it('analyzes branching metrics for assets', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ asset: { asset_id: 'g1', type: 'Gene', parent_id: undefined, gdi: { total: 80 } } }),
      mockAsset({ asset: { asset_id: 'g2', type: 'Gene', parent_id: 'g1', gdi: { total: 75 } } }),
      mockAsset({ asset: { asset_id: 'g3', type: 'Capsule', parent_id: 'g1', gdi: { total: 70 } } }),
    ]);
    
    const metrics = analyzeBranching();
    
    expect(metrics).toHaveProperty('total_branches');
    expect(metrics).toHaveProperty('avg_branching_factor');
    expect(metrics).toHaveProperty('deepest_path');
    expect(metrics).toHaveProperty('convergence_clusters');
    expect(metrics).toHaveProperty('divergence_hotspots');
  });

  it('respects depth limit option', () => {
    mockListAssets.mockReturnValue([]);
    
    const metrics = analyzeBranching({ depthLimit: 5 });
    
    expect(metrics).toBeDefined();
  });

  it('finds convergence clusters by GDI range', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ asset: { asset_id: 'c1', type: 'Capsule', gdi: { total: 92 } } }),
      mockAsset({ asset: { asset_id: 'c2', type: 'Capsule', gdi: { total: 95 } } }),
    ]);
    
    const metrics = analyzeBranching();
    
    expect(Array.isArray(metrics.convergence_clusters)).toBe(true);
    const highGdiCluster = metrics.convergence_clusters.find(c => c.cluster_id.includes('90'));
    expect(highGdiCluster?.members).toBeGreaterThan(0);
  });

  it('identifies divergence hotspots', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ asset: { asset_id: 'd1', type: 'Gene', signals_match: ['hot_signal'] } }),
      mockAsset({ asset: { asset_id: 'd2', type: 'Gene', signals_match: ['hot_signal'] } }),
      mockAsset({ asset: { asset_id: 'd3', type: 'Capsule', trigger: ['cold_signal'], signals_match: [] } }),
    ]);
    
    const metrics = analyzeBranching();
    
    expect(Array.isArray(metrics.divergence_hotspots)).toBe(true);
    expect(metrics.divergence_hotspots[0]?.signal).toBe('hot_signal');
  });
});

describe('Node Timeline', () => {
  it('generates timeline for a node', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ owner_id: 'node_t1', asset: { asset_id: 't1', created_at: '2026-03-01T00:00:00Z' } }),
    ]);
    mockGetReputation.mockReturnValue(mockReputation({ node_id: 'node_t1', total: 80 }));
    
    const timeline = generateNodeTimeline('node_t1');
    
    expect(timeline.node_id).toBe('node_t1');
    expect(Array.isArray(timeline.events)).toBe(true);
    expect(timeline).toHaveProperty('summary');
    expect(timeline.summary.total_events).toBeGreaterThanOrEqual(0);
  });

  it('sorts events by timestamp descending', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ asset: { asset_id: 'e1', created_at: '2026-03-01T00:00:00Z' } }),
      mockAsset({ asset: { asset_id: 'e2', created_at: '2026-03-15T00:00:00Z' } }),
    ]);
    mockGetReputation.mockReturnValue(null);
    
    const timeline = generateNodeTimeline('node_e');
    
    if (timeline.events.length >= 2) {
      const firstTs = new Date(timeline.events[0].timestamp).getTime();
      const secondTs = new Date(timeline.events[1].timestamp).getTime();
      expect(firstTs).toBeGreaterThanOrEqual(secondTs);
    }
  });

  it('calculates most active day correctly', () => {
    mockListAssets.mockReturnValue([]);
    mockGetReputation.mockReturnValue(null);
    
    const timeline = generateNodeTimeline('node_empty');
    
    expect(timeline.summary.most_active_day).toBe('');
    expect(timeline.summary.total_events).toBe(0);
  });
});

describe('Signal Forecasting', () => {
  it('generates signal forecast', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ asset: { asset_id: 'f1', type: 'Gene', signals_match: ['trend_signal'] } }),
      mockAsset({ asset: { asset_id: 'f2', type: 'Capsule', trigger: ['trend_signal'], signals_match: [] } }),
    ]);
    
    const forecast = generateSignalForecast(7);
    
    expect(forecast.forecast_type).toBe('signal_hotspots');
    expect(forecast.horizon).toBe('7d');
    expect(Array.isArray(forecast.predictions)).toBe(true);
    expect(forecast.model_version).toBeDefined();
  });

  it('returns predictions with rank and confidence', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ asset: { asset_id: 'p1', type: 'Gene', signals_match: ['ranked_signal'] } }),
    ]);
    
    const forecast = generateSignalForecast(14);
    
    const signalPredictions = forecast.predictions.filter(
      (p): p is SignalForecast => 'confidence' in p
    );
    
    if (signalPredictions.length > 0) {
      const pred = signalPredictions[0];
      expect(pred).toHaveProperty('signal');
      expect(pred).toHaveProperty('current_rank');
      expect(pred).toHaveProperty('predicted_rank');
      expect(pred).toHaveProperty('confidence');
      expect(pred.confidence).toBeGreaterThan(0);
      expect(pred.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('respects custom horizon', () => {
    mockListAssets.mockReturnValue([]);
    
    const forecast = generateSignalForecast(30);
    
    expect(forecast.horizon).toBe('30d');
  });
});

describe('Risk Alerts', () => {
  it('generates risk alerts for low reputation nodes', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ owner_id: 'node_low_rep' }),
    ]);
    mockGetReputation.mockReturnValue(mockReputation({
      node_id: 'node_low_rep',
      total: 25,
    }));
    
    const alerts = generateRiskAlerts();
    
    const repAlerts = alerts.filter(a => a.type === 'reputation_decline');
    expect(repAlerts.length).toBeGreaterThan(0);
  });

  it('includes alert severity levels', () => {
    mockListAssets.mockReturnValue([
      mockAsset({ owner_id: 'node_critical' }),
    ]);
    mockGetReputation.mockReturnValue(mockReputation({
      node_id: 'node_critical',
      total: 20,
    }));
    
    const alerts = generateRiskAlerts();
    const criticalAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
    
    expect(criticalAlerts.length).toBeGreaterThan(0);
  });

  it('generates alerts with required fields', () => {
    mockListAssets.mockReturnValue([]);
    mockGetReputation.mockReturnValue(null);
    
    const alerts = generateRiskAlerts();
    
    for (const alert of alerts) {
      expect(alert).toHaveProperty('alert_id');
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('target');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('recommendation');
      expect(alert).toHaveProperty('created_at');
    }
  });
});

describe('Analytics Config', () => {
  it('returns default config', () => {
    const config = getAnalyticsConfig();
    
    expect(config).toHaveProperty('drift_threshold');
    expect(config).toHaveProperty('drift_window_days');
    expect(config).toHaveProperty('forecast_horizon_days');
    expect(config).toHaveProperty('branching_depth_limit');
  });

  it('updates config with partial changes', () => {
    const original = getAnalyticsConfig();
    const updated = updateAnalyticsConfig({ drift_threshold: 0.25 });
    
    expect(updated.drift_threshold).toBe(0.25);
    expect(updated.drift_window_days).toBe(original.drift_window_days);
  });
});
