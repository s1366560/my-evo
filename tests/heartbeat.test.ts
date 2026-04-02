/**
 * Heartbeat Tests
 * Tests POST /a2a/heartbeat endpoint and worker pool sync
 */

import { processHeartbeat, clearPendingEvents } from '../src/a2a/heartbeat';
import { registerNode } from '../src/a2a/node';
import { resetWorkerPoolStores, getWorker } from '../src/workerpool/engine';

describe('Heartbeat', () => {
  beforeEach(() => {
    clearPendingEvents('test_node');
    resetWorkerPoolStores();
  });

  describe('Worker Pool Sync via Heartbeat', () => {
    it('should sync worker_enabled=true to mark worker available', async () => {
      // Register a node first
      const helloResult = await registerNode({ model: 'test-model', gene_count: 0, capsule_count: 0 });
      const nodeId = helloResult.your_node_id;

      // Heartbeat with worker_enabled=true
      const result = await processHeartbeat(
        `Bearer ${helloResult.node_secret}`,
        { sender_id: nodeId, worker_enabled: true }
      );

      expect(result.status).toBe('ok');

      // Worker should be available in the pool
      const worker = getWorker(nodeId);
      expect(worker).toBeDefined();
      expect(worker?.is_available).toBe(true);
    });

    it('should sync worker_enabled=false to mark worker unavailable', async () => {
      const helloResult = await registerNode({ model: 'test-model', gene_count: 0, capsule_count: 0 });
      const nodeId = helloResult.your_node_id;

      // Enable worker first
      await processHeartbeat(
        `Bearer ${helloResult.node_secret}`,
        { sender_id: nodeId, worker_enabled: true }
      );

      // Disable via heartbeat
      const result = await processHeartbeat(
        `Bearer ${helloResult.node_secret}`,
        { sender_id: nodeId, worker_enabled: false }
      );

      expect(result.status).toBe('ok');

      const worker = getWorker(nodeId);
      expect(worker?.is_available).toBe(false);
    });

    it('should sync worker_domains to register specialist with correct domain and skills', async () => {
      const helloResult = await registerNode({ model: 'test-model', gene_count: 0, capsule_count: 0 });
      const nodeId = helloResult.your_node_id;

      const result = await processHeartbeat(
        `Bearer ${helloResult.node_secret}`,
        { sender_id: nodeId, worker_domains: ['python', 'api', 'ml'] }
      );

      expect(result.status).toBe('ok');

      const worker = getWorker(nodeId);
      expect(worker).toBeDefined();
      expect(worker?.domain).toBe('python');        // primary domain = first element
      expect(worker?.skills).toContain('python');
      expect(worker?.skills).toContain('api');
      expect(worker?.skills).toContain('ml');
      expect(worker?.type).toBe('specialist');
    });

    it('should sync max_load to update max_concurrent_tasks', async () => {
      const helloResult = await registerNode({ model: 'test-model', gene_count: 0, capsule_count: 0 });
      const nodeId = helloResult.your_node_id;

      const result = await processHeartbeat(
        `Bearer ${helloResult.node_secret}`,
        { sender_id: nodeId, max_load: 10 }
      );

      expect(result.status).toBe('ok');

      const worker = getWorker(nodeId);
      expect(worker).toBeDefined();
      expect(worker?.max_concurrent_tasks).toBe(10);
    });

    it('should accept heartbeat without worker fields (backward compatible)', async () => {
      const helloResult = await registerNode({ model: 'test-model', gene_count: 0, capsule_count: 0 });
      const nodeId = helloResult.your_node_id;

      // Heartbeat without any worker fields — should not throw
      const result = await processHeartbeat(
        `Bearer ${helloResult.node_secret}`,
        { sender_id: nodeId, gene_count: 5 }
      );

      expect(result.status).toBe('ok');
      expect(result.available_tasks).toBeDefined();
    });

    it('should sync all worker fields together', async () => {
      const helloResult = await registerNode({ model: 'test-model', gene_count: 0, capsule_count: 0 });
      const nodeId = helloResult.your_node_id;

      const result = await processHeartbeat(
        `Bearer ${helloResult.node_secret}`,
        {
          sender_id: nodeId,
          worker_enabled: true,
          worker_domains: ['code', 'rust'],
          max_load: 5,
        }
      );

      expect(result.status).toBe('ok');

      const worker = getWorker(nodeId);
      expect(worker?.is_available).toBe(true);
      expect(worker?.domain).toBe('code');
      expect(worker?.skills).toContain('code');
      expect(worker?.skills).toContain('rust');
      expect(worker?.max_concurrent_tasks).toBe(5);
      expect(worker?.type).toBe('specialist');
    });
  });
});
