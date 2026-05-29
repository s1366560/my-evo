import { PrismaClient } from '@prisma/client';
import type {
  AuditEvent, AuditQuery, AuditQueryResult, AuditSummary,
  AuditCategory, AuditSeverity, AuditActorType,
} from './types';
import crypto from 'crypto';

let prisma = new PrismaClient();
export function setPrisma(client: PrismaClient): void { prisma = client; }

function genId(prefix: string): string {
  // FIX: Use crypto.randomBytes instead of Math.random for IDs
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

const MAX_EVENTS = 100_000;
const events: AuditEvent[] = [];

// ===== SECURITY FIX: Strict enum validation sets (must match ./types.ts) =====
const VALID_CATEGORIES = new Set<string>([
  'authentication','authorization','data_access','data_modification',
  'asset_management','node_management','credit_transaction','reputation_change',
  'admin_action','system_event','api_usage','export','batch','integration','security',
]);
const VALID_SEVERITIES = new Set<string>(['debug','info','warning','error','critical']);
const VALID_OUTCOMES = new Set<string>(['success','failure','partial']);
const VALID_ACTOR_TYPES = new Set<string>(['user','node','api_key','system','admin','service']);

// ===== SECURITY FIX: Input sanitization helpers =====

/** Sanitize string fields: remove control chars, null bytes, truncate to maxLen */
function sanitizeString(value: unknown, fieldName: string, maxLen = 2048): string {
  if (typeof value !== 'string') return '';
  // Remove null bytes and control chars except newlines/tabs
  let cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Truncate to max length
  if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen);
  return cleaned;
}

/** Validate and sanitize actor IP address (IPv4/IPv6) */
function sanitizeIP(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv4Regex.test(value) || ipv6Regex.test(value)) return value.slice(0, 45);
  return undefined;
}

/** Validate enum value against a set of allowed values */
function validateEnum<T extends string>(
  value: unknown,
  validSet: Set<string>,
  _fieldName: string,
): value is T {
  if (typeof value !== 'string' || !validSet.has(value)) return false;
  return true;
}

/** Sanitize pagination parameters with strict bounds */
function sanitizePagination(page?: unknown, pageSize?: unknown): { page: number; page_size: number } {
  const p = Math.max(1, Math.min(10000, Number(page) || 1));
  const s = Math.max(1, Math.min(1000, Number(pageSize) || 50));
  return { page: p, page_size: s };
}

/** Sanitize date range — enforce sensible bounds (2020–now) */
function sanitizeDateRange(dateFrom?: string, dateTo?: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date().toISOString();
  const minDate = '2020-01-01T00:00:00.000Z';
  return {
    dateFrom: dateFrom && dateFrom >= minDate && dateFrom <= now ? dateFrom : undefined,
    dateTo: dateTo && dateTo >= minDate && dateTo <= now ? dateTo : undefined,
  };
}

/** Sanitize array input — enforce max length and type */
function sanitizeArray<T>(arr: unknown, maxLen = 100): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxLen).filter((v) => typeof v === 'string') as T[];
}

/** Sanitize metadata recursively — prevent prototype pollution and depth DoS */
function sanitizeMetadata(meta: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const safeKey = sanitizeString(key, 'metadata.key', 128);
    if (!safeKey) continue;
    // Block prototype pollution
    if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') continue;
    if (value === null || value === undefined) {
      sanitized[safeKey] = null;
    } else if (typeof value === 'string') {
      sanitized[safeKey] = sanitizeString(value, `metadata.${key}`, 2048);
    } else if (typeof value === 'number') {
      sanitized[safeKey] = typeof value === 'bigint' ? Number(value) : value;
    } else if (typeof value === 'boolean') {
      sanitized[safeKey] = value;
    } else if (Array.isArray(value)) {
      sanitized[safeKey] = value.slice(0, 100).map((v) =>
        typeof v === 'string' ? sanitizeString(v, 'metadata.array', 1024) : v,
      );
    } else if (typeof value === 'object') {
      sanitized[safeKey] = sanitizeMetadata(value as Record<string, unknown>, depth + 1);
    }
  }
  return sanitized;
}

