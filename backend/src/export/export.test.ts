// Export Service Unit Tests
import { describe, test, expect } from '@jest/globals';
import { ExportService } from './service.js';

interface MockNode {
  id: string;
  label: string;
  type: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface MockEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  metadata: Record<string, unknown>;
}

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  const mockNodes: MockNode[] = [
    { id: 'node_1', label: 'Node 1', type: 'concept', description: 'First node', metadata: {}, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'node_2', label: 'Node 2', type: 'concept', description: 'Second node', metadata: {}, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const mockEdges: MockEdge[] = [
    { id: 'edge_1', source: 'node_1', target: 'node_2', label: 'relates to', metadata: {} },
  ];

  describe('exportMap', () => {
    test('should export map as JSON', async () => {
      const result = await service.exportMap('map_test', mockNodes, mockEdges, { format: 'json' });
      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/json');
      expect(result.filename).toMatch(/\.json$/);
      const data = typeof result.data === 'string' ? JSON.parse(result.data) : null;
      expect(data).toBeTruthy();
      if (data) {
        expect(data.mapId).toBe('map_test');
        expect(data.nodes).toHaveLength(2);
      }
    });

    test('should export JSON with metadata when includeMetadata is true', async () => {
      const result = await service.exportMap('map_test', mockNodes, mockEdges, { format: 'json', includeMetadata: true });
      expect(result.success).toBe(true);
      const data = typeof result.data === 'string' ? JSON.parse(result.data) : null;
      expect(data?.nodes[0]).toHaveProperty('metadata');
    });

    test('should export map as CSV', async () => {
      const result = await service.exportMap('map_test', mockNodes, mockEdges, { format: 'csv' });
      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toMatch(/\.csv$/);
      const csv = result.data as string;
      expect(csv).toContain('id,label,type,description');
      expect(csv).toContain('node_1');
    });

    test('should export CSV with metadata when includeMetadata is true', async () => {
      const result = await service.exportMap('map_test', mockNodes, mockEdges, { format: 'csv', includeMetadata: true });
      expect(result.success).toBe(true);
      const csv = result.data as string;
      expect(csv).toContain('metadata');
      expect(csv).toContain('createdAt');
    });

    test('should return error for unsupported format', async () => {
      const result = await service.exportMap('map_test', mockNodes, mockEdges, { format: 'svg' as any });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet implemented');
    });

    test('should handle empty nodes array', async () => {
      const result = await service.exportMap('map_test', [], [], { format: 'json' });
      expect(result.success).toBe(true);
      const data = typeof result.data === 'string' ? JSON.parse(result.data) : null;
      expect(data?.nodes).toHaveLength(0);
    });
  });

  describe('getSupportedFormats', () => {
    test('should return list of supported formats', () => {
      const formats = service.getSupportedFormats();
      expect(formats).toHaveLength(5);
      const formatIds = formats.map((f: { format: string }) => f.format);
      expect(formatIds).toEqual(['json', 'csv', 'png', 'svg', 'pdf']);
    });

    test('should include correct MIME types', () => {
      const formats = service.getSupportedFormats();
      const jsonFormat = formats.find((f: { format: string }) => f.format === 'json') as { format: string; mimeType: string } | undefined;
      const csvFormat = formats.find((f: { format: string }) => f.format === 'csv') as { format: string; mimeType: string } | undefined;
      expect(jsonFormat?.mimeType).toBe('application/json');
      expect(csvFormat?.mimeType).toBe('text/csv');
    });
  });
});
