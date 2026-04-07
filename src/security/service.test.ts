import {
  implementRBAC,
  roleHasPermission,
  assignRoleToNode,
  getNodeRole,
  checkNodePermission,
  checkRateLimit,
  checkRateLimitByRole,
  logSecurityEvent,
  getSecurityEvents,
  resolveSecurityEvent,
  detectAnomaly,
  detectAnomalyFromHistory,
  getAnomalyHistory,
  clearRateLimit,
  ROLE_PERMISSIONS,
  _resetTestState,
} from './service';

describe('Security Service', () => {
  beforeEach(() => {
    _resetTestState();
  });

  // ===== implementRBAC =====
  describe('implementRBAC', () => {
    it('should allow wildcard admin permission', () => {
      const result = implementRBAC('admin', 'anything');
      expect(result.allowed).toBe(true);
    });

    it('should allow granted permission', () => {
      const result = implementRBAC('developer', 'publish');
      expect(result.allowed).toBe(true);
    });

    it('should deny missing permission', () => {
      const result = implementRBAC('user', 'delete');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should return error for unknown role', () => {
      const result = implementRBAC('nonexistent_role' as any, 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  // ===== roleHasPermission =====
  describe('roleHasPermission', () => {
    it('should return true for valid permission', () => {
      expect(roleHasPermission('user', 'read')).toBe(true);
      expect(roleHasPermission('validator', 'kg_read')).toBe(true);
    });

    it('should return false for invalid permission', () => {
      expect(roleHasPermission('guest', 'write')).toBe(false);
    });
  });

  // ===== Role assignment =====
  describe('assignRoleToNode / getNodeRole', () => {
    it('should assign and retrieve role', () => {
      assignRoleToNode('node-001', 'developer');
      expect(getNodeRole('node-001')).toBe('developer');
    });

    it('should return undefined for unassigned node', () => {
      expect(getNodeRole('unassigned-node')).toBeUndefined();
    });
  });

  // ===== checkNodePermission =====
  describe('checkNodePermission', () => {
    it('should return true when node role has permission', () => {
      assignRoleToNode('perm-node-1', 'developer');
      expect(checkNodePermission('perm-node-1', 'publish')).toBe(true);
    });

    it('should return false when node role lacks permission', () => {
      assignRoleToNode('perm-node-2', 'guest');
      expect(checkNodePermission('perm-node-2', 'write')).toBe(false);
    });

    it('should return false for unassigned node', () => {
      expect(checkNodePermission('unknown-node', 'read')).toBe(false);
    });
  });

  // ===== Rate Limiting =====
  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('rate-limit-test-1', 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should allow up to limit', () => {
      const id = 'rate-limit-test-2';
      for (let i = 0; i < 3; i++) {
        const r = checkRateLimit(id, 4);
        expect(r.allowed).toBe(true);
      }
      const r = checkRateLimit(id, 4);
      expect(r.allowed).toBe(false);
      expect(r.remaining).toBe(0);
    });

    it('should reset after window', () => {
      const id = 'rate-limit-reset';
      checkRateLimit(id, 2);
      const r = checkRateLimit(id, 2);
      expect(r.allowed).toBe(false);
    });
  });

  describe('checkRateLimitByRole', () => {
    it('should use role-specific limits', () => {
      const id = 'role-limit-test';
      const result = checkRateLimitByRole(id, 'admin');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(1000);
    });

    it('should fall back to guest limits for unknown role', () => {
      const id = 'unknown-role-limit';
      const result = checkRateLimitByRole(id, 'unknown_role' as any);
      expect(result.allowed).toBe(true);
    });
  });

  describe('clearRateLimit', () => {
    it('should reset counter after clear', () => {
      const id = 'clear-test';
      for (let i = 0; i < 3; i++) checkRateLimit(id, 2);
      clearRateLimit(id);
      const r = checkRateLimit(id, 2);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(1);
    });
  });

  // ===== Security Events =====
  describe('logSecurityEvent', () => {
    it('should create and return a security event', () => {
      const event = logSecurityEvent({
        type: 'auth_failure',
        identifier: 'node-100',
        details: { reason: 'invalid_token' },
        severity: 'warning',
      });

      expect(event.event_id).toBeDefined();
      expect(event.type).toBe('auth_failure');
      expect(event.identifier).toBe('node-100');
      expect(event.severity).toBe('warning');
      expect(event.resolved).toBe(false);
      expect(event.timestamp).toBeDefined();
    });

    it('should default severity to info', () => {
      const event = logSecurityEvent({
        type: 'auth_success',
        identifier: 'node-101',
      });
      expect(event.severity).toBe('info');
    });
  });

  describe('getSecurityEvents', () => {
    it('should return all events by default', () => {
      logSecurityEvent({ type: 'auth_success', identifier: 'e1' });
      logSecurityEvent({ type: 'auth_failure', identifier: 'e2' });
      const events = getSecurityEvents();
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by identifier', () => {
      logSecurityEvent({ type: 'auth_success', identifier: 'filter-node' });
      logSecurityEvent({ type: 'auth_failure', identifier: 'other-node' });
      const filtered = getSecurityEvents({ identifier: 'filter-node' });
      expect(filtered.every((e) => e.identifier === 'filter-node')).toBe(true);
    });

    it('should filter by type', () => {
      logSecurityEvent({ type: 'permission_denied', identifier: 'type-node' });
      const filtered = getSecurityEvents({ type: 'permission_denied' });
      expect(filtered.every((e) => e.type === 'permission_denied')).toBe(true);
    });

    it('should filter by severity', () => {
      logSecurityEvent({ type: 'auth_failure', identifier: 'sev-node', severity: 'critical' });
      const filtered = getSecurityEvents({ severity: 'critical' });
      expect(filtered.every((e) => e.severity === 'critical')).toBe(true);
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        logSecurityEvent({ type: 'auth_success', identifier: `limit-${i}` });
      }
      const limited = getSecurityEvents({ limit: 3 });
      expect(limited.length).toBeLessThanOrEqual(3);
    });
  });

  describe('resolveSecurityEvent', () => {
    it('should mark event as resolved', () => {
      const event = logSecurityEvent({ type: 'auth_failure', identifier: 'resolve-node' });
      const resolved = resolveSecurityEvent(event.event_id);
      expect(resolved).not.toBeNull();
      expect(resolved!.resolved).toBe(true);
    });

    it('should return null for unknown event', () => {
      const result = resolveSecurityEvent('nonexistent-event-id');
      expect(result).toBeNull();
    });
  });

  // ===== Anomaly Detection =====
  describe('detectAnomaly', () => {
    it('should return normal status with no signals', () => {
      const report = detectAnomaly('normal-node');
      expect(report.status).toBe('normal');
      expect(report.overall_score).toBe(0);
      expect(report.signals).toHaveLength(0);
    });

    it('should return suspicious status for moderate signals', () => {
      const report = detectAnomaly('suspicious-node', [
        { signal_type: 'unusual_volume', score: 0.6, description: 'High volume' },
      ]);
      expect(report.status).toBe('suspicious');
      expect(report.overall_score).toBe(0.6);
      expect(report.recommendations).toContain('Review recent activity for this node');
    });

    it('should return critical status and recommendations for high score', () => {
      const report = detectAnomaly('critical-node', [
        { signal_type: 'intent_drift', score: 0.9, description: 'Drift detected' },
      ]);
      expect(report.status).toBe('critical');
      expect(report.overall_score).toBe(0.9);
      expect(report.recommendations).toContain('Consider temporary isolation or quarantine');
    });
  });

  describe('detectAnomalyFromHistory', () => {
    it('should return normal for node with no events', () => {
      const report = detectAnomalyFromHistory('clean-node', []);
      expect(report.status).toBe('normal');
      expect(report.overall_score).toBe(0);
    });

    it('should detect unusual volume signal', () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        event_id: `ev-${i}`,
        type: 'auth_success' as const,
        identifier: 'volume-node',
        details: {},
        severity: 'info' as const,
        timestamp: new Date().toISOString(),
        resolved: false,
      }));
      const report = detectAnomalyFromHistory('volume-node', events);
      expect(report.signals.some((s) => s.signal_type === 'unusual_volume')).toBe(true);
    });

    it('should detect multiple auth failures', () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        event_id: `fail-${i}`,
        type: 'auth_failure' as const,
        identifier: 'fail-node',
        details: {},
        severity: 'warning' as const,
        timestamp: new Date().toISOString(),
        resolved: false,
      }));
      const report = detectAnomalyFromHistory('fail-node', events);
      expect(report.signals.some((s) => s.signal_type === 'unusual_pattern')).toBe(true);
    });
  });

  describe('getAnomalyHistory', () => {
    it('should return empty array for node with no history', () => {
      expect(getAnomalyHistory('no-history-node')).toEqual([]);
    });

    it('should return anomaly history for node', () => {
      detectAnomaly('history-node', [{ signal_type: 'unusual_pattern', score: 0.5, description: 'Test' }]);
      const history = getAnomalyHistory('history-node');
      expect(history.length).toBe(1);
      expect(history[0]!.node_id).toBe('history-node');
    });
  });

  // ===== ROLE_PERMISSIONS completeness =====
  describe('ROLE_PERMISSIONS', () => {
    it('should have all expected roles defined', () => {
      const roles = ROLE_PERMISSIONS.map((r) => r.role);
      expect(roles).toContain('admin');
      expect(roles).toContain('developer');
      expect(roles).toContain('user');
      expect(roles).toContain('guest');
      expect(roles).toContain('validator');
      expect(roles).toContain('council_member');
    });

    it('should have no duplicate roles', () => {
      const roles = ROLE_PERMISSIONS.map((r) => r.role);
      const unique = new Set(roles);
      expect(unique.size).toBe(roles.length);
    });
  });
});
