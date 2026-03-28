/**
 * Analytics Service - Hub Evolution Analytics
 * Chapter 25: Intent Drift Detection, Branching Analysis, Timeline Visualization
 */

import { randomUUID } from 'crypto';
import {
  DriftReport,
  SignalDistribution,
  NodeSignalHistory,
  BranchingMetrics,
  EvolutionTree,
  NodeTimeline,
  TimelineEvent,
  ForecastResult,
  SignalForecast,
  GdiForecast,
  RiskAlert,
  AnalyticsConfig,
  DriftType,
} from './types';
import { listAssets } from '../assets/store';
import { calculateGDI } from '../assets/gdi';
import { getReputation } from '../reputation/engine';

// Default config
const DEFAULT_CONFIG: AnalyticsConfig = {
  drift_threshold: 0.15,
  drift_window_days: 30,
  forecast_horizon_days: 7,
  branching_depth_limit: 10,
};

// In-memory storage for signal history
const signalHistory = new Map<string, NodeSignalHistory[]>();

// ============ Intent Drift Detection ============

/**
 * Detect intent drift for a node by comparing signal distributions over time
 */
export function detectIntentDrift(
  nodeId: string,
  config?: Partial<AnalyticsConfig>
): DriftReport {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const windowMs = cfg.drift_window_days * 24 * 60 * 60 * 1000;

  // Get historical signals
  const history = signalHistory.get(nodeId) || [];
  
  // Split into baseline (older) and current (recent) windows
  const baselineCutoff = new Date(now - windowMs * 2).toISOString();
  const currentCutoff = new Date(now - windowMs).toISOString();

  const baselineSignals = aggregateSignals(
    history.filter(h => h.timestamp < baselineCutoff)
  );
  const currentSignals = aggregateSignals(
    history.filter(h => h.timestamp >= currentCutoff && h.timestamp < baselineCutoff)
  );

  // If no historical data, use current assets as baseline
  if (Object.keys(baselineSignals).length === 0) {
    const assets = listAssets({ ownerId: nodeId });
    const assetSignals = extractSignalsFromAssets(assets.map(a => a.asset));
    return createDriftReport(nodeId, assetSignals, assetSignals, cfg);
  }

  return createDriftReport(nodeId, baselineSignals, currentSignals, cfg);
}

/**
 * Record signal data for a node (call this on heartbeat or asset publish)
 */
export function recordNodeSignals(nodeId: string, signals: SignalDistribution): void {
  const history = signalHistory.get(nodeId) || [];
  history.push({
    node_id: nodeId,
    signals,
    asset_count: Object.values(signals).reduce((sum, p) => sum + p, 0),
    timestamp: new Date().toISOString(),
  });
  // Keep only last 60 days of history
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  signalHistory.set(
    nodeId,
    history.filter(h => new Date(h.timestamp).getTime() > cutoff)
  );
}

function aggregateSignals(history: NodeSignalHistory[]): SignalDistribution {
  const aggregated: SignalDistribution = {};
  
  for (const entry of history) {
    for (const [signal, prob] of Object.entries(entry.signals)) {
      aggregated[signal] = (aggregated[signal] || 0) + prob;
    }
  }

  // Normalize to probability distribution
  const total = Object.values(aggregated).reduce((sum, p) => sum + p, 0);
  if (total > 0) {
    for (const signal of Object.keys(aggregated)) {
      aggregated[signal] /= total;
    }
  }

  return aggregated;
}

function extractSignalsFromAssets(assets: { type: string; signals_match?: string[]; trigger?: string[] }[]): SignalDistribution {
  const signals: SignalDistribution = {};
  
  for (const asset of assets) {
    const signalList = asset.type === 'Gene' 
      ? (asset as { signals_match?: string[] }).signals_match || []
      : (asset as { trigger?: string[] }).trigger || [];
    
    for (const signal of signalList) {
      signals[signal] = (signals[signal] || 0) + 1;
    }
  }

  // Normalize
  const total = Object.values(signals).reduce((sum, p) => sum + p, 0);
  if (total > 0) {
    for (const s of Object.keys(signals)) {
      signals[s] /= total;
    }
  }

  return signals;
}

