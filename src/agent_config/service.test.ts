import {
  definePermission,
  defineConstraint,
  definePreference,
  validateConfig,
  getDefaultConfig,
  checkPermission,
  enforceConstraint,
  applyPreference,
  auditAction,
  getAuditLogs,
  saveAgentConfig,
  getAgentConfig,
  upsertAgentConfig,
  deleteAgentConfig,
  updateAgentPermissions,
  updateAgentConstraints,
  updateAgentPreferences,
  canAgentPerform,
  checkAgentConstraints,
  _resetTestState,
} from './service';

describe('Agent Config Service', () => {
  beforeEach(() => {
    _resetTestState();
  });

  // ===== definePermission =====
  describe('definePermission', () => {
    it('should register a permission with all fields', () => {
      const perm = definePermission({
        name: 'Publish Gene',
        scope: 'publish',
        description: 'Allows publishing genes',
      });

      expect(perm.id).toBeDefined();
      expect(perm.name).toBe('Publish Gene');
      expect(perm.scope).toBe('publish');
      expect(perm.description).toBe('Allows publishing genes');
      expect(perm.created_at).toBeDefined();
    });

    it('should generate unique IDs for each permission', () => {
      const p1 = definePermission({ name: 'A', scope: 'read', description: 'desc' });
      const p2 = definePermission({ name: 'B', scope: 'write', description: 'desc' });
      expect(p1.id).not.toBe(p2.id);
    });
  });

  // ===== defineConstraint =====
  describe('defineConstraint', () => {
    it('should register a constraint with params', () => {
      const constraint = defineConstraint({
        name: 'Rate Limit Per Minute',
        type: 'rate_limit',
        params: { max: 100, window_ms: 60000 },
        description: 'Limits requests per minute',
      });

      expect(constraint.id).toBeDefined();
      expect(constraint.name).toBe('Rate Limit Per Minute');
      expect(constraint.type).toBe('rate_limit');
      expect(constraint.params).toEqual({ max: 100, window_ms: 60000 });
    });
  });

  // ===== definePreference =====
  describe('definePreference', () => {
    it('should register a preference with a typed value', () => {
      const pref = definePreference({
        name: 'Default Model',
        type: 'model',
        value: 'gpt-4',
        description: 'Preferred LLM model',
      });

      expect(pref.id).toBeDefined();
      expect(pref.name).toBe('Default Model');
      expect(pref.type).toBe('model');
      expect(pref.value).toBe('gpt-4');
    });
  });

  // ===== getDefaultConfig =====
  describe('getDefaultConfig', () => {
    it('should return a valid default config for an agent', () => {
      const config = getDefaultConfig('agent-001');

      expect(config.agent_id).toBe('agent-001');
      expect(config.permissions.permissions).toContain('read');
      expect(config.constraints.max_rate_per_minute).toBe(5);
      expect(config.preferences.default_model).toBe('gpt-4');
      expect(config.preferences.timeout_ms).toBe(30000);
      expect(config.version).toBe(1);
    });
  });

  // ===== validateConfig =====
  describe('validateConfig', () => {
    it('should pass for a valid config object', () => {
      const config = getDefaultConfig('agent-001');
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when agent_id is missing', () => {
      const config = { permissions: { permissions: [] } } as any;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'agent_id')).toBe(true);
    });

    it('should fail when permissions is missing', () => {
      const config = { agent_id: 'agent-001' } as any;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'permissions')).toBe(true);
    });

    it('should fail when max_rate_per_minute is invalid', () => {
      const config = {
        agent_id: 'agent-001',
        permissions: { permissions: ['read'] },
        constraints: { max_rate_per_minute: -5, max_content_length: 50000 },
        preferences: { timeout_ms: 30000 },
      } as any;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'constraints.max_rate_per_minute')).toBe(true);
    });

    it('should warn when max_content_length is very large', () => {
      const config = {
        agent_id: 'agent-001',
        permissions: { permissions: ['read'] },
        constraints: { max_rate_per_minute: 5, max_content_length: 600000 },
        preferences: { timeout_ms: 30000 },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'LARGE_LIMIT')).toBe(true);
    });
  });

  // ===== upsertAgentConfig / getAgentConfig =====
  describe('upsertAgentConfig', () => {
    it('should create and return a default config', () => {
      const config = upsertAgentConfig('new-agent');
      expect(config.agent_id).toBe('new-agent');
    });

    it('should return existing config without overwriting', () => {
      upsertAgentConfig('existing-agent');
      const updated = saveAgentConfig({
        ...getDefaultConfig('existing-agent'),
        preferences: { ...getDefaultConfig('existing-agent').preferences, default_model: 'claude-3' },
      });
      expect(updated.preferences.default_model).toBe('claude-3');

      const second = upsertAgentConfig('existing-agent');
      expect(second.preferences.default_model).toBe('claude-3');
    });
  });

  // ===== saveAgentConfig / getAgentConfig =====
  describe('saveAgentConfig', () => {
    it('should save and retrieve a config', () => {
      const config = { ...getDefaultConfig('save-test-agent') };
      const saved = saveAgentConfig(config);
      expect(saved.version).toBe(2);
    });
  });

  describe('getAgentConfig', () => {
    it('should return the saved config', () => {
      saveAgentConfig(getDefaultConfig('get-test-agent'));
      const config = getAgentConfig('get-test-agent');
      expect(config.agent_id).toBe('get-test-agent');
    });
  });

  describe('deleteAgentConfig', () => {
    it('should delete an existing config', () => {
      upsertAgentConfig('delete-test-agent');
      deleteAgentConfig('delete-test-agent');
      expect(() => getAgentConfig('delete-test-agent')).toThrow();
    });
  });

  // ===== checkPermission =====
  describe('checkPermission', () => {
    it('should return false for unknown agent', () => {
      expect(checkPermission('unknown-agent', 'read')).toBe(false);
    });

    it('should return true for granted permission', () => {
      upsertAgentConfig('perm-agent');
      updateAgentPermissions('perm-agent', ['read', 'write']);
      expect(checkPermission('perm-agent', 'read')).toBe(true);
      expect(checkPermission('perm-agent', 'write')).toBe(true);
      expect(checkPermission('perm-agent', 'delete')).toBe(false);
    });

    it('should deny when permission is in denied list', () => {
      upsertAgentConfig('deny-agent');
      updateAgentPermissions('deny-agent', ['read', 'write'], ['write']);
      expect(checkPermission('deny-agent', 'read')).toBe(true);
      expect(checkPermission('deny-agent', 'write')).toBe(false);
    });
  });

  // ===== enforceConstraint =====
  describe('enforceConstraint', () => {
    it('should allow action within rate limits', () => {
      upsertAgentConfig('constraint-agent');
      const result = enforceConstraint('constraint-agent', 'publish');
      expect(result.allowed).toBe(true);
    });

    it('should reject when config is missing', () => {
      const result = enforceConstraint('nonexistent', 'read');
      expect(result.allowed).toBe(false);
      expect(result.violated_constraint).toBe('config_missing');
    });

    it('should reject content exceeding max length', () => {
      upsertAgentConfig('length-agent');
      const result = enforceConstraint('length-agent', 'publish', { content_length: 1000000 });
      expect(result.allowed).toBe(false);
      expect(result.violated_constraint).toBe('max_content_length');
    });
  });

  // ===== applyPreference =====
  describe('applyPreference', () => {
    it('should return default preferences for unknown agent', () => {
      const prefs = applyPreference('unknown-agent');
      expect(Object.keys(prefs)).toHaveLength(0);
    });

    it('should return merged preferences for known agent', () => {
      upsertAgentConfig('pref-agent');
      updateAgentPreferences('pref-agent', { default_model: 'claude-3' });
      const prefs = applyPreference('pref-agent');
      expect(prefs.model).toBe('claude-3');
      expect(prefs.timeout_ms).toBe(30000);
      expect(prefs.cache_enabled).toBe(true);
    });

    it('should merge context preferences', () => {
      upsertAgentConfig('ctx-agent');
      const prefs = applyPreference('ctx-agent', { custom_field: 'value' });
      expect(prefs.custom_field).toBe('value');
    });
  });

  // ===== auditAction =====
  describe('auditAction', () => {
    it('should create an audit log entry', () => {
      const log = auditAction('audit-agent', 'permission_check', { action: 'publish' });
      expect(log.audit_id).toBeDefined();
      expect(log.agent_id).toBe('audit-agent');
      expect(log.action).toBe('permission_check');
      expect(log.result).toBe('allowed');
    });

    it('should return logs for specific agent', () => {
      auditAction('log-agent', 'constraint_enforce');
      auditAction('log-agent', 'permission_check');
      auditAction('other-agent', 'permission_check');
      const logs = getAuditLogs('log-agent');
      expect(logs.every((l) => l.agent_id === 'log-agent')).toBe(true);
    });

    it('should limit logs returned', () => {
      for (let i = 0; i < 10; i++) {
        auditAction('limit-agent', 'permission_check');
      }
      const logs = getAuditLogs('limit-agent', 3);
      expect(logs.length).toBeLessThanOrEqual(3);
    });
  });

  // ===== updateAgentConstraints =====
  describe('updateAgentConstraints', () => {
    it('should override specific constraint fields', () => {
      upsertAgentConfig('constraint-update-agent');
      const updated = updateAgentConstraints('constraint-update-agent', {
        max_rate_per_minute: 50,
        max_content_length: 100000,
      });
      expect(updated.constraints.max_rate_per_minute).toBe(50);
      expect(updated.constraints.max_content_length).toBe(100000);
    });
  });

  // ===== High-level helpers =====
  describe('canAgentPerform / checkAgentConstraints', () => {
    it('canAgentPerform returns true for granted permission', () => {
      upsertAgentConfig('high-agent');
      updateAgentPermissions('high-agent', ['read', 'publish']);
      expect(canAgentPerform('high-agent', 'read')).toBe(true);
      expect(canAgentPerform('high-agent', 'publish')).toBe(true);
    });

    it('checkAgentConstraints returns true within limits', () => {
      upsertAgentConfig('hc-agent');
      expect(checkAgentConstraints('hc-agent', 'any-action')).toBe(true);
    });
  });
});