/** Sanitize diff records */
function sanitizeDiff(
  diff: Record<string, { before: unknown; after: unknown }>,
): Record<string, { before: unknown; after: unknown }> {
  const sanitized: Record<string, { before: unknown; after: unknown }> = {};
  for (const [key, value] of Object.entries(diff)) {
    const safeKey = sanitizeString(key, 'diff.key', 128);
    if (!safeKey) continue;
    sanitized[safeKey] = {
      before: typeof value.before === 'string'
        ? sanitizeString(value.before, 'diff.before', 2048)
        : value.before,
      after: typeof value.after === 'string'
        ? sanitizeString(value.after, 'diff.after', 2048)
        : value.after,
    };
  }
  return sanitized;
}

// ===== Emit Audit Event =====
export function emitAuditEvent(
  params: {
    category: AuditCategory;
    severity?: AuditSeverity;
    actor_type: AuditActorType;
    actor_id: string;
    actor_name?: string;
    actor_ip?: string;
    actor_user_agent?: string;
    action: string;
    resource_type: string;
    resource_id: string;
    resource_name?: string;
    outcome: 'success' | 'failure' | 'partial';
    error_code?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
    diff?: Record<string, { before: unknown; after: unknown }>;
    session_id?: string;
    api_key_id?: string;
    node_id?: string;
    request_id?: string;
    correlation_id?: string;
    duration_ms?: number;
  }
): AuditEvent {
  // Strict validation with fallback to safe defaults
  const category = validateEnum(params.category, VALID_CATEGORIES, 'category')
    ? params.category
    : 'security_event' as AuditCategory;
  const severity = params.severity && validateEnum(params.severity, VALID_SEVERITIES, 'severity')
    ? params.severity
    : (params.outcome === 'failure' ? 'error' : 'info');
  const outcome = validateEnum(params.outcome, VALID_OUTCOMES, 'outcome')
    ? params.outcome
    : 'failure';
  const actor_type = validateEnum(params.actor_type, VALID_ACTOR_TYPES, 'actor_type')
    ? params.actor_type
    : 'system' as AuditActorType;

  const event: AuditEvent = {
    event_id: genId('aud'),
    category,
    severity: severity as AuditSeverity,
    timestamp: new Date().toISOString(),
    actor_type: actor_type as AuditActorType,
    actor_id: sanitizeString(params.actor_id, 'actor_id', 128),
    actor_name: sanitizeString(params.actor_name, 'actor_name', 256),
    actor_ip: sanitizeIP(params.actor_ip),
    actor_user_agent: sanitizeString(params.actor_user_agent, 'actor_user_agent', 512),
    action: sanitizeString(params.action, 'action', 256),
    resource_type: sanitizeString(params.resource_type, 'resource_type', 128),
    resource_id: sanitizeString(params.resource_id, 'resource_id', 256),
    resource_name: sanitizeString(params.resource_name, 'resource_name', 512),
    outcome: outcome as 'success' | 'failure' | 'partial',
    error_code: sanitizeString(params.error_code, 'error_code', 64),
    error_message: sanitizeString(params.error_message, 'error_message', 1024),
    metadata: params.metadata ? sanitizeMetadata(params.metadata) : {},
    diff: params.diff ? sanitizeDiff(params.diff) : undefined,
    session_id: sanitizeString(params.session_id, 'session_id', 128),
    api_key_id: sanitizeString(params.api_key_id, 'api_key_id', 128),
    node_id: sanitizeString(params.node_id, 'node_id', 128),
    request_id: sanitizeString(params.request_id, 'request_id', 128),
    correlation_id: sanitizeString(params.correlation_id, 'correlation_id', 128),
    // FIX: Cap duration_ms to prevent injection via large numbers
    duration_ms: typeof params.duration_ms === 'number' && params.duration_ms >= 0
      ? Math.min(params.duration_ms, 86400000)
      : undefined,
  };
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  return event;
}

