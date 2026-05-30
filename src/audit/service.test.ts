import * as auditService from './service';

afterEach(() => auditService._resetTestState());

describe('Audit Service', () => {
  describe('emitAuditEvent', () => {
    it('creates an audit event with all fields', () => {
      const event = auditService.emitAuditEvent({
        category: 'asset_management',
        severity: 'info',
        actor_type: 'user',
        actor_id: 'user_123',
        actor_name: 'Alice',
        actor_ip: '192.168.1.1',
        action: 'asset.publish',
        resource_type: 'asset',
        resource_id: 'asset_abc',
        outcome: 'success',
        metadata: { asset_name: 'My Gene' },
      });
      expect(event.event_id).toMatch(/^aud_/);
      expect(event.category).toBe('asset_management');
      expect(event.actor_id).toBe('user_123');
      expect(event.outcome).toBe('success');
      expect(event.timestamp).toBeDefined();
    });

    it('auto-sets severity to error on failure', () => {
      const event = auditService.emitAuditEvent({
        category: 'authentication',
        actor_type: 'user',
        actor_id: 'user_1',
        action: 'login',
        resource_type: 'session',
        resource_id: 'sess_1',
        outcome: 'failure',
        error_code: 'INVALID_PASSWORD',
      });
      expect(event.severity).toBe('error');
      expect(event.error_code).toBe('INVALID_PASSWORD');
    });

    // ===== SECURITY TESTS =====
    it('sanitizes invalid category to default', () => {
      const event = auditService.emitAuditEvent({
        category: 'invalid_category' as any,
        actor_type: 'user',
        actor_id: 'user_1',
        action: 'test',
        resource_type: 'asset',
        resource_id: 'r1',
        outcome: 'success',
      });
      expect(event.category).toBe('security_event'); // Falls back to default
    });

    it('sanitizes oversized strings to max length', () => {
      const longString = 'x'.repeat(10000);
      const event = auditService.emitAuditEvent({
        category: 'asset_management',
        actor_type: 'user',
        actor_id: longString,
        actor_name: longString,
        actor_ip: '192.168.1.1',
        action: 'test',
        resource_type: 'asset',
        resource_id: 'r1',
        outcome: 'success',
      });
      expect(event.actor_id.length).toBeLessThanOrEqual(128);
      expect(event.actor_name!.length).toBeLessThanOrEqual(256);
    });

    it('strips control characters from strings', () => {
      const withControlChars = 'test\x00\x07\x08string';
      const event = auditService.emitAuditEvent({
        category: 'asset_management',
        actor_type: 'user',
        actor_id: 'user_1',
        actor_name: withControlChars,
        action: 'test',
        resource_type: 'asset',
        resource_id: 'r1',
        outcome: 'success',
      });
      expect(event.actor_name).not.toContain('\x00');
      expect(event.actor_name).not.toContain('\x07');
    });

    it('rejects invalid IP addresses', () => {
      const event = auditService.emitAuditEvent({
        category: 'asset_management',
        actor_type: 'user',
        actor_id: 'user_1',
        actor_ip: 'not-an-ip-address<script>alert(1)</script>',
        action: 'test',
        resource_type: 'asset',
        resource_id: 'r1',
        outcome: 'success',
      });
      expect(event.actor_ip).toBeUndefined(); // Invalid IPs are stripped
    });

    it('accepts valid IPv4 addresses', () => {
      const event = auditService.emitAuditEvent({
        category: 'asset_management',
        actor_type: 'user',
        actor_id: 'user_1',
        actor_ip: '10.0.0.1',
        action: 'test',
        resource_type: 'asset',
        resource_id: 'r1',
        outcome: 'success',
      });
      expect(event.actor_ip).toBe('10.0.0.1');
    });

    it('caps duration_ms to prevent overflow', () => {
      const event = auditService.emitAuditEvent({
        category: 'asset_management',
        actor_type: 'user',
        actor_id: 'user_1',
        action: 'test',
        resource_type: 'asset',
        resource_id: 'r1',
        outcome: 'success',
        duration_ms: 999999999999,
      });
      expect(event.duration_ms).toBeLessThanOrEqual(86400000); // Max 24h
    });

    it('prevents prototype pollution in metadata', () => {
      const event = auditService.emitAuditEvent({
        category: 'asset_management',
        actor_type: 'user',
        actor_id: 'user_1',
        action: 'test',
        resource_type: 'asset',
        resource_id: 'r1',
        outcome: 'success',
        metadata: {
          safe_field: 'value',
          __proto__: { admin: true } as any,
          constructor: { prototype: { admin: true } } as any,
          nested: { __proto__: { xss: true } as any },
        },
      });
      // __proto__ and constructor keys should be absent
      expect(Object.keys(event.metadata as object)).not.toContain('__proto__');
      expect(Object.keys(event.metadata as object)).not.toContain('constructor');
      expect(Object.keys((event.metadata as any).nested || {})).not.toContain('__proto__');
    });

    it('generates non-guessable event IDs with crypto', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const event = auditService.emitAuditEvent({
          category: 'asset_management',
          actor_type: 'user',
          actor_id: `user_${i}`,
          action: 'test',
          resource_type: 'asset',
          resource_id: `r${i}`,
          outcome: 'success',
        });
        ids.add(event.event_id);
      }
      // All IDs should be unique
      expect(ids.size).toBe(100);
    });
  });

  describe('queryAuditEvents', () => {
    beforeEach(() => {
      auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u1', action: 'asset.publish', resource_type: 'asset', resource_id: 'a1', outcome: 'success' });
      auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u1', action: 'asset.delete', resource_type: 'asset', resource_id: 'a2', outcome: 'success' });
      auditService.emitAuditEvent({ category: 'authentication', actor_type: 'user', actor_id: 'u2', action: 'login', resource_type: 'session', resource_id: 's1', outcome: 'failure' });
    });

    it('returns all events by default', () => {
      const result = auditService.queryAuditEvents({ pagination: { page: 1, page_size: 50 } });
      expect(result.total).toBe(3);
      expect(result.events).toHaveLength(3);
    });

    it('filters by category', () => {
      const result = auditService.queryAuditEvents({
        categories: ['asset_management'],
        pagination: { page: 1, page_size: 50 },
      });
      expect(result.total).toBe(2);
    });

    it('filters by actor_id', () => {
      const result = auditService.queryAuditEvents({
        actor_ids: ['u1'],
        pagination: { page: 1, page_size: 50 },
      });
      expect(result.total).toBe(2);
    });

    it('filters by outcome', () => {
      const result = auditService.queryAuditEvents({
        outcomes: ['failure'],
        pagination: { page: 1, page_size: 50 },
      });
      expect(result.total).toBe(1);
    });

    it('filters by search_query', () => {
      const result = auditService.queryAuditEvents({
        search_query: 'publish',
        pagination: { page: 1, page_size: 50 },
      });
      expect(result.total).toBe(1);
      expect(result.events[0]?.action).toBe('asset.publish');
    });

    it('paginates results', () => {
      const result = auditService.queryAuditEvents({ pagination: { page: 1, page_size: 1 } });
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(3);
    });
  });

  describe('getAuditSummary', () => {
    it('aggregates events by category', () => {
      auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u1', action: 'publish', resource_type: 'asset', resource_id: 'a1', outcome: 'success' });
      auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u2', action: 'delete', resource_type: 'asset', resource_id: 'a2', outcome: 'failure' });
      auditService.emitAuditEvent({ category: 'authentication', actor_type: 'user', actor_id: 'u1', action: 'login', resource_type: 'session', resource_id: 's1', outcome: 'success' });
      const summary = auditService.getAuditSummary();
      const assetSummary = summary.find(s => s.category === 'asset_management');
      expect(assetSummary?.total_events).toBe(2);
      expect(assetSummary?.success_count).toBe(1);
      expect(assetSummary?.failure_count).toBe(1);
    });
  });

  describe('getDashboardStats', () => {
    it('returns correct stats', () => {
      for (let i = 0; i < 5; i++) {
        auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u1', action: 'test', resource_type: 'asset', resource_id: `a${i}`, outcome: 'success' });
      }
      auditService.emitAuditEvent({ category: 'security', actor_type: 'user', actor_id: 'u1', action: 'test', resource_type: 'asset', resource_id: 'x', outcome: 'failure', severity: 'critical' });
      const stats = auditService.getDashboardStats();
      expect(stats.total_events_24h).toBe(6);
      expect(stats.critical_events_24h).toBe(1);
    });
  });

  describe('exportAuditEvents', () => {
    it('exports as JSON', () => {
      auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u1', action: 'test', resource_type: 'asset', resource_id: 'a1', outcome: 'success' });
      const json = auditService.exportAuditEvents({ pagination: { page: 1, page_size: 10 } }, 'json');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].event_id).toBeDefined();
    });

    it('exports as CSV', () => {
      auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u1', action: 'test', resource_type: 'asset', resource_id: 'a1', outcome: 'success' });
      const csv = auditService.exportAuditEvents({ pagination: { page: 1, page_size: 10 } }, 'csv');
      expect(csv).toContain('"event_id"');
      expect(csv).toContain('"category"');
    });
  });

  describe('getAuditEvent', () => {
    it('retrieves event by ID', () => {
      const event = auditService.emitAuditEvent({ category: 'asset_management', actor_type: 'user', actor_id: 'u1', action: 'test', resource_type: 't', resource_id: 'r1', outcome: 'success' });
      const found = auditService.getAuditEvent(event.event_id);
      expect(found?.event_id).toBe(event.event_id);
      expect(auditService.getAuditEvent('unknown')).toBeNull();
    });
  });
});
