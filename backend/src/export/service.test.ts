// Export service tests — covers JSON, CSV, and the visual/unsupported branches.
import { describe, test, expect } from '@jest/globals';
import { exportService } from './service.js';

const SAMPLE_NODES = [
  { id: 'a', label: 'Alpha', description: 'first', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} },
  { id: 'b', label: 'Beta', description: 'second', nodeType: 'concept', positionX: 100, positionY: 100, metadata: {} },
];
const SAMPLE_EDGES = [
  { id: 'e1', mapId: 'm1', sourceId: 'a', targetId: 'b', label: 'leads to', metadata: {} },
];

describe('ExportService', () => {
  test('exports map as JSON', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'json' });
    expect(r.success).toBe(true);
    expect(r.mimeType).toBe('application/json');
    expect(r.filename).toMatch(/\.json$/);
    const data = JSON.parse(r.data as string);
    expect(data.mapId).toBe('m1');
    expect(data.nodes).toHaveLength(2);
    expect(data.edges).toHaveLength(1);
  });

  test('excludes edges when includeEdges is false', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'json', includeEdges: false });
    const data = JSON.parse(r.data as string);
    expect(data.edges).toBeUndefined();
  });

  test('excludes metadata when includeMetadata is false', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'json', includeMetadata: false });
    const data = JSON.parse(r.data as string);
    expect(data.metadata).toBeUndefined();
  });

  test('exports map as CSV', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'csv' });
    expect(r.success).toBe(true);
    expect(r.mimeType).toBe('text/csv');
    const csv = r.data as string;
    expect(csv).toContain('Alpha');
    expect(csv).toContain('Beta');
    expect(csv.split('\n')[0]).toContain('label');
  });

  test('returns error for PNG (visual not yet implemented)', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'png' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not yet implemented/i);
  });

  test('returns error for SVG (visual not yet implemented)', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'svg' });
    expect(r.success).toBe(false);
  });

  test('returns error for PDF (visual not yet implemented)', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'pdf' });
    expect(r.success).toBe(false);
  });

  test('returns error for unsupported format', async () => {
    const r = await exportService.exportMap('m1', SAMPLE_NODES, SAMPLE_EDGES, { format: 'xml' as any });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unsupported/i);
  });

  test('handles empty nodes/edges arrays', async () => {
    const r = await exportService.exportMap('m1', [], [], { format: 'json' });
    expect(r.success).toBe(true);
    const data = JSON.parse(r.data as string);
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
  });

  test('getSupportedFormats returns the list of formats with MIME types', () => {
    const fmts = exportService.getSupportedFormats();
    expect(fmts).toHaveLength(5);
    expect(fmts.find(f => f.format === 'json')?.mimeType).toBe('application/json');
    expect(fmts.find(f => f.format === 'csv')?.mimeType).toBe('text/csv');
  });
});