// ===== Query Audit Events =====
export function queryAuditEvents(q: AuditQuery): AuditQueryResult {
  const startMs = Date.now();
  let filtered = [...events];

  // Apply filters with sanitized/safe values
  if (q.categories?.length) {
    const validCats = sanitizeArray<AuditCategory>(q.categories, 20);
    filtered = filtered.filter(e => validCats.includes(e.category));
  }
  if (q.severities?.length) {
    const validSev = sanitizeArray<AuditSeverity>(q.severities, 10);
    filtered = filtered.filter(e => validSev.includes(e.severity));
  }
  if (q.actor_ids?.length) {
    const validActors = sanitizeArray<string>(q.actor_ids, 50);
    filtered = filtered.filter(e => validActors.includes(e.actor_id));
  }
  if (q.actor_types?.length) {
    const validTypes = sanitizeArray<AuditActorType>(q.actor_types, 10);
    filtered = filtered.filter(e => validTypes.includes(e.actor_type));
  }
  if (q.actions?.length) {
    const validActions = sanitizeArray<string>(q.actions, 50);
    filtered = filtered.filter(e => validActions.includes(e.action));
  }
  if (q.resource_types?.length) {
    const validTypes = sanitizeArray<string>(q.resource_types, 50);
    filtered = filtered.filter(e => validTypes.includes(e.resource_type));
  }
  if (q.resource_ids?.length) {
    const validIds = sanitizeArray<string>(q.resource_ids, 50);
    filtered = filtered.filter(e => validIds.includes(e.resource_id));
  }
  if (q.outcomes?.length) {
    const validOutcomes = sanitizeArray<'success' | 'failure' | 'partial'>(q.outcomes, 10);
    filtered = filtered.filter(e => validOutcomes.includes(e.outcome));
  }

  // Date range with bounds
  const { dateFrom, dateTo } = sanitizeDateRange(q.date_from, q.date_to);
  if (dateFrom) filtered = filtered.filter(e => e.timestamp >= dateFrom);
  if (dateTo) filtered = filtered.filter(e => e.timestamp <= dateTo);

  // Search query — sanitize and limit length
  if (q.search_query) {
    const safeQuery = sanitizeString(q.search_query, 'search_query', 256).toLowerCase();
    if (safeQuery) {
      filtered = filtered.filter(e =>
        e.action.toLowerCase().includes(safeQuery) ||
        e.resource_id.toLowerCase().includes(safeQuery) ||
        e.resource_name?.toLowerCase().includes(safeQuery) ||
        JSON.stringify(e.metadata).toLowerCase().includes(safeQuery),
      );
    }
  }

  if (!q.include_system) filtered = filtered.filter(e => e.actor_type !== 'system');
  if (!q.include_admin) filtered = filtered.filter(e => e.actor_type !== 'admin');

  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = filtered.length;
  const { page, page_size } = sanitizePagination(q.pagination?.page, q.pagination?.page_size);
  const pageItems = filtered.slice((page - 1) * page_size, page * page_size);

  return {
    events: pageItems,
    total, page, page_size,
    query_time_ms: Date.now() - startMs,
  };
}

