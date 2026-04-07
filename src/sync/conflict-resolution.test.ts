import * as conflictResolution from './conflict-resolution';
import type { ChangeVersion, ConflictRecord } from './types';

describe('Conflict Resolution', () => {
  // ===== detectConflicts =====

  describe('detectConflicts', () => {
    it('should skip when only local key exists (continue)', () => {
      const local: Record<string, ChangeVersion> = {
        'a-only-local': { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' },
      };
      const remote: Record<string, ChangeVersion> = {};
      const result = conflictResolution.detectConflicts(local, remote);
      expect(result.has_conflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should skip when only remote key exists (continue)', () => {
      const local: Record<string, ChangeVersion> = {};
      const remote: Record<string, ChangeVersion> = {
        'a-only-remote': { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' },
      };
      const result = conflictResolution.detectConflicts(local, remote);
      expect(result.has_conflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect conflicts when hashes differ but versions match', () => {
      const local: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' } };
      const remote: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' } };
      const result = conflictResolution.detectConflicts(local, remote);
      expect(result.has_conflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]!.asset_id).toBe('a-1');
    });

    it('should not flag conflicts when versions differ', () => {
      const local: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' } };
      const remote: Record<string, ChangeVersion> = { 'a-1': { version: 3, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' } };
      const result = conflictResolution.detectConflicts(local, remote);
      expect(result.has_conflicts).toBe(false);
    });

    it('should not flag conflicts when hashes match', () => {
      const local: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-same' } };
      const remote: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-2', content_hash: 'hash-same' } };
      const result = conflictResolution.detectConflicts(local, remote);
      expect(result.has_conflicts).toBe(false);
    });
  });

  // ===== mergeChanges =====

  describe('mergeChanges', () => {
    it('should use remoteVal when localVal is undefined', () => {
      const local: Record<string, unknown> = {};
      const remote: Record<string, unknown> = { key1: 'remote-value' };
      const result = conflictResolution.mergeChanges(local, remote, true);
      expect(result['key1']).toBe('remote-value');
    });

    it('should use localVal when remoteVal is undefined', () => {
      const local: Record<string, unknown> = { key1: 'local-value' };
      const remote: Record<string, unknown> = {};
      const result = conflictResolution.mergeChanges(local, remote, true);
      expect(result['key1']).toBe('local-value');
    });

    it('should recursively merge when both are objects', () => {
      const local: Record<string, unknown> = {
        meta: { name: 'local-name', tag: 'local-tag' },
        score: 10,
      };
      const remote: Record<string, unknown> = {
        meta: { name: 'remote-name', description: 'remote-desc' },
        score: 20,
      };
      const result = conflictResolution.mergeChanges(local, remote, true);
      // preferRemote=true: meta recursively merged, score from remote
      expect((result.meta as Record<string, unknown>)).toHaveProperty('name');
      expect((result.meta as Record<string, unknown>)).toHaveProperty('tag');
      expect((result.meta as Record<string, unknown>)).toHaveProperty('description');
      expect(result.score).toBe(20);
    });

    it('should prefer remote when preferRemote is true (non-object values)', () => {
      const local: Record<string, unknown> = { key1: 'local' };
      const remote: Record<string, unknown> = { key1: 'remote' };
      const result = conflictResolution.mergeChanges(local, remote, true);
      expect(result['key1']).toBe('remote');
    });

    it('should prefer local when preferRemote is false (non-object values)', () => {
      const local: Record<string, unknown> = { key1: 'local' };
      const remote: Record<string, unknown> = { key1: 'remote' };
      const result = conflictResolution.mergeChanges(local, remote, false);
      expect(result['key1']).toBe('local');
    });

    it('should handle mixed keys (some only in local, some only in remote)', () => {
      const local: Record<string, unknown> = { a: 1, c: 3 };
      const remote: Record<string, unknown> = { b: 2, c: 30 };
      const result = conflictResolution.mergeChanges(local, remote, true);
      expect(result['a']).toBe(1);
      expect(result['b']).toBe(2);
      expect(result['c']).toBe(30); // preferRemote
    });
  });

  // ===== resolveByLastWriteWins =====

  describe('resolveByLastWriteWins', () => {
    it('should prefer newer local version', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByLastWriteWins(local, remote)).toBe(local);
    });

    it('should prefer newer remote version', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByLastWriteWins(local, remote)).toBe(remote);
    });

    it('should prefer local when timestamps are equal', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByLastWriteWins(local, remote)).toBe(local);
    });
  });

  // ===== resolveByNodePriority =====

  describe('resolveByNodePriority', () => {
    it('should prefer higher priority node (local higher)', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByNodePriority(local, remote, 70, 30)).toBe(local);
    });

    it('should prefer higher priority node (remote higher)', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByNodePriority(local, remote, 30, 70)).toBe(remote);
    });

    it('should prefer local when priorities are equal', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByNodePriority(local, remote, 50, 50)).toBe(local);
    });
  });

  // ===== applyConflictResolution =====

  describe('applyConflictResolution', () => {
    it('should resolve conflicts using last_write_wins strategy', () => {
      const conflicts: ConflictRecord[] = [{
        asset_id: 'a-1',
        local_version: { version: 2, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' },
        remote_version: { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' },
        detected_at: new Date().toISOString(),
        strategy: 'last_write_wins',
      }];
      const result = conflictResolution.applyConflictResolution(conflicts, 'last_write_wins');
      expect(result['a-1']!.content_hash).toBe('hash-a');
    });

    it('should resolve conflicts using node_priority strategy', () => {
      const conflicts: ConflictRecord[] = [{
        asset_id: 'a-1',
        local_version: { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' },
        remote_version: { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' },
        detected_at: new Date().toISOString(),
        strategy: 'node_priority',
      }];
      const result = conflictResolution.applyConflictResolution(conflicts, 'node_priority', 70, 30);
      expect(result['a-1']!.content_hash).toBe('hash-a');
    });

    it('should resolve conflicts using merge strategy (falls back to last_write_wins)', () => {
      const conflicts: ConflictRecord[] = [{
        asset_id: 'a-1',
        local_version: { version: 2, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' },
        remote_version: { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' },
        detected_at: new Date().toISOString(),
        strategy: 'merge',
      }];
      const result = conflictResolution.applyConflictResolution(conflicts, 'merge');
      expect(result['a-1']!.content_hash).toBe('hash-a');
    });

    it('should resolve multiple conflicts', () => {
      const conflicts: ConflictRecord[] = [
        {
          asset_id: 'a-1',
          local_version: { version: 2, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a1' },
          remote_version: { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b1' },
          detected_at: new Date().toISOString(),
          strategy: 'last_write_wins',
        },
        {
          asset_id: 'a-2',
          local_version: { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a2' },
          remote_version: { version: 2, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b2' },
          detected_at: new Date().toISOString(),
          strategy: 'last_write_wins',
        },
      ];
      const result = conflictResolution.applyConflictResolution(conflicts, 'last_write_wins');
      expect(result['a-1']!.content_hash).toBe('hash-a1');
      expect(result['a-2']!.content_hash).toBe('hash-b2');
    });

    it('should return empty record for empty conflicts array', () => {
      const result = conflictResolution.applyConflictResolution([], 'last_write_wins');
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
