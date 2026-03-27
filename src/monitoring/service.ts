/**
 * Monitoring Service - Dashboard, Alerts, and Logging
 */

import { randomUUID } from 'crypto';

// ============ Types ============

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'node_offline' | 'quarantine' | 'low_credits' | 'swarm_timeout' | 'high_error_rate';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  node_id?: string;
  created_at: number;
  acknowledged: boolean;
  resolved_at?: number;
}

export interface LogEntry {
  id: string;
  type: 'a2a_message' | 'credit_change' | 'node_status' | 'asset_publish' | 'system';
  message: string;
  node_id?: string;
  metadata?: Record<string, any>;
  created_at: number;
}

export interface DashboardMetrics {
  total_nodes: number;
  online_nodes: number;
  offline_nodes: number;
  quarantined_nodes: number;
  active_swarms: number;
  total_assets: number;
  average_gdi: number;
  total_credits: number;
  alerts_triggered_24h: number;
  uptime_seconds: number;
}

// ============ Stores ============

const alerts: Map<string, Alert> = new Map();
const logs: LogEntry[] = [];
const alertRules: Map<string, AlertRule> = new Map();

// ============ Alert Types ============

export interface AlertRule {
  id: string;
  type: AlertType;
  enabled: boolean;
  threshold?: number;
  cooldown_ms: number;
  last_triggered?: number;
}

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: 'node_offline', type: 'node_offline', enabled: true, cooldown_ms: 300000 },
  { id: 'quarantine', type: 'quarantine', enabled: true, cooldown_ms: 60000 },
  { id: 'low_credits', type: 'low_credits', enabled: true, threshold: 100, cooldown_ms: 3600000 },
  { id: 'swarm_timeout', type: 'swarm_timeout', enabled: true, cooldown_ms: 300000 },
];

// Initialize alert rules
for (const rule of DEFAULT_ALERT_RULES) {
  alertRules.set(rule.id, rule);
}

// ============ Alert Operations ============

export function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  message: string,
  nodeId?: string
): Alert {
  const alert: Alert = {
    id: `alert_${randomUUID().slice(0, 8)}`,
    type,
    severity,
    message,
    node_id: nodeId,
    created_at: Date.now(),
    acknowledged: false,
  };
  
  alerts.set(alert.id, alert);
  logEvent('system', `Alert triggered: ${message}`, nodeId, { alert_id: alert.id, type, severity });
  
  return alert;
}

export function getAlert(id: string): Alert | undefined {
  return alerts.get(id);
}

export function getActiveAlerts(): Alert[] {
  return Array.from(alerts.values())
    .filter(a => !a.resolved_at)
    .sort((a, b) => b.created_at - a.created_at);
}

export function getAlertsByType(type: AlertType): Alert[] {
  return Array.from(alerts.values())
    .filter(a => a.type === type && !a.resolved_at);
}

export function acknowledgeAlert(id: string): boolean {
  const alert = alerts.get(id);
  if (!alert) return false;
  alert.acknowledged = true;
  return true;
}

export function resolveAlert(id: string): boolean {
  const alert = alerts.get(id);
  if (!alert) return false;
  alert.resolved_at = Date.now();
  return true;
}

export function resolveAlertsByNode(nodeId: string): number {
  let count = 0;
  for (const alert of alerts.values()) {
    if (alert.node_id === nodeId && !alert.resolved_at) {
      alert.resolved_at = Date.now();
      count++;
    }
  }
  return count;
}

export function shouldTriggerAlert(ruleId: string): boolean {
  const rule = alertRules.get(ruleId);
  if (!rule || !rule.enabled) return false;
  
  if (rule.last_triggered) {
    const elapsed = Date.now() - rule.last_triggered;
    if (elapsed < rule.cooldown_ms) return false;
  }
  
  return true;
}

