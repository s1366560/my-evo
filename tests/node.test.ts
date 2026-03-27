/**
 * Unit tests for Node Registration Module
 */

import { registerNode, validateNodeSecret, getNodeInfo, updateHeartbeat } from '../src/a2a/node';

describe('Node Registration', () => {
  it('should register a new node and return node_secret', async () => {
    const result = await registerNode({
      model: 'test-model',
      gene_count: 0,
      capsule_count: 0
    });

    expect(result.status).toBe('acknowledged');
    expect(result.your_node_id).toMatch(/^node_/);
    expect(result.node_secret).toHaveLength(64);
    expect(result.credit_balance).toBe(500);
    expect(result.hub_node_id).toMatch(/^hub_/);
  });

  it('should validate node_secret and return node_id', async () => {
    const result = await registerNode({
      model: 'test-model'
    });

    const nodeId = validateNodeSecret(result.node_secret);
    expect(nodeId).toBe(result.your_node_id);
  });

  it('should reject invalid node_secret', () => {
    const nodeId = validateNodeSecret('invalid_secret');
    expect(nodeId).toBeNull();
  });

  it('should return existing node info for duplicate registration', async () => {
    const first = await registerNode({
      model: 'test-model',
      gene_count: 5
    });

    const second = await registerNode({
      model: 'test-model',
      gene_count: 10
    }, first.your_node_id);

    // Should return existing node, not create new one
    expect(second.your_node_id).toBe(first.your_node_id);
    expect(second.credit_balance).toBe(0);  // No new credits
  });

  it('should generate claim_code and claim_url', async () => {
    const result = await registerNode({});

    expect(result.claim_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(result.claim_url).toContain(result.claim_code);
  });
});

describe('Heartbeat', () => {
  it('should update heartbeat timestamp', async () => {
    const registerResult = await registerNode({});
    const nodeId = registerResult.your_node_id;

    const updated = updateHeartbeat(nodeId);
    expect(updated).toBe(true);
  });

  it('should return null for non-existent node', async () => {
    const updated = updateHeartbeat('node_nonexistent');
    expect(updated).toBe(false);
  });
});

describe('Node Info', () => {
  it('should retrieve registered node info', async () => {
    const registerResult = await registerNode({
      model: 'claude-sonnet-4',
      gene_count: 10,
      capsule_count: 5
    });

    const nodeInfo = getNodeInfo(registerResult.your_node_id);
    expect(nodeInfo).not.toBeNull();
    expect(nodeInfo!.model).toBe('claude-sonnet-4');
    expect(nodeInfo!.gene_count).toBe(10);
    expect(nodeInfo!.capsule_count).toBe(5);
    expect(nodeInfo!.status).toBe('alive');
    expect(nodeInfo!.reputation).toBe(0);
  });

  it('should return null for non-existent node', () => {
    const nodeInfo = getNodeInfo('node_nonexistent');
    expect(nodeInfo).toBeNull();
  });
});
