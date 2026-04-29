// Export Service - Handles map export in various formats
import { Prisma } from '@prisma/client';

export interface ExportOptions {
  format: 'json' | 'csv' | 'png' | 'svg' | 'pdf';
  includeMetadata?: boolean;
  includeEdges?: boolean;
  includeAssets?: boolean;
}

export interface ExportResult {
  success: boolean;
  data?: string | Buffer;
  mimeType: string;
  filename: string;
  error?: string;
}

export class ExportService {
  /**
   * Export a map to specified format
   */
  async exportMap(
    mapId: string,
    nodes: any[],
    edges: any[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      switch (options.format) {
        case 'json':
          return this.exportAsJson(mapId, nodes, edges, options);
        case 'csv':
          return this.exportAsCsv(mapId, nodes, edges, options);
        case 'png':
        case 'svg':
        case 'pdf':
          return { success: false, mimeType: '', filename: '', error: 'Visual export not yet implemented' };
        default:
          return { success: false, mimeType: '', filename: '', error: 'Unsupported format' };
      }
    } catch (error) {
      return {
        success: false,
        mimeType: '',
        filename: '',
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  private exportAsJson(
    mapId: string,
    nodes: any[],
    edges: any[],
    options: ExportOptions
  ): ExportResult {
    const data: any = {
      mapId,
      exportedAt: new Date().toISOString(),
      nodes: options.includeMetadata
        ? nodes.map(n => ({ ...n }))
        : nodes.map(n => ({ id: n.id, label: n.label, type: n.type })),
    };

    if (options.includeEdges !== false) {
      data.edges = options.includeMetadata
        ? edges.map(e => ({ ...e }))
        : edges.map(e => ({ id: e.id, source: e.source, target: e.target }));
    }

    return {
      success: true,
      data: JSON.stringify(data, null, 2),
      mimeType: 'application/json',
      filename: `${mapId}-export.json`,
    };
  }

  private exportAsCsv(
    mapId: string,
    nodes: any[],
    _edges: any[],
    options: ExportOptions
  ): ExportResult {
    const headers = ['id', 'label', 'type', 'description'];
    if (options.includeMetadata) {
      headers.push('metadata', 'createdAt', 'updatedAt');
    }

    const rows = nodes.map(n => {
      const row = [n.id, n.label, n.type, n.description || ''];
      if (options.includeMetadata) {
        row.push(JSON.stringify(n.metadata || {}), n.createdAt, n.updatedAt);
      }
      return row.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    return {
      success: true,
      data: csv,
      mimeType: 'text/csv',
      filename: `${mapId}-nodes.csv`,
    };
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): { format: string; mimeType: string; description: string }[] {
    return [
      { format: 'json', mimeType: 'application/json', description: 'JSON format for re-import' },
      { format: 'csv', mimeType: 'text/csv', description: 'CSV format for spreadsheet' },
      { format: 'png', mimeType: 'image/png', description: 'PNG image (not yet implemented)' },
      { format: 'svg', mimeType: 'image/svg+xml', description: 'SVG vector graphic (not yet implemented)' },
      { format: 'pdf', mimeType: 'application/pdf', description: 'PDF document (not yet implemented)' },
    ];
  }
}

export const exportService = new ExportService();
