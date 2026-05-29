// AI Service Unit Tests
import { describe, test, expect, beforeEach } from '@jest/globals';
import { AIService } from './service.js';

interface MockNode {
  id: string;
  label: string;
  description: string;
  nodeType: string;
  position: { x: number; y: number };
  metadata: Record<string, unknown>;
}

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService();
  });

  describe('generateNodes', () => {
    test('should generate nodes with default count of 3', async () => {
      const result = await service.generateNodes({ mapId: 'map_123' });
      expect(result.nodes).toHaveLength(3);
      expect(result.usage).toBeDefined();
    });

    test('should generate requested number of nodes', async () => {
      const result = await service.generateNodes({ mapId: 'map_123', count: 5 });
      expect(result.nodes).toHaveLength(5);
    });

    test('should generate nodes with specified type', async () => {
      const result = await service.generateNodes({ mapId: 'map_123', nodeType: 'agent' });
      (result.nodes as MockNode[]).forEach((node: MockNode) => {
        expect(node.nodeType).toBe('agent');
      });
    });

    test('should include required node properties', async () => {
      const result = await service.generateNodes({ mapId: 'map_123' });
      (result.nodes as MockNode[]).forEach((node: MockNode) => {
        expect(node.id).toMatch(/^node_ai_/);
        expect(typeof node.label).toBe('string');
        expect(typeof node.description).toBe('string');
        expect(node.position).toBeDefined();
      });
    });
  });

  describe('generateEdges', () => {
    test('should generate an edge with source', async () => {
      const result = await service.generateEdges({ mapId: 'map_123', sourceNodeId: 'node_1' });
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('node_1');
    });

    test('should use provided label when specified', async () => {
      const result = await service.generateEdges({ mapId: 'map_123', sourceNodeId: 'node_1', label: 'custom' });
      expect(result.edges[0].label).toBe('custom');
    });
  });

  describe('generateSuggestions', () => {
    test('should return array of suggestions', async () => {
      const result = await service.generateSuggestions('map_123');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should include suggestion properties', async () => {
      const result = await service.generateSuggestions('map_123');
      result.forEach((s: { id: string; type: string; priority: string }) => {
        expect(typeof s.id).toBe('string');
        expect(['node', 'edge', 'layout', 'optimization']).toContain(s.type);
        expect(['high', 'medium', 'low']).toContain(s.priority);
      });
    });
  });

  describe('generateContext', () => {
    test('should generate context for explain task', async () => {
      const result = await service.generateContext({ mapId: 'map_123', nodeIds: ['n1', 'n2'], task: 'explain' });
      expect(typeof result.content).toBe('string');
    });

    test('should generate context for all task types', async () => {
      const tasks = ['explain', 'expand', 'refine', 'summarize'] as const;
      for (const task of tasks) {
        const result = await service.generateContext({ mapId: 'map_123', nodeIds: ['n1'], task });
        expect(typeof result.content).toBe('string');
      }
    });
  });

  describe('expandConcept', () => {
    test('should expand API concept', async () => {
      const result = await service.expandConcept('map_123', 'node_1', 'API Gateway');
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    test('should expand Database concept', async () => {
      const result = await service.expandConcept('map_123', 'node_2', 'Database Connection');
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    test('should include expandedFrom in metadata', async () => {
      const result = await service.expandConcept('map_123', 'node_1', 'API');
      (result.nodes as MockNode[]).forEach((n: MockNode) => {
        expect(n.metadata?.expandedFrom).toBe('node_1');
      });
    });
  });

  describe('getStatus', () => {
    test('should return service status object', () => {
      const status = service.getStatus();
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('provider');
      expect(status).toHaveProperty('model');
    });
  });
});
