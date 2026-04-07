import type {
  Role,
  SecurityEvent,
  SecurityEventType,
  AnomalyReport,
  AnomalySignal,
} from './schemas';
import {
  ROLE_PERMISSIONS,
  DEFAULT_RATE_LIMITS,
} from './schemas';

export { ROLE_PERMISSIONS, DEFAULT_RATE_LIMITS };
import { ForbiddenError, ValidationError } from '../shared/errors';

// ===== In-memory stores =====
const roleAssignments = new Map<string, Role>();
const securityEvents: SecurityEvent[] = [];
const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();
const anomalyHistory = new Map<string, AnomalyReport[]>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ===== RBAC: Implement Permission Check =====
export function implementRBAC(
  role: Role,
  permission: string,
): { allowed: boolean; reason?: string } {
  const rolePerms = ROLE_PERMISSIONS.find(r => r.role === role);
  if (!rolePerms) {
    return { allowed: false, reason: `Role '${role}' not found in RBAC registry` };
  }

  // Wildcard admin permission
  if (rolePerms.permissions.includes('*')) {
    return { allowed: true };
  }

  if (rolePerms.permissions.includes(permission)) {
    return { allowed: true };
  }

  return { allowed: false, reason: `Permission '${permission}' not granted to role '${role}'` };
}

// ===== RBAC: Check Role Has Permission =====
export function roleHasPermission(role: Role, permission: string): boolean {
  return implementRBAC(role, permission).allowed;
}

// ===== RBAC: Assign Role to Node =====
export function assignRoleToNode(nodeId: string, role: Role): void {
  roleAssignments.set(nodeId, role);
}

export function getNodeRole(nodeId: string): Role | undefined {
  return roleAssignments.get(nodeId);
}

// ===== RBAC: Check Node Has Permission =====
export function checkNodePermission(nodeId: string, permission: string): boolean {
  const role = roleAssignments.get(nodeId);
  if (!role) return false;
  return roleHasPermission(role, permission);
}

// ===== Rate Limiting =====
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

export function checkRateLimit(
  identifier: string,
  maxRequests?: number,
): { allowed: boolean; remaining: number; resetInMs: number } {
  const limit = maxRequests ?? 100;
  const now = Date.now();
  const record = rateLimitCounters.get(identifier);

  if (!record || now >= record.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitCounters.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetInMs: RATE_LIMIT_WINDOW_MS };
  }

  record.count++;
  if (record.count >= limit) {
    record.count--;
    return {
      allowed: false,
      remaining: 0,
      resetInMs: record.resetAt - now,
    };
  }
  return {
    allowed: true,
    remaining: limit - 1 - record.count,
    resetInMs: record.resetAt - now,
  };
}

// ===== Rate Limit per Role =====
export function checkRateLimitByRole(
  identifier: string,
  role: Role,
): { allowed: boolean; remaining: number; resetInMs: number } {
  const limits = DEFAULT_RATE_LIMITS[role];
  if (!limits) {
    return checkRateLimit(identifier, 20); // fallback to guest
  }
  return checkRateLimit(identifier, limits.max_requests);
}

// ===== Security Logging =====
export function logSecurityEvent(
  event: {
    type: SecurityEventType;
    identifier: string;
    details?: Record<string, unknown>;
    severity?: 'info' | 'warning' | 'error' | 'critical';
  },
): SecurityEvent {
  const record: SecurityEvent = {
    event_id: generateId(),
    type: event.type,
    identifier: event.identifier,
    details: event.details ?? {},
    severity: event.severity ?? 'info',
    timestamp: new Date().toISOString(),
    resolved: false,
  };
  securityEvents.push(record);

  // Keep only last 10000 events
  if (securityEvents.length > 10_000) {
    securityEvents.splice(0, securityEvents.length - 10_000);
  }

  return record;
}

// ===== Get Security Events =====
export function getSecurityEvents(
  filters?: {
    identifier?: string;
    type?: SecurityEventType;
    severity?: string;
    limit?: number;
  },
): SecurityEvent[] {
  let events = [...securityEvents];

  if (filters?.identifier) {
    events = events.filter(e => e.identifier === filters.identifier);
  }
  if (filters?.type) {
    events = events.filter(e => e.type === filters.type);
  }
  if (filters?.severity) {
    events = events.filter(e => e.severity === filters.severity);
  }

  return events.slice(-(filters?.limit ?? 100));
}

