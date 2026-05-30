// Export Types

export interface ExportMapInput {
  mapId: string;
  format: 'json' | 'png' | 'svg' | 'csv';
  includeMetadata?: boolean;
  includeStyles?: boolean;
}

export interface ExportResult {
  success: boolean;
  data?: {
    format: string;
    content: string | object;
    filename: string;
    mimeType: string;
    size?: number;
  };
  error?: string;
}

export interface ImportMapInput {
  format: 'json' | 'csv';
  content: string;
  name?: string;
  description?: string;
}

export interface ImportResult {
  success: boolean;
  data?: {
    mapId: string;
    nodeCount: number;
    edgeCount: number;
    name?: string;
    description?: string;
  };
  error?: string;
}