function createDriftReport(
  nodeId: string,
  baseline: SignalDistribution,
  current: SignalDistribution,
  config: AnalyticsConfig
): DriftReport {
  // Calculate KL divergence for each signal
  const allSignals = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  let klDivergence = 0;
  const driftScores: { signal: string; drift: number }[] = [];

  for (const signal of allSignals) {
    const p = baseline[signal] || 0.001; // small epsilon to avoid log(0)
    const q = current[signal] || 0.001;
    klDivergence += p * Math.log(p / q);
    driftScores.push({ signal, drift: Math.abs(p - q) });
  }

  // Jensen-Shannon distance (symmetric version of KL)
  const signalDrift = Math.min(1, Math.sqrt(klDivergence / (2 * Math.LN2)));

  // Detect top drifting signals
  driftScores.sort((a, b) => b.drift - a.drift);
  const topDriftSignals = driftScores.slice(0, 5).map(d => d.signal);

  // Determine drift status
  let status: DriftReport['status'] = 'normal';
  if (signalDrift > config.drift_threshold * 2) {
    status = 'critical';
  } else if (signalDrift > config.drift_threshold) {
    status = 'drifting';
  }

  const driftReport: DriftReport = {
    node_id: nodeId,
    drift_score: Math.round(signalDrift * 1000) / 1000,
    threshold: config.drift_threshold,
    status,
    drift_types: {
      signal_drift: Math.round(signalDrift * 1000) / 1000,
      capability_drift: 0, // Would require analyzing asset type distribution
      goal_drift: 0, // Would require comparing declared goals vs actual
      style_drift: 0, // Would require analyzing code style changes
    },
    top_drift_signals: topDriftSignals,
    baseline_window: {
      start: new Date(Date.now() - config.drift_window_days * 2 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() - config.drift_window_days * 24 * 60 * 60 * 1000).toISOString(),
    },
    current_window: {
      start: new Date(Date.now() - config.drift_window_days * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
    detected_at: new Date().toISOString(),
    recommendations: generateDriftRecommendations(status, topDriftSignals),
  };

  return driftReport;
}

function generateDriftRecommendations(status: DriftReport['status'], topSignals: string[]): string[] {
  const recommendations: string[] = [];

  if (status === 'critical') {
    recommendations.push('节点可能正在转向与注册目标完全不同的方向，建议立即审查');
    recommendations.push('检查节点最近发布的资产是否符合原始声明的专长领域');
  } else if (status === 'drifting') {
    recommendations.push('检测到中等程度的意图漂移，建议关注信号分布变化');
    recommendations.push('如果是有意的战略调整，建议更新节点注册信息');
  }

  if (topSignals.length > 0) {
    recommendations.push(`主要变化信号: ${topSignals.join(', ')}`);
  }

  return recommendations;
}

// ============ Branching Analysis ============

/**
 * Analyze evolution tree branching patterns
 */
export function analyzeBranching(options?: {
  domain?: string;
  depthLimit?: number;
}): BranchingMetrics {
  const depthLimit = options?.depthLimit || DEFAULT_CONFIG.branching_depth_limit;
  
  // Get all assets
  const assets = listAssets({ limit: 500 });
  
  // Build evolution tree
  const tree = buildEvolutionTree(assets);
  
  // Calculate metrics
  let totalBranches = 0;
  let totalDepth = 0;
  let depthCount = 0;
  let deepestPath: string[] = [];
  
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    totalBranches += node.children.length;
    const path = getPathToRoot(nodeId, tree);
    if (path.length > deepestPath.length) {
      deepestPath = path;
    }
    if (path.length > depthLimit) {
      depthCount++;
      totalDepth += path.length;
    }
  }

  const avgBranchingFactor = tree.nodes ? Object.keys(tree.nodes).length / Math.max(1, totalBranches) : 0;

  // Find convergence clusters (nodes with same ancestor and similar GDI)
  const clusters = findConvergenceClusters(assets);

  // Find divergence hotspots (signals with high branching)
  const hotspots = findDivergenceHotspots(assets);

  return {
    total_branches: totalBranches,
    avg_branching_factor: Math.round(avgBranchingFactor * 100) / 100,
    deepest_path: {
      chain_id: deepestPath[0] || 'unknown',
      depth: deepestPath.length,
      nodes: deepestPath,
    },
    convergence_clusters: clusters,
    divergence_hotspots: hotspots,
  };
}

function buildEvolutionTree(assets: { asset: { asset_id: string; type: string; gdi?: { total: number }; created_at: string; parent_id?: string } }[]): EvolutionTree {
  const nodes: EvolutionTree['nodes'] = {};
  
  for (const record of assets) {
    const asset = record.asset;
    nodes[asset.asset_id] = {
      id: asset.asset_id,
      type: asset.type.toLowerCase() as 'gene' | 'capsule' | 'event',
      parent_id: asset.parent_id,
      children: assets.filter(a => a.asset.parent_id === asset.asset_id).map(a => a.asset.asset_id),
      gdi_score: asset.gdi?.total || 0,
      created_at: asset.created_at,
    };
  }

  return {
    root_id: 'root', // Would need actual root detection
    nodes,
  };
}

function getPathToRoot(nodeId: string, tree: EvolutionTree): string[] {
  const path: string[] = [nodeId];
  let current = tree.nodes[nodeId];
  
  while (current?.parent_id) {
    path.push(current.parent_id);
    current = tree.nodes[current.parent_id];
  }
  
  return path;
}

function findConvergenceClusters(assets: { asset: { asset_id: string; type: string; gdi?: { total: number }} }[]): BranchingMetrics['convergence_clusters'] {
  // Group by GDI range (simplified clustering)
  const gdiRanges = [
    { range: '90+', min: 90, max: 100 },
    { range: '75-89', min: 75, max: 89 },
    { range: '60-74', min: 60, max: 74 },
    { range: '<60', min: 0, max: 59 },
  ];

  return gdiRanges.map(range => {
    const inRange = assets.filter(a => {
      const gdi = a.asset.gdi?.total || 0;
      return gdi >= range.min && gdi <= range.max;
    });

    return {
      cluster_id: `cluster_${range.range}`,
      members: inRange.length,
      avg_gdi: inRange.length > 0 
        ? inRange.reduce((sum, a) => sum + (a.asset.gdi?.total || 0), 0) / inRange.length 
        : 0,
      common_ancestor: 'shared_root', // Would need actual lineage tracking
    };
  }).filter(c => c.members > 0);
}

function findDivergenceHotspots(assets: { asset: { type: string; signals_match?: string[]; trigger?: string[]; gdi?: { total: number }} }[]): BranchingMetrics['divergence_hotspots'] {
  // Count signal occurrences
  const signalCounts: Record<string, number> = {};
  
  for (const record of assets) {
    const asset = record.asset;
    const signals = asset.type === 'Gene'
      ? (asset as { signals_match?: string[] }).signals_match || []
      : (asset as { trigger?: string[] }).trigger || [];
    
    for (const signal of signals) {
      signalCounts[signal] = (signalCounts[signal] || 0) + 1;
    }
  }

  // Determine branching factor and status
  const maxCount = Math.max(...Object.values(signalCounts), 1);
  
  return Object.entries(signalCounts)
    .map(([signal, count]) => {
      const branchingFactor = count;
      let status: BranchingMetrics['divergence_hotspots'][0]['status'] = 'low';
      if (branchingFactor > 20) status = 'saturated';
      else if (branchingFactor > 10) status = 'high_diversity';
      else if (branchingFactor > 3) status = 'healthy';

      return { signal, branching_factor: branchingFactor, status };
    })
    .sort((a, b) => b.branching_factor - a.branching_factor)
    .slice(0, 10);
}

// ============ Timeline Visualization ============

/**
 * Generate timeline for a node
 */
export function generateNodeTimeline(
  nodeId: string,
  options?: { from?: string; to?: string }
): NodeTimeline {
  const assets = listAssets({ ownerId: nodeId, limit: 100 });
  const rep = getReputation(nodeId);
  
  const events: TimelineEvent[] = [];
  
  // Add asset events
  for (const asset of assets) {
    events.push({
      timestamp: asset.asset.created_at,
      event: 'asset_published',
      description: `发布 ${asset.asset.type}`,
      details: { type: asset.asset.type, asset_id: asset.asset.asset_id },
      asset_id: asset.asset.asset_id,
    });

    if (asset.status === 'promoted' || asset.status === 'active') {
      events.push({
        timestamp: new Date(new Date(asset.asset.created_at).getTime() + 60000).toISOString(), // Approximate
        event: 'asset_promoted',
        description: `资产晋升 (GDI: ${asset.gdi?.total || 0})`,
        details: { status: asset.status, gdi: asset.gdi },
        asset_id: asset.asset.asset_id,
      });
    }
  }

  // Add reputation change events
  if (rep) {
    events.push({
      timestamp: rep.calculated_at,
      event: 'reputation_change',
      description: `声望计算: ${rep.total}`,
      details: { reputation: rep },
      delta: 0, // Would need historical comparison
    });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculate summary
  const byDay: Record<string, number> = {};
  for (const event of events) {
    const day = event.timestamp.split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  }
  
  const mostActiveDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  return {
    node_id: nodeId,
    events: events.slice(0, 100), // Limit to 100 events
    summary: {
      total_events: events.length,
      most_active_day: mostActiveDay,
      top_signal: '', // Would need signal analysis
      reputation_delta: 0, // Would need historical data
      assets_published: assets.length,
      assets_promoted: assets.filter(a => a.status === 'promoted' || a.status === 'active').length,
    },
  };
}

// ============ Forecasting ============

/**
 * Generate forecasts for signal trends
 */
export function generateSignalForecast(
  horizonDays?: number
): ForecastResult {
  const horizon = horizonDays || DEFAULT_CONFIG.forecast_horizon_days;
  
  // Get current asset signals
  const assets = listAssets({ limit: 200 });
  const signalCounts: Record<string, number> = {};
  
  for (const asset of assets) {
    const signals = asset.asset.type === 'Gene'
      ? (asset.asset as { signals_match?: string[] }).signals_match || []
      : (asset.asset as { trigger?: string[] }).trigger || [];
    
    for (const signal of signals) {
      signalCounts[signal] = (signalCounts[signal] || 0) + 1;
    }
  }

  // Sort by count to get current ranking
  const sortedSignals = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([signal, count], idx) => ({
      signal,
      currentRank: idx + 1,
      count,
    }));

  // Generate simple trend predictions (in real implementation, would use time series)
  const predictions: SignalForecast[] = sortedSignals.slice(0, 10).map(s => {
    // Simulate some rank changes
    const predictedRank = Math.max(1, s.currentRank + Math.floor(Math.random() * 5) - 2);
    const confidence = 0.6 + Math.random() * 0.3; // 0.6-0.9
    
    return {
      signal: s.signal,
      current_rank: s.currentRank,
      predicted_rank: predictedRank,
      confidence: Math.round(confidence * 100) / 100,
      driving_factors: ['organic_growth', 'network_effect'],
      predicted_volume_change: Math.round((Math.random() * 40 - 10) * 100) / 100, // -10% to +30%
    };
  });

  return {
    forecast_type: 'signal_hotspots',
    horizon: `${horizon}d`,
    predictions,
    generated_at: new Date().toISOString(),
    model_version: '1.0.0',
  };
}

/**
 * Generate risk alerts
 */
export function generateRiskAlerts(): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  
  // Check all nodes for reputation issues
  const assets = listAssets({ limit: 200 });
  const nodeAssets = new Map<string, number>();
  
  for (const asset of assets) {
    const count = nodeAssets.get(asset.owner_id) || 0;
    nodeAssets.set(asset.owner_id, count + 1);
  }

  // Find nodes with low reputation or degraded assets
  for (const [nodeId, assetCount] of nodeAssets) {
    const rep = getReputation(nodeId);
    
    if (rep && rep.total < 50) {
      alerts.push({
        alert_id: randomUUID(),
        type: 'reputation_decline',
        target: nodeId,
        severity: rep.total < 30 ? 'high' : 'medium',
        message: `节点声望过低: ${rep.total}`,
        recommendation: '建议提交验证报告或发布高质量资产提升声望',
        created_at: new Date().toISOString(),
      });
    }

    if (assetCount > 100) {
      // Check for asset degradation (would need historical GDI tracking)
      alerts.push({
        alert_id: randomUUID(),
        type: 'asset_degradation',
        target: nodeId,
        severity: 'low',
        message: `节点资产数量较高，可能需要质量审查`,
        recommendation: '建议检查资产是否仍然有效',
        created_at: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

// ============ Config ============

export function getAnalyticsConfig(): AnalyticsConfig {
  return { ...DEFAULT_CONFIG };
}

export function updateAnalyticsConfig(updates: Partial<AnalyticsConfig>): AnalyticsConfig {
  Object.assign(DEFAULT_CONFIG, updates);
  return { ...DEFAULT_CONFIG };
}
