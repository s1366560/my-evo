/**
 * Drift Bottle Tests
 * Chapter 13: Anonymous Signal Mechanism
 */

import {
  throwBottle,
  pickBottle,
  resolveBottle,
  rejectBottle,
  getBottle,
  getBottleSummary,
  getRescuerInbox,
  getBottleStats,
  listBottles,
  resetStores,
} from '../src/driftbottle/engine';
import { BottleStatus, BottleSignal } from '../src/driftbottle/types';

describe('Drift Bottle Engine', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('throwBottle', () => {
    it('should throw a valid bottle', () => {
      const { bottle, error } = throwBottle('node_sender_001', {
        signal_type: 'question',
        title: 'How to handle connection timeouts?',
        content: 'I keep getting connection timeouts under high load. What patterns work best?',
        tags: ['timeout', 'retry', 'network'],
        reward: 100,
        ttl_hours: 48,
      });

      expect(error).toBeUndefined();
      expect(bottle.bottle_id).toMatch(/^bottle_/);
      expect(bottle.sender_id).toBe('node_sender_001');
      expect(bottle.signal_type).toBe('question');
      expect(bottle.title).toBe('How to handle connection timeouts?');
      expect(bottle.tags).toEqual(['timeout', 'retry', 'network']);
      expect(bottle.reward).toBe(100);
      expect(bottle.status).toBe('floating');
      expect(bottle.created_at).toBeDefined();
      expect(new Date(bottle.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should use defaults when optional fields are omitted', () => {
      const { bottle } = throwBottle('node_sender_002', {
        signal_type: 'idea',
        title: 'A bold idea',
        content: 'What if we use gossip protocol for all node communication?',
      });

      expect(bottle.reward).toBe(50); // DEFAULT_REWARD
      expect(bottle.tags).toEqual([]);
    });

    it('should reject empty title', () => {
      const { bottle, error } = throwBottle('node_sender_003', {
        signal_type: 'problem',
        title: '   ',
        content: 'Some content',
      });
      expect(error).toBe('Title is required');
    });

    it('should reject empty content', () => {
      const { bottle, error } = throwBottle('node_sender_004', {
        signal_type: 'request',
        title: 'Valid title',
        content: '',
      });
      expect(error).toBe('Content is required');
    });

    it('should enforce max bottles per node (anti-spam)', () => {
      // Throw 10 bottles (max)
      for (let i = 0; i < 10; i++) {
        const { error } = throwBottle('node_spammer', {
          signal_type: 'idea',
          title: `Bottle ${i}`,
          content: 'Spam content',
        });
        expect(error).toBeUndefined();
      }

      // 11th bottle should be rejected
      const { error } = throwBottle('node_spammer', {
        signal_type: 'idea',
        title: 'Too many bottles',
        content: 'This should fail',
      });
      expect(error).toContain('Rate limit');
    });
  });

  describe('pickBottle', () => {
    it('should pick a floating bottle', () => {
      const { bottle: thrown } = throwBottle('node_sender', {
        signal_type: 'question',
        title: 'Test question',
        content: 'Test content',
      });

      const { rescue, bottle, error } = pickBottle('node_rescuer', thrown.bottle_id);

      expect(error).toBeUndefined();
      expect(rescue.rescue_id).toMatch(/^rescue_/);
      expect(rescue.bottle_id).toBe(thrown.bottle_id);
      expect(rescue.rescuer_id).toBe('node_rescuer');
      expect(rescue.status).toBe('pending');
      expect(bottle.status).toBe('picked');
      expect(bottle.picked_by).toBe('node_rescuer');
      expect(bottle.picked_at).toBeDefined();
    });

    it('should not allow picking own bottle', () => {
      const { bottle } = throwBottle('node_sender', {
        signal_type: 'idea',
        title: 'My bottle',
        content: 'My content',
      });

      const { error } = pickBottle('node_sender', bottle.bottle_id);
      expect(error).toBe('Cannot pick your own bottle');
    });

    it('should not pick a non-existent bottle', () => {
      const { error } = pickBottle('node_rescuer', 'bottle_nonexistent');
      expect(error).toBe('Bottle not found');
    });

    it('should not pick an already-picked bottle', () => {
      const { bottle } = throwBottle('node_sender', {
        signal_type: 'problem',
        title: 'Test',
        content: 'Test',
      });

      pickBottle('node_rescuer1', bottle.bottle_id);
      const { error } = pickBottle('node_rescuer2', bottle.bottle_id);
      expect(error).toBe('Bottle is picked, not available');
    });
  });

  describe('resolveBottle', () => {
    it('should resolve a picked bottle', () => {
      const { bottle } = throwBottle('node_sender', {
        signal_type: 'question',
        title: 'Test',
        content: 'Test',
      });

      const { rescue: pick } = pickBottle('node_rescuer', bottle.bottle_id);

      const { rescue, bottle: resolved } = resolveBottle('node_rescuer', {
        bottle_id: bottle.bottle_id,
        proposed_solution: 'Use exponential backoff with jitter',
        applied_genes: ['gene_retry_backoff'],
      });

      expect(rescue.status).toBe('completed');
      expect(rescue.proposed_solution).toBe('Use exponential backoff with jitter');
      expect(rescue.applied_genes).toEqual(['gene_retry_backoff']);
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution).toBe('Use exponential backoff with jitter');
      expect(resolved.resolved_at).toBeDefined();
    });

    it('should reject resolution without solution', () => {
      const { bottle } = throwBottle('node_sender', {
        signal_type: 'idea',
        title: 'Test',
        content: 'Test',
      });
      pickBottle('node_rescuer', bottle.bottle_id);

      const { error } = resolveBottle('node_rescuer', {
        bottle_id: bottle.bottle_id,
        proposed_solution: '',
      });
      expect(error).toBe('Proposed solution is required');
    });

    it('should only allow picker to resolve', () => {
      const { bottle } = throwBottle('node_sender', {
        signal_type: 'request',
        title: 'Test',
        content: 'Test',
      });
      pickBottle('node_rescuer', bottle.bottle_id);

      const { error } = resolveBottle('node_other', {
        bottle_id: bottle.bottle_id,
        proposed_solution: 'Solution',
      });
      expect(error).toBe('Only the picker can resolve');
    });
  });

  describe('rejectBottle', () => {
    it('should return a picked bottle to floating', () => {
      const { bottle } = throwBottle('node_sender', {
        signal_type: 'problem',
        title: 'Test',
        content: 'Test',
      });
      pickBottle('node_rescuer', bottle.bottle_id);

      const { bottle: returned } = rejectBottle('node_rescuer', bottle.bottle_id);

      expect(returned.status).toBe('floating');
      expect(returned.picked_by).toBeUndefined();
      expect(returned.picked_at).toBeUndefined();
    });
  });

  describe('listBottles', () => {
    it('should list all floating bottles by default', () => {
      throwBottle('node_sender', { signal_type: 'question', title: 'A', content: 'A' });
      throwBottle('node_sender', { signal_type: 'idea', title: 'B', content: 'B' });
      const { bottle: picked } = throwBottle('node_sender', { signal_type: 'request', title: 'C', content: 'C' });
      pickBottle('node_rescuer', picked.bottle_id);

      const floating = listBottles();
      expect(floating).toHaveLength(2);
      expect(floating.every(b => b.status === 'floating')).toBe(true);
    });

    it('should filter by signal_type', () => {
      throwBottle('node_sender', { signal_type: 'question', title: 'A', content: 'A' });
      throwBottle('node_sender', { signal_type: 'problem', title: 'B', content: 'B' });

      const questions = listBottles({ signal_type: 'question' });
      expect(questions).toHaveLength(1);
      expect(questions[0].signal_type).toBe('question');
    });

    it('should filter by tags', () => {
      throwBottle('node_sender', { signal_type: 'idea', title: 'A', content: 'A', tags: ['concurrency'] });
      throwBottle('node_sender', { signal_type: 'idea', title: 'B', content: 'B', tags: ['memory'] });

      const tagged = listBottles({ tags: ['concurrency'] });
      expect(tagged).toHaveLength(1);
    });

    it('should hide identities in summary', () => {
      throwBottle('node_sender', { signal_type: 'question', title: 'A', content: 'A' });

      const summaries = listBottles();
      // No sender_id or rescuer_id should leak
      expect(summaries[0]).not.toHaveProperty('sender_id');
      expect(summaries[0]).not.toHaveProperty('picked_by');
    });
  });

  describe('getBottleStats', () => {
    it('should return correct counts', () => {
      throwBottle('node_sender', { signal_type: 'idea', title: 'A', content: 'A' });
      throwBottle('node_sender', { signal_type: 'idea', title: 'B', content: 'B' });
      const { bottle: picked } = throwBottle('node_sender', { signal_type: 'idea', title: 'C', content: 'C' });
      const { bottle: resolved } = throwBottle('node_sender', { signal_type: 'idea', title: 'D', content: 'D' });
      pickBottle('node_rescuer1', picked.bottle_id);
      pickBottle('node_rescuer2', resolved.bottle_id);
      resolveBottle('node_rescuer2', { bottle_id: resolved.bottle_id, proposed_solution: 'Done' });

      const stats = getBottleStats();
      expect(stats.total).toBe(4);
      expect(stats.floating).toBe(2);
      expect(stats.picked).toBe(1);
      expect(stats.resolved).toBe(1);
    });
  });

  describe('getRescuerInbox', () => {
    it('should show only pending rescues for rescuer', () => {
      throwBottle('node_sender', { signal_type: 'idea', title: 'A', content: 'A' });
      const { bottle: b2 } = throwBottle('node_sender', { signal_type: 'idea', title: 'B', content: 'B' });
      const { bottle: b3 } = throwBottle('node_sender', { signal_type: 'idea', title: 'C', content: 'C' });
      pickBottle('node_rescuer', b2.bottle_id);
      pickBottle('node_rescuer', b3.bottle_id);
      // Resolve one
      resolveBottle('node_rescuer', { bottle_id: b2.bottle_id, proposed_solution: 'Done' });

      const inbox = getRescuerInbox('node_rescuer');
      expect(inbox).toHaveLength(1);
      expect(inbox[0].bottle.bottle_id).toBe(b3.bottle_id);
      expect(inbox[0].rescue.status).toBe('pending');
    });
  });
});
