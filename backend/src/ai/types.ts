// AI Generation Types

export interface GenerateNodesInput {
  mapId: string;
  context?: string;
  count?: number;
  nodeType?: 'concept' | 'agent' | 'action' | 'resource' | 'event' | 'milestone';
}

export interface GenerateNodesOutput {
  nodes: Array<{
    id: string;
    label: string;
    description: string;
    nodeType: string;
    position?: { x: number; y: number };
    metadata?: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateEdgesInput {
  mapId: string;
  sourceNodeId: string;
  targetNodeId?: string;
  edgeType?: 'dependency' | 'association' | 'composition' | 'inheritance' | 'communication';
  label?: string;
}

export interface GenerateEdgesOutput {
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    edgeType: string;
    metadata?: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AISuggestion {
  id: string;
  type: 'node' | 'edge' | 'layout' | 'optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

export interface GenerateContextInput {
  mapId: string;
  nodeIds: string[];
  task: 'explain' | 'expand' | 'refine' | 'summarize';
}

export interface GenerateContextOutput {
  content: string;
  relatedNodes?: string[];
  suggestions?: AISuggestion[];
}
