// AI service tests — generateNodes, generateEdges, generateSuggestions,
// generateContext, expandConcept, getStatus. Pure functions, no DB needed.
import { describe, test, expect } from '@jest/globals';
import { aiService } from './service.js';

describe('AIService', () => {
  describe('getStatus', () => {
    test('returns the provider and model', () => {
      const status = aiService.getStatus();
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('provider');
      expect(status).toHaveProperty('model');
    });
  });

  describe('generateNodes', () => {
    test('returns the requested number of nodes', async () => {
      const result = await aiService.generateNodes({ mapId: 'm1', count: 4 });
      expect(result.nodes).toHaveLength(4);
      expect(result.usage!.totalTokens).toBeGreaterThan(0);
    });

    test('defaults to 3 nodes when count is missing', async () => {
      const result = await aiService.generateNodes({ mapId: 'm2' });
      expect(result.nodes).toHaveLength(3);
    });

    test('respects the supplied nodeType', async () => {
      const result = await aiService.generateNodes({ mapId: 'm3', count: 5, nodeType: 'agent' });
      for (const n of result.nodes) expect(n.nodeType).toBe('agent');
    });

    test('returns nodes with positions and metadata', async () => {
      const result = await aiService.generateNodes({ mapId: 'm4', count: 1 });
      const n = result.nodes[0];
      expect(n.position!.x).toBeGreaterThan(0);
      expect(n.position!.y).toBeGreaterThan(0);
      expect(n.metadata).toHaveProperty('generatedAt');
      expect(n.metadata).toHaveProperty('confidence');
    });
  });

  describe('generateEdges', () => {
    test('returns one edge', async () => {
      const result = await aiService.generateEdges({ mapId: 'm1', sourceNodeId: 'src-1' });
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('src-1');
      expect(result.usage!.totalTokens).toBeGreaterThan(0);
    });

    test('uses supplied targetNodeId when present', async () => {
      const result = await aiService.generateEdges({ mapId: 'm1', sourceNodeId: 'a', targetNodeId: 'b' });
      expect(result.edges[0].target).toBe('b');
    });

    test('uses supplied label and edgeType when present', async () => {
      const result = await aiService.generateEdges({
        mapId: 'm1', sourceNodeId: 'a', targetNodeId: 'b',
        label: 'causes', edgeType: 'dependency',
      });
      expect(result.edges[0].label).toBe('causes');
      expect(result.edges[0].edgeType).toBe('dependency');
    });

    test('falls back to a generated target when missing', async () => {
      const result = await aiService.generateEdges({ mapId: 'm1', sourceNodeId: 'a' });
      expect(result.edges[0].target).toMatch(/^node_/);
    });
  });

  describe('generateSuggestions', () => {
    test('returns 3 suggestions with different priorities', async () => {
      const result = await aiService.generateSuggestions('m1');
      expect(result).toHaveLength(3);
      const priorities = result.map(s => s.priority).sort();
      expect(priorities).toEqual(expect.arrayContaining(['high', 'medium', 'low']));
      for (const s of result) expect(s.data!.mapId).toBe('m1');
    });
  });

  describe('generateContext', () => {
    test('returns a string for the "explain" task', async () => {
      const result = await aiService.generateContext({ mapId: 'm1', nodeIds: ['n1'], task: 'explain' });
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.suggestions).toHaveLength(1);
    });

    test('returns different content for each task type', async () => {
      const e = await aiService.generateContext({ mapId: 'm', nodeIds: ['n1'], task: 'explain' });
      const s = await aiService.generateContext({ mapId: 'm', nodeIds: ['n1'], task: 'summarize' });
      const r = await aiService.generateContext({ mapId: 'm', nodeIds: ['n1'], task: 'refine' });
      const x = await aiService.generateContext({ mapId: 'm', nodeIds: ['n1'], task: 'expand' });
      expect(e.content).not.toBe(s.content);
      expect(s.content).not.toBe(r.content);
      expect(r.content).not.toBe(x.content);
    });

    test('falls back to explain content for unknown tasks', async () => {
      const e = await aiService.generateContext({ mapId: 'm', nodeIds: ['n1'], task: 'explain' });
      const u = await aiService.generateContext({ mapId: 'm', nodeIds: ['n1'], task: 'nonexistent' as any });
      expect(u.content).toBe(e.content);
    });
  });

  describe('expandConcept', () => {
    test('expands API concept into 3 child nodes', async () => {
      const result = await aiService.expandConcept('m1', 'parent', 'API');
      expect(result.nodes).toHaveLength(3);
      const labels = result.nodes.map(n => n.label);
      expect(labels).toEqual(expect.arrayContaining(['REST Handler', 'GraphQL Resolver', 'WebSocket Manager']));
    });

    test('expands Database concept', async () => {
      const result = await aiService.expandConcept('m1', 'parent', 'Database Pool');
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.map(n => n.label)).toEqual(
        expect.arrayContaining(['Connection Pool', 'Query Builder', 'Migration Runner'])
      );
    });

    test('expands Auth concept', async () => {
      const result = await aiService.expandConcept('m1', 'parent', 'Auth Service');
      expect(result.nodes.map(n => n.label)).toEqual(
        expect.arrayContaining(['Token Validator', 'Session Manager', 'Permission Checker'])
      );
    });

    test('falls back to API templates for unknown concept', async () => {
      const result = await aiService.expandConcept('m1', 'parent', 'Quantum Banana');
      expect(result.nodes).toHaveLength(3);
    });

    test('marks expanded nodes with the source nodeId in metadata', async () => {
      const result = await aiService.expandConcept('m1', 'src-node', 'API');
      for (const n of result.nodes) expect(n.metadata!.expandedFrom).toBe('src-node');
    });
  });
});