// ===== Get Audit Summary =====
export function getAuditSummary(
  categories?: AuditCategory[],
  dateFrom?: string,
  dateTo?: string,
): AuditSummary[] {
  let filtered = [...events];
  if (categories?.length) {
    const validCats = sanitizeArray<AuditCategory>(categories, 20);
    filtered = filtered.filter(e => validCats.includes(e.category));
  }
  const { dateFrom: dFrom, dateTo: dTo } = sanitizeDateRange(dateFrom, dateTo);
  if (dFrom) filtered = filtered.filter(e => e.timestamp >= dFrom);
  if (dTo) filtered = filtered.filter(e => e.timestamp <= dTo);

  const byCategory = new Map<AuditCategory, AuditEvent[]>();
  for (const e of filtered) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e); byCategory.set(e.category, list);
  }

  return Array.from(byCategory.entries()).map(([cat, evts]) => {
    const actionCount = new Map<string, number>();
    const actorCount = new Map<string, number>();
    const resCount = new Map<string, number>();
    const actors = new Set<string>();
    const resources = new Set<string>();
    let success = 0, failure = 0;
    for (const e of evts) {
      actionCount.set(e.action, (actionCount.get(e.action) ?? 0) + 1);
      actorCount.set(e.actor_id, (actorCount.get(e.actor_id) ?? 0) + 1);
      resCount.set(e.resource_id, (resCount.get(e.resource_id) ?? 0) + 1);
      actors.add(e.actor_id);
      resources.add(e.resource_id);
      if (e.outcome === 'success') success++;
      else if (e.outcome === 'failure') failure++;
    }
    return {
      category: cat, total_events: evts.length,
      success_count: success, failure_count: failure,
      unique_actors: actors.size, unique_resources: resources.size,
      top_actions: Array.from(actionCount.entries()).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      top_actors: Array.from(actorCount.entries()).map(([actor_id, count]) => ({ actor_id, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      top_resources: Array.from(resCount.entries()).map(([resource_id, count]) => ({ resource_id, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    };
  });
}

// ===== Get Dashboard Stats =====
export function getDashboardStats(): {
  total_events_24h: number;
  total_events_7d: number;
  critical_events_24h: number;
  events_by_category: Record<AuditCategory, number>;
  events_by_severity: Record<AuditSeverity, number>;
  top_active_actors: { actor_id: string; count: number }[];
} {
  const now = Date.now();
  const h24 = now - 86400000;
  const d7 = now - 604800000;
  const c24 = new Date(h24).toISOString();
  const c7 = new Date(d7).toISOString();
  const last24 = events.filter(e => e.timestamp >= c24);
  const last7 = events.filter(e => e.timestamp >= c7);
  const byCat: Record<string, number> = {};
  const bySev: Record<string, number> = {};
  const actorCount = new Map<string, number>();
  for (const e of last24) {
    byCat[e.category] = (byCat[e.category] ?? 0) + 1;
    bySev[e.severity] = (bySev[e.severity] ?? 0) + 1;
    actorCount.set(e.actor_id, (actorCount.get(e.actor_id) ?? 0) + 1);
  }
  return {
    total_events_24h: last24.length,
    total_events_7d: last7.length,
    critical_events_24h: last24.filter(e => e.severity === 'critical').length,
    events_by_category: byCat as Record<AuditCategory, number>,
    events_by_severity: bySev as Record<AuditSeverity, number>,
    top_active_actors: Array.from(actorCount.entries()).map(([actor_id, count]) => ({ actor_id, count })).sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

// ===== Get Event by ID =====
export function getAuditEvent(eventId: string): AuditEvent | null {
  const safeId = sanitizeString(eventId, 'eventId', 128);
  return events.find(e => e.event_id === safeId) ?? null;
}

// ===== Export Audit Events =====
export function exportAuditEvents(q: AuditQuery, format: 'csv' | 'json'): string {
  const { events: evts } = queryAuditEvents(q);
  if (format === 'json') return JSON.stringify(evts, null, 2);
  // FIX: Was using `events` (outer variable, unbounded) instead of `evts` (scoped result) — caused by-variable-reference-bug
  const headers = ['event_id', 'category', 'severity', 'timestamp', 'actor_type', 'actor_id', 'action', 'resource_type', 'resource_id', 'outcome', 'error_code'];
  const rows = evts.map(e => headers.map(h => {
    const v = (e as unknown as Record<string, unknown>)[h];
    return v !== undefined ? `"${String(v).replace(/"/g, '""')}"` : '""';
  }).join(','));
  return [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
}

// ===== Test support =====
export function _resetTestState(): void { events.length = 0; }