// ===== Resolve Security Event =====
export function resolveSecurityEvent(eventId: string): SecurityEvent | null {
  const event = securityEvents.find(e => e.event_id === eventId);
  if (!event) return null;
  event.resolved = true;
  return event;
}

// ===== Anomaly Detection =====
export function detectAnomaly(
  nodeId: string,
  signals?: Array<{
    signal_type: AnomalySignal['signal_type'];
    score: number;
    description: string;
  }>,
): AnomalyReport {
  const detectedSignals: AnomalySignal[] = [];
  let overallScore = 0;

  if (signals) {
    for (const s of signals) {
      detectedSignals.push({
        node_id: nodeId,
        signal_type: s.signal_type,
        score: s.score,
        description: s.description,
        detected_at: new Date().toISOString(),
      });
      overallScore = Math.max(overallScore, s.score);
    }
  }

  const status: AnomalyReport['status'] =
    overallScore >= 0.8 ? 'critical'
    : overallScore >= 0.5 ? 'suspicious'
    : 'normal';

  const recommendations: string[] = [];
  if (overallScore >= 0.5) {
    recommendations.push('Review recent activity for this node');
  }
  if (overallScore >= 0.8) {
    recommendations.push('Consider temporary isolation or quarantine');
    recommendations.push('Alert security team immediately');
  }

  const report: AnomalyReport = {
    node_id: nodeId,
    signals: detectedSignals,
    overall_score: overallScore,
    status,
    recommendations,
  };

  // Store history
  const existing = anomalyHistory.get(nodeId) ?? [];
  existing.push(report);
  if (existing.length > 100) existing.splice(0, existing.length - 100);
  anomalyHistory.set(nodeId, existing);

  return report;
}

// ===== Simple Anomaly Heuristics =====
export function detectAnomalyFromHistory(
  nodeId: string,
  eventWindow: SecurityEvent[],
): AnomalyReport {
  const nodeEvents = eventWindow.filter(e => e.identifier === nodeId);

  if (nodeEvents.length === 0) {
    return { node_id: nodeId, signals: [], overall_score: 0, status: 'normal', recommendations: [] };
  }

  const signals: AnomalySignal[] = [];
  const recentWindow = 5 * 60 * 1000; // 5 minutes

  // Unusual volume
  const recentEvents = nodeEvents.filter(
    e => Date.now() - new Date(e.timestamp).getTime() < recentWindow,
  );
  if (recentEvents.length > 50) {
    signals.push({
      node_id: nodeId,
      signal_type: 'unusual_volume',
      score: Math.min(1, recentEvents.length / 200),
      description: `High event volume: ${recentEvents.length} events in 5 minutes`,
      detected_at: new Date().toISOString(),
    });
  }

  // Auth failures
  const authFailures = nodeEvents.filter(e => e.type === 'auth_failure');
  if (authFailures.length >= 5) {
    signals.push({
      node_id: nodeId,
      signal_type: 'unusual_pattern',
      score: Math.min(1, authFailures.length / 20),
      description: `Multiple auth failures: ${authFailures.length} in window`,
      detected_at: new Date().toISOString(),
    });
  }

  // Rate limit violations
  const rateViolations = nodeEvents.filter(e => e.type === 'rate_limit_exceeded');
  if (rateViolations.length >= 3) {
    signals.push({
      node_id: nodeId,
      signal_type: 'unusual_pattern',
      score: Math.min(1, rateViolations.length / 10),
      description: `Rate limit violations: ${rateViolations.length} in window`,
      detected_at: new Date().toISOString(),
    });
  }

  const overallScore = signals.reduce((max, s) => Math.max(max, s.score), 0);
  const status: AnomalyReport['status'] =
    overallScore >= 0.8 ? 'critical'
    : overallScore >= 0.5 ? 'suspicious'
    : 'normal';

  return {
    node_id: nodeId,
    signals,
    overall_score: overallScore,
    status,
    recommendations: overallScore >= 0.5
      ? ['Review recent activity for this node']
      : overallScore >= 0.8
      ? ['Review recent activity for this node', 'Consider temporary isolation']
      : [],
  };
}

// ===== Get Anomaly History =====
export function getAnomalyHistory(nodeId: string): AnomalyReport[] {
  return anomalyHistory.get(nodeId) ?? [];
}

// ===== Clear Rate Limit Counter =====
export function clearRateLimit(identifier: string): void {
  rateLimitCounters.delete(identifier);
}

// ===== Test support =====
export function _resetTestState(): void {
  roleAssignments.clear();
  securityEvents.length = 0;
  rateLimitCounters.clear();
  anomalyHistory.clear();
}
