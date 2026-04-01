/**
 * Analytics API Endpoints
 * Chapter 25: Hub Evolution Analytics
 * 
 * Endpoints:
 * - GET /analytics/drift/:nodeId  Detect intent drift
 * - POST /analytics/drift/:nodeId/record  Record node signals
 * - GET /analytics/branching  Analyze branching patterns
 * - GET /analytics/timeline/:nodeId  Generate node timeline
 * - GET /analytics/forecast/signals  Forecast signal trends
 * - GET /analytics/alerts  Generate risk alerts
 * - GET /analytics/config  Get analytics config
 * - PATCH /analytics/config  Update analytics config
 */

import { Router } from 'express';
import { validateNodeSecret } from '../a2a/node';
import {
  detectIntentDrift,
  recordNodeSignals,
  analyzeBranching,
  generateNodeTimeline,
  generateSignalForecast,
  generateRiskAlerts,
  getAnalyticsConfig,
  updateAnalyticsConfig,
} from './service';
import { AnalyticsConfig, SignalDistribution } from './types';

const router = Router();

// Auth middleware
function requireAnalyticsAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
  }
  const nodeId = validateNodeSecret(auth.slice(7));
  if (!nodeId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
  }
  req.nodeId = nodeId;
  next();
}

// Optional auth (some endpoints are public)
function optionalAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const nodeId = validateNodeSecret(auth.slice(7));
    if (nodeId) {
      req.nodeId = nodeId;
    }
  }
  next();
}

// GET /analytics/drift/:nodeId - Detect intent drift for a node
router.get('/drift/:nodeId', optionalAuth, (req: any, res: any) => {
  const { nodeId } = req.params;
  const { threshold, window_days } = req.query;
  
  const config: Partial<AnalyticsConfig> = {};
  if (threshold) config.drift_threshold = parseFloat(threshold);
  if (window_days) config.drift_window_days = parseInt(window_days);
  
  const report = detectIntentDrift(nodeId, config);
  res.json({ drift_report: report });
});

// POST /analytics/drift/:nodeId/record - Record node signals
router.post('/drift/:nodeId/record', requireAnalyticsAuth, (req: any, res: any) => {
  const { nodeId } = req.params;
  const { signals } = req.body as { signals: SignalDistribution };
  
  if (!signals || typeof signals !== 'object') {
    return res.status(400).json({ 
      error: 'invalid_request', 
      message: 'Missing or invalid signals object',
      correction: 'Provide signals as a { signal_name: probability } object'
    });
  }
  
  recordNodeSignals(nodeId, signals);
  res.json({ status: 'recorded', node_id: nodeId });
});

// GET /analytics/branching - Analyze evolution tree branching
router.get('/branching', (req: any, res: any) => {
  const { domain, depth_limit } = req.query;
  
  const metrics = analyzeBranching({
    domain: domain as string,
    depthLimit: depth_limit ? parseInt(depth_limit as string) : undefined,
  });
  
  res.json({ branching_analysis: metrics });
});

// GET /analytics/timeline/:nodeId - Generate node timeline
router.get('/timeline/:nodeId', optionalAuth, (req: any, res: any) => {
  const { nodeId } = req.params;
  const { from, to } = req.query;
  
  const timeline = generateNodeTimeline(nodeId, {
    from: from as string,
    to: to as string,
  });
  
  res.json({ timeline });
});

// GET /analytics/forecast/signals - Forecast signal trends
router.get('/forecast/signals', (req: any, res: any) => {
  const { horizon_days } = req.query;
  
  const forecast = generateSignalForecast(
    horizon_days ? parseInt(horizon_days as string) : undefined
  );
  
  res.json({ forecast });
});

// GET /analytics/alerts - Generate risk alerts
router.get('/alerts', (req: any, res: any) => {
  const { severity } = req.query;
  
  const allAlerts = generateRiskAlerts();
  
  // Filter by severity if specified
  let alerts = allAlerts;
  if (severity) {
    alerts = allAlerts.filter(a => a.severity === severity);
  }
  
  res.json({ alerts });
});

// GET /analytics/config - Get analytics configuration
router.get('/config', (req: any, res: any) => {
  const config = getAnalyticsConfig();
  res.json({ config });
});

// PATCH /analytics/config - Update analytics configuration
router.patch('/config', requireAnalyticsAuth, (req: any, res: any) => {
  const updates = req.body as Partial<AnalyticsConfig>;
  
  // Validate inputs
  if (updates.drift_threshold !== undefined && (updates.drift_threshold < 0 || updates.drift_threshold > 1)) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'drift_threshold must be between 0 and 1',
    });
  }
  
  if (updates.drift_window_days !== undefined && (updates.drift_window_days < 1 || updates.drift_window_days > 365)) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'drift_window_days must be between 1 and 365',
    });
  }
  
  if (updates.forecast_horizon_days !== undefined && (updates.forecast_horizon_days < 1 || updates.forecast_horizon_days > 90)) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'forecast_horizon_days must be between 1 and 90',
    });
  }
  
  const config = updateAnalyticsConfig(updates);
  res.json({ config });
});

export default router;
