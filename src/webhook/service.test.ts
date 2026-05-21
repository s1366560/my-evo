import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSubscription,
  getSubscription,
  getNodeSubscriptions,
  listSubscriptions,
  updateSubscription,
  deleteSubscription,
  getSubscriptionSecret,
  getDelivery,
  getSubscriptionDeliveries,
  triggerEvent,
  _resetTestState,
} from './service';

describe('Webhook Service', () => {
  beforeEach(() => {
    _resetTestState();
  });

  describe('createSubscription', () => {
    it('should create a subscription with valid parameters', async () => {
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published', 'task.available'],
      });

      expect(sub).toBeDefined();
      expect(sub.id).toMatch(/^whsub_/);
      expect(sub.node_id).toBe('node_123');
      expect(sub.url).toBe('https://example.com/webhook');
      expect(sub.events).toEqual(['asset.published', 'task.available']);
      expect(sub.enabled).toBe(true);
      expect(sub.secret).toHaveLength(64); // 32 bytes hex
    });

    it('should create subscription with provided secret', async () => {
      const secret = 'my-custom-secret-123';
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
        secret,
      });

      expect(sub.secret).toBe(secret);
    });

    it('should throw ValidationError for invalid URL', async () => {
      await expect(createSubscription({
        node_id: 'node_123',
        url: 'not-a-url',
        events: ['asset.published'],
      })).rejects.toThrow('Webhook URL must start with http:// or https://');
    });

    it('should throw ValidationError for empty events', async () => {
      await expect(createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: [],
      })).rejects.toThrow('At least one event type is required');
    });
  });

  describe('getSubscription', () => {
    it('should return subscription by ID', async () => {
      const created = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
      });

      const found = getSubscription(created.id);
      expect(found).toEqual(created);
    });

    it('should return null for non-existent subscription', () => {
      const found = getSubscription('non_existent_id');
      expect(found).toBeNull();
    });
  });

  describe('getNodeSubscriptions', () => {
    it('should return all subscriptions for a node', async () => {
      await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook1',
        events: ['asset.published'],
      });
      await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook2',
        events: ['task.available'],
      });
      await createSubscription({
        node_id: 'node_456',
        url: 'https://example.com/webhook3',
        events: ['asset.published'],
      });

      const nodeSubs = getNodeSubscriptions('node_123');
      expect(nodeSubs).toHaveLength(2);
      expect(nodeSubs.every(s => s.node_id === 'node_123')).toBe(true);
    });
  });

  describe('listSubscriptions', () => {
    it('should list all subscriptions', async () => {
      await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook1',
        events: ['asset.published'],
      });
      await createSubscription({
        node_id: 'node_456',
        url: 'https://example.com/webhook2',
        events: ['task.available'],
      });

      const all = listSubscriptions();
      expect(all).toHaveLength(2);
    });

    it('should filter by event type', async () => {
      await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook1',
        events: ['asset.published'],
      });
      await createSubscription({
        node_id: 'node_456',
        url: 'https://example.com/webhook2',
        events: ['task.available'],
      });

      const assetSubs = listSubscriptions({ event_type: 'asset.published' });
      expect(assetSubs).toHaveLength(1);
      expect(assetSubs[0]!.events).toContain('asset.published');
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription fields', async () => {
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
      });

      const updated = updateSubscription(sub.id, {
        url: 'https://new-url.com/webhook',
        enabled: false,
      });

      expect(updated).not.toBeNull();
      expect(updated!.url).toBe('https://new-url.com/webhook');
      expect(updated!.enabled).toBe(false);
    });

    it('should return null for non-existent subscription', () => {
      const updated = updateSubscription('non_existent', { enabled: false });
      expect(updated).toBeNull();
    });
  });

  describe('deleteSubscription', () => {
    it('should delete subscription', async () => {
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
      });

      expect(deleteSubscription(sub.id)).toBe(true);
      expect(getSubscription(sub.id)).toBeNull();
    });

    it('should return false for non-existent subscription', () => {
      expect(deleteSubscription('non_existent')).toBe(false);
    });
  });

  describe('getSubscriptionSecret', () => {
    it('should return secret for subscription', async () => {
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
        secret: 'test-secret',
      });

      const secret = getSubscriptionSecret(sub.id);
      expect(secret).toBe('test-secret');
    });

    it('should return null for non-existent subscription', () => {
      const secret = getSubscriptionSecret('non_existent');
      expect(secret).toBeNull();
    });
  });

  describe('triggerEvent', () => {
    it('should trigger event to all matching subscriptions', async () => {
      const sub1 = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook1',
        events: ['asset.published', 'task.available'],
      });
      await createSubscription({
        node_id: 'node_456',
        url: 'https://example.com/webhook2',
        events: ['task.available'], // Only task.available
      });

      await triggerEvent('asset.published', {
        asset_id: 'asset_123',
        name: 'Test Asset',
      });

      // Both should be called (simulated delivery)
      const deliveries = getSubscriptionDeliveries(sub1.id);
      expect(deliveries.length).toBeGreaterThan(0);
    });
  });

  describe('getDelivery', () => {
    it('should return delivery by ID', async () => {
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
      });

      // Trigger to create a delivery
      await triggerEvent('asset.published', { asset_id: 'test' });

      const deliveries = getSubscriptionDeliveries(sub.id);
      expect(deliveries.length).toBeGreaterThan(0);

      const found = getDelivery(deliveries[0]!.id);
      expect(found).toEqual(deliveries[0]);
    });

    it('should return null for non-existent delivery', () => {
      const found = getDelivery('non_existent');
      expect(found).toBeNull();
    });
  });

  describe('getSubscriptionDeliveries', () => {
    it('should return deliveries for subscription', async () => {
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
      });

      // Trigger multiple events
      await triggerEvent('asset.published', { asset_id: 'test1' });
      await triggerEvent('asset.published', { asset_id: 'test2' });

      const deliveries = getSubscriptionDeliveries(sub.id);
      expect(deliveries.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit parameter', async () => {
      const sub = await createSubscription({
        node_id: 'node_123',
        url: 'https://example.com/webhook',
        events: ['asset.published'],
      });

      // Trigger multiple events
      for (let i = 0; i < 10; i++) {
        await triggerEvent('asset.published', { asset_id: `test${i}` });
      }

      const deliveries = getSubscriptionDeliveries(sub.id, 5);
      expect(deliveries.length).toBeLessThanOrEqual(5);
    });
  });
});
