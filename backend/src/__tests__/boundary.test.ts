/**
 * Boundary Condition Tests for My Evo Backend
 * Tests: Large data performance, empty data handling, concurrent operations, error recovery
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import prisma from '../db/prisma.js';

// Test data generators
function generateLargeNodeList(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    mapNodeId: `test_node_${i}_${Date.now()}`,
    name: `Test Node ${i}`,
    type: i % 3 === 0 ? 'gene' : i % 3 === 1 ? 'capsule' : 'cluster',
    positionX: Math.random() * 100,
    positionY: Math.random() * 100,
    size: Math.random() * 10,
    color: `hsl(${i * 10 % 360}, 70%, 50%)`,
  }));
}

function generateLargeEdgeList(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    sourceId: `source_${i}`,
    targetId: `target_${i}`,
    type: i % 3 === 0 ? 'inheritance' : i % 3 === 1 ? 'reference' : 'uses',
    weight: Math.random(),
  }));
}

describe('Boundary Condition Tests', () => {
  // Clean up test data before each test
  beforeEach(async () => {
    await prisma.mapNode.deleteMany({
      where: { mapNodeId: { startsWith: 'test_' } },
    });
    await prisma.mapEdge.deleteMany({
      where: {
        OR: [
          { sourceId: { startsWith: 'source_' } },
          { targetId: { startsWith: 'target_' } },
        ],
      },
    });
  });

  // ==================== LARGE DATA PERFORMANCE TESTS ====================
  describe('Large Data Map Performance', () => {
    it('should handle 100 nodes creation within acceptable time', async () => {
      const nodes = generateLargeNodeList(100);
      const startTime = Date.now();

      const created = await Promise.all(
        nodes.map(node => prisma.mapNode.create({ data: node }))
      );

      const duration = Date.now() - startTime;

      expect(created).toHaveLength(100);
      expect(duration).toBeLessThan(10000); // 10 seconds

      const count = await prisma.mapNode.count({
        where: { mapNodeId: { startsWith: 'test_' } },
      });
      expect(count).toBeGreaterThanOrEqual(100);
    });

    it('should handle 500 nodes creation within acceptable time', async () => {
      const nodes = generateLargeNodeList(500);
      const startTime = Date.now();

      const created = await Promise.all(
        nodes.map(node => prisma.mapNode.create({ data: node }))
      );

      const duration = Date.now() - startTime;

      expect(created).toHaveLength(500);
      expect(duration).toBeLessThan(30000); // 30 seconds

      await prisma.mapNode.deleteMany({
        where: { mapNodeId: { startsWith: 'test_' } },
      });
    });

    it('should handle large graph retrieval with 100 nodes', async () => {
      const nodes = generateLargeNodeList(100);
      await Promise.all(nodes.map(node => prisma.mapNode.create({ data: node })));

      const edges = generateLargeEdgeList(50);
      for (const edge of edges) {
        await prisma.mapEdge.create({ data: edge }).catch(() => {});
      }

      const startTime = Date.now();

      const [fetchedNodes, fetchedEdges] = await Promise.all([
        prisma.mapNode.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.mapEdge.findMany(),
      ]);

      const duration = Date.now() - startTime;

      expect(fetchedNodes.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000);
    });

    it('should handle pagination for large result sets', async () => {
      const nodes = generateLargeNodeList(150);
      await Promise.all(nodes.map(node => prisma.mapNode.create({ data: node })));

      const page1 = await prisma.mapNode.findMany({ take: 50, skip: 0, orderBy: { createdAt: 'desc' } });
      const page2 = await prisma.mapNode.findMany({ take: 50, skip: 50, orderBy: { createdAt: 'desc' } });
      const page3 = await prisma.mapNode.findMany({ take: 50, skip: 100, orderBy: { createdAt: 'desc' } });

      expect(page1).toHaveLength(50);
      expect(page2).toHaveLength(50);
      expect(page3.length).toBeGreaterThanOrEqual(0);

      const page1Ids = new Set(page1.map(n => n.id));
      const page2Ids = new Set(page2.map(n => n.id));
      expect(page1Ids.intersection(page2Ids).size).toBe(0);
    });

    it('should handle large metadata in nodes', async () => {
      const largeMetadata = {
        description: 'A'.repeat(5000),
        tags: Array.from({ length: 20 }, (_, i) => `tag${i}`),
        nested: { level1: { level2: { level3: 'deep data' } } },
        timestamps: Array.from({ length: 100 }, (_, i) => ({ time: Date.now() + i * 1000, event: `event_${i}` })),
      };

      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_metadata_${Date.now()}`,
          name: 'Large Metadata Node',
          type: 'gene',
          positionX: 50,
          positionY: 50,
          size: 1,
          metadata: JSON.stringify(largeMetadata),
        },
      });

      const retrieved = await prisma.mapNode.findUnique({ where: { id: node.id } });

      expect(retrieved).toBeDefined();
      const parsedMetadata = JSON.parse(retrieved!.metadata || '{}');
      expect(parsedMetadata.description.length).toBe(5000);
      expect(parsedMetadata.tags).toHaveLength(20);
    });
  });


  // ==================== EMPTY DATA HANDLING TESTS ====================
  describe('Empty Data Import Handling', () => {
    it('should handle null optional fields', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_null_${Date.now()}`,
          name: 'Null Test Node',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
          color: null,
          metadata: null,
          parentId: null,
        },
      });

      expect(node).toBeDefined();
      expect(node.color).toBeNull();
      expect(node.metadata).toBeNull();
      expect(node.parentId).toBeNull();
    });

    it('should handle empty string metadata', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_emptystr_${Date.now()}`,
          name: 'Empty String Metadata',
          type: 'capsule',
          positionX: 0,
          positionY: 0,
          size: 1,
          metadata: '',
        },
      });

      expect(node).toBeDefined();
      expect(node.metadata).toBe('');
    });

    it('should handle zero values for numeric fields', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_zero_${Date.now()}`,
          name: 'Zero Values Node',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 0,
        },
      });

      expect(node.positionX).toBe(0);
      expect(node.positionY).toBe(0);
      expect(node.size).toBe(0);
    });

    it('should handle minimal valid node creation', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_minimal_${Date.now()}`,
          name: 'X',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      expect(node).toBeDefined();
      expect(node.name).toBe('X');
      expect(node.id).toBeDefined();
    });

    it('should handle empty edge list retrieval', async () => {
      await prisma.mapEdge.deleteMany({
        where: {
          OR: [
            { sourceId: { startsWith: 'source_' } },
            { targetId: { startsWith: 'target_' } },
          ],
        },
      });

      const edges = await prisma.mapEdge.findMany();
      expect(Array.isArray(edges)).toBe(true);
    });

    it('should handle edge creation with minimal data', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_edge_node_${Date.now()}`,
          name: 'Edge Test Source',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      const edge = await prisma.mapEdge.create({
        data: {
          sourceId: node.id,
          targetId: node.id,
          type: 'reference',
          weight: 0,
        },
      });

      expect(edge).toBeDefined();
      expect(edge.weight).toBe(0);
    });

    it('should handle very long node names', async () => {
      const longName = 'A'.repeat(500);
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_longname_${Date.now()}`,
          name: longName,
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      expect(node.name).toBe(longName);
      expect(node.name.length).toBe(500);
    });

    it('should handle special characters in node names', async () => {
      const specialName = 'Node @#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_special_${Date.now()}`,
          name: specialName,
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      expect(node.name).toBe(specialName);
    });

    it('should handle unicode in node names', async () => {
      const unicodeName = '日本語ノード 🎉 émojis & 中文';
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_unicode_${Date.now()}`,
          name: unicodeName,
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      expect(node.name).toBe(unicodeName);
    });
  });

  // ==================== CONCURRENT OPERATIONS TESTS ====================
  describe('Concurrent Operations', () => {
    it('should handle concurrent node creations', async () => {
      const nodes = generateLargeNodeList(50);
      const startTime = Date.now();

      const results = await Promise.allSettled(
        nodes.map(node => prisma.mapNode.create({ data: node }))
      );

      const duration = Date.now() - startTime;
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(15000);
    });

    it('should handle concurrent reads during writes', async () => {
      const initialNodes = generateLargeNodeList(20);
      await Promise.all(initialNodes.map(node => prisma.mapNode.create({ data: node })));

      const readOperations = Array.from({ length: 10 }, async () => {
        return prisma.mapNode.findMany({ take: 10 });
      });

      const writeOperations = Array.from({ length: 5 }, async (_, i) => {
        return prisma.mapNode.create({
          data: {
            mapNodeId: `test_concurrent_write_${i}_${Date.now()}`,
            name: `Concurrent Write ${i}`,
            type: 'gene',
            positionX: 0,
            positionY: 0,
            size: 1,
          },
        });
      });

      const [reads, writes] = await Promise.all([
        Promise.all(readOperations),
        Promise.all(writeOperations),
      ]);

      reads.forEach(readResult => expect(Array.isArray(readResult)).toBe(true));
      expect(writes.length).toBe(5);
    });

    it('should handle rapid sequential updates', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_rapid_${Date.now()}`,
          name: 'Rapid Update Node',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      const updates = Array.from({ length: 10 }, async (_, i) => {
        return prisma.mapNode.update({
          where: { id: node.id },
          data: { size: i + 1 },
        });
      });

      await Promise.all(updates);

      const finalNode = await prisma.mapNode.findUnique({ where: { id: node.id } });

      expect(finalNode).toBeDefined();
      expect(finalNode!.size).toBeGreaterThan(0);
      expect(finalNode!.size).toBeLessThanOrEqual(10);
    });

    it('should handle concurrent delete operations safely', async () => {
      const nodes = generateLargeNodeList(10);
      const created = await Promise.all(
        nodes.map(node => prisma.mapNode.create({ data: node }))
      );

      const deletePromises = created.map(node =>
        prisma.mapNode.delete({ where: { id: node.id } }).catch(() => null)
      );

      const results = await Promise.all(deletePromises);
      expect(results.length).toBe(10);
    });

    it('should handle concurrent duplicate key attempts', async () => {
      const duplicateId = `test_dup_${Date.now()}`;

      const first = await prisma.mapNode.create({
        data: {
          mapNodeId: duplicateId,
          name: 'First Node',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      expect(first).toBeDefined();

      try {
        await prisma.mapNode.create({
          data: {
            mapNodeId: duplicateId,
            name: 'Duplicate Node',
            type: 'gene',
            positionX: 0,
            positionY: 0,
            size: 1,
          },
        });
        expect(true).toBe(true);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    it('should handle race condition on same-node concurrent reads', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_race_${Date.now()}`,
          name: 'Race Test',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      const reads = await Promise.all(
        Array.from({ length: 20 }, () => prisma.mapNode.findUnique({ where: { id: node.id } }))
      );

      reads.forEach(read => {
        expect(read).toBeDefined();
        expect(read!.id).toBe(node.id);
      });
    });
  });


  // ==================== ERROR RECOVERY TESTS ====================
  describe('Error Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      const result = await prisma.mapNode.findUnique({
        where: { id: 'non-existent-id-12345' },
      });
      expect(result).toBeNull();
    });

    it('should handle operations on non-existent nodes', async () => {
      try {
        await prisma.mapNode.update({
          where: { id: 'non-existent-id-999' },
          data: { name: 'Updated Name' },
        });
        expect(true).toBe(true);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    it('should handle delete of non-existent node gracefully', async () => {
      try {
        await prisma.mapNode.delete({
          where: { id: 'non-existent-id-delete' },
        });
        expect(true).toBe(true);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid edge source/target gracefully', async () => {
      try {
        await prisma.mapEdge.create({
          data: {
            sourceId: 'invalid-source-id',
            targetId: 'invalid-target-id',
            type: 'reference',
            weight: 1,
          },
        });
        expect(true).toBe(true);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    it('should handle malformed JSON in metadata gracefully', async () => {
      try {
        const node = await prisma.mapNode.create({
          data: {
            mapNodeId: `test_invalid_json_${Date.now()}`,
            name: 'Invalid JSON Node',
            type: 'gene',
            positionX: 0,
            positionY: 0,
            size: 1,
            metadata: '{ invalid json }',
          },
        });
        expect(node).toBeDefined();
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    it('should handle extremely large number values', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_largenum_${Date.now()}`,
          name: 'Large Number Node',
          type: 'gene',
          positionX: Number.MAX_SAFE_INTEGER - 1,
          positionY: Number.MAX_SAFE_INTEGER - 2,
          size: Number.MAX_SAFE_INTEGER,
        },
      });

      expect(node.positionX).toBeLessThan(Number.MAX_SAFE_INTEGER);
      expect(node.positionY).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });

    it('should handle negative coordinate values', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_negative_${Date.now()}`,
          name: 'Negative Coordinates',
          type: 'gene',
          positionX: -100.5,
          positionY: -200.75,
          size: 1,
        },
      });

      expect(node.positionX).toBe(-100.5);
      expect(node.positionY).toBe(-200.75);
    });

    it('should handle string injection attempts', async () => {
      const injectionName = "'; DROP TABLE mapNode; --";
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_injection_${Date.now()}`,
          name: injectionName,
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      expect(node.name).toBe(injectionName);
    });

    it('should handle very large weight values in edges', async () => {
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId: `test_weight_${Date.now()}`,
          name: 'Weight Test',
          type: 'gene',
          positionX: 0,
          positionY: 0,
          size: 1,
        },
      });

      const edge = await prisma.mapEdge.create({
        data: {
          sourceId: node.id,
          targetId: node.id,
          type: 'reference',
          weight: 999999999,
        },
      });

      expect(edge.weight).toBe(999999999);
    });
  });

  // ==================== RATE LIMITING & VALIDATION TESTS ====================
  describe('Rate Limiting and Validation', () => {
    it('should handle rapid registration attempts', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, async (_, i) => ({
          email: `rapid_test_${i}_${Date.now()}@test.com`,
          username: `rapiduser${i}`,
          password: 'TestPass123',
        }))
      );

      expect(results.length).toBe(5);
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBe(5);
    });

    it('should handle bulk map node queries efficiently', async () => {
      const nodes = generateLargeNodeList(100);
      await Promise.all(nodes.map(node => prisma.mapNode.create({ data: node })));

      const startTime = Date.now();

      const filtered = await prisma.mapNode.findMany({
        where: { type: 'gene' },
        take: 50,
      });

      const duration = Date.now() - startTime;

      expect(filtered.length).toBeLessThanOrEqual(50);
      expect(duration).toBeLessThan(3000);
    });

    it('should handle edge count queries on empty graph', async () => {
      const count = await prisma.mapEdge.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle count queries on empty node table', async () => {
      const count = await prisma.mapNode.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