export function recordAlertTrigger(ruleId: string): void {
  const rule = alertRules.get(ruleId);
  if (rule) {
    rule.last_triggered = Date.now();
  }
}

// ============ Logging ============

export function logEvent(
  type: LogEntry['type'],
  message: string,
  nodeId?: string,
  metadata?: Record<string, any>
): LogEntry {
  const entry: LogEntry = {
    id: `log_${randomUUID().slice(0, 8)}`,
    type,
    message,
    node_id: nodeId,
    metadata,
    created_at: Date.now(),
  };
  
  logs.push(entry);
  
  // Keep only last 10000 entries
  if (logs.length > 10000) {
    logs.splice(0, logs.length - 10000);
  }
  
  return entry;
}

export function getLogs(options?: {
  type?: LogEntry['type'];
  node_id?: string;
  since?: number;
  limit?: number;
}): LogEntry[] {
  let result = [...logs];
  
  if (options?.type) {
    result = result.filter(l => l.type === options.type);
  }
  
  if (options?.node_id) {
    result = result.filter(l => l.node_id === options.node_id);
  }
  
  if (options?.since) {
    result = result.filter(l => l.created_at >= options.since!);
  }
  
  result.sort((a, b) => b.created_at - a.created_at);
  
  if (options?.limit) {
    result = result.slice(0, options.limit);
  }
  
  return result;
}

// ============ Dashboard Metrics ============

export function getDashboardMetrics(): DashboardMetrics {
  const now = Date.now();
  const activeAlerts = getActiveAlerts();
  
  return {
    total_nodes: 0, // Would be populated from node registry
    online_nodes: 0,
    offline_nodes: 0,
    quarantined_nodes: activeAlerts.filter(a => a.type === 'quarantine').length,
    active_swarms: 0,
    total_assets: 0,
    average_gdi: 0,
    total_credits: 0,
    alerts_triggered_24h: alerts.size,
    uptime_seconds: Math.floor((now - startTime) / 1000),
  };
}

const startTime = Date.now();

// ============ Predefined Alert Triggers ============

export function alertNodeOffline(nodeId: string): Alert | undefined {
  if (!shouldTriggerAlert('node_offline')) return undefined;
  recordAlertTrigger('node_offline');
  return createAlert('node_offline', 'warning', `Node ${nodeId} is offline`, nodeId);
}

export function alertQuarantine(nodeId: string): Alert | undefined {
  if (!shouldTriggerAlert('quarantine')) return undefined;
  recordAlertTrigger('quarantine');
  return createAlert('quarantine', 'critical', `Node ${nodeId} has been quarantined`, nodeId);
}

export function alertLowCredits(nodeId: string, balance: number): Alert | undefined {
  if (!shouldTriggerAlert('low_credits')) return undefined;
  const rule = alertRules.get('low_credits');
  if (balance >= (rule?.threshold || 100)) return undefined;
  recordAlertTrigger('low_credits');
  return createAlert('low_credits', 'warning', `Node ${nodeId} has low credits: ${balance}`, nodeId);
}

export function alertSwarmTimeout(swarmId: string): Alert | undefined {
  if (!shouldTriggerAlert('swarm_timeout')) return undefined;
  recordAlertTrigger('swarm_timeout');
  return createAlert('swarm_timeout', 'critical', `Swarm ${swarmId} has timed out`, swarmId);
}

// ============ Statistics ============

export function getAlertStats(): {
  total: number;
  active: number;
  by_type: Record<AlertType, number>;
  by_severity: Record<AlertSeverity, number>;
  last_24h: number;
} {
  const allAlerts = Array.from(alerts.values());
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  
  for (const alert of allAlerts) {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
  }
  
  return {
    total: allAlerts.length,
    active: allAlerts.filter(a => !a.resolved_at).length,
    by_type: byType as any,
    by_severity: bySeverity as any,
    last_24h: allAlerts.filter(a => a.created_at >= dayAgo).length,
  };
}
