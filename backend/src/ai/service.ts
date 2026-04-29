// AI Generation Service - Mock LLM Integration
import { v4 as uuidv4 } from 'uuid';
import type { GenerateNodesInput, GenerateNodesOutput, GenerateEdgesInput, GenerateEdgesOutput, AISuggestion, GenerateContextInput, GenerateContextOutput } from './types.js';

const NODE_TEMPLATES = [
  { label: 'Data Processing', description: 'Handles data transformation', nodeType: 'concept' },
  { label: 'ML Model Training', description: 'Trains ML models', nodeType: 'agent' },
  { label: 'API Gateway', description: 'Manages API requests', nodeType: 'resource' },
  { label: 'Authentication', description: 'Validates credentials', nodeType: 'action' },
  { label: 'Cache Manager', description: 'Manages distributed caching', nodeType: 'resource' },
  { label: 'Event Processor', description: 'Processes async events', nodeType: 'event' },
];

const EDGE_TEMPLATES = [
  { label: 'triggers', edgeType: 'dependency' },
  { label: 'part of', edgeType: 'composition' },
  { label: 'communicates with', edgeType: 'communication' },
  { label: 'related to', edgeType: 'association' },
];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const tokens = () => ({ promptTokens: 200, completionTokens: 100, totalTokens: 300 });

export class AIService {
  async generateNodes(input: GenerateNodesInput): Promise<GenerateNodesOutput> {
    await delay(200);
    const count = input.count || 3;
    const nodes = Array.from({ length: count }, () => {
      const t = rand(NODE_TEMPLATES);
      return {
        id: `node_ai_${uuidv4().slice(0, 8)}`,
        label: `${t.label} ${Date.now().toString(36).slice(-3)}`,
        description: t.description,
        nodeType: input.nodeType || t.nodeType,
        position: { x: Math.random() * 800 + 100, y: Math.random() * 600 + 100 },
        metadata: { generatedAt: new Date().toISOString(), confidence: Math.random() * 0.3 + 0.7 },
      };
    });
    return { nodes, usage: tokens() };
  }

  async generateEdges(input: GenerateEdgesInput): Promise<GenerateEdgesOutput> {
    await delay(150);
    const t = rand(EDGE_TEMPLATES);
    return {
      edges: [{
        id: `edge_ai_${uuidv4().slice(0, 8)}`,
        source: input.sourceNodeId,
        target: input.targetNodeId || `node_${uuidv4().slice(0, 8)}`,
        label: input.label || t.label,
        edgeType: input.edgeType || t.edgeType,
        metadata: { generatedAt: new Date().toISOString() },
      }],
      usage: tokens(),
    };
  }

  async generateSuggestions(mapId: string): Promise<AISuggestion[]> {
    await delay(300);
    return [
      { id: uuidv4(), type: 'optimization', priority: 'high', title: 'Reduce edge complexity', description: 'Simplify multi-hop paths.', data: { mapId } },
      { id: uuidv4(), type: 'node', priority: 'medium', title: 'Add error handling', description: 'Some nodes lack error states.', data: { mapId, affectedNodes: 3 } },
      { id: uuidv4(), type: 'layout', priority: 'low', title: 'Improve grouping', description: 'Group by functional area.', data: { mapId } },
    ];
  }

  async generateContext(input: GenerateContextInput): Promise<GenerateContextOutput> {
    await delay(250);
    const content = { explain: 'Critical data flow path with processing, validation, inference.', expand: 'Add monitoring, backup, scalability.', refine: 'Good structure. Add labeling conventions.', summarize: 'Core data ingestion pipeline.' };
    return { content: content[input.task] || content.explain, relatedNodes: [uuidv4()], suggestions: [{ id: uuidv4(), type: 'node', priority: 'medium', title: 'Add docs', description: 'Clarify node purposes.' }] };
  }

  async expandConcept(mapId: string, nodeId: string, concept: string): Promise<GenerateNodesOutput> {
    await delay(300);
    const expansions: Record<string, typeof NODE_TEMPLATES> = {
      'API': [{ label: 'REST Handler', description: 'Handles REST requests', nodeType: 'agent' }, { label: 'GraphQL Resolver', description: 'Processes GraphQL', nodeType: 'agent' }, { label: 'WebSocket Manager', description: 'Real-time connections', nodeType: 'resource' }],
      'Database': [{ label: 'Connection Pool', description: 'DB connections', nodeType: 'resource' }, { label: 'Query Builder', description: 'Optimizes queries', nodeType: 'action' }, { label: 'Migration Runner', description: 'Schema migrations', nodeType: 'action' }],
      'Auth': [{ label: 'Token Validator', description: 'Validates tokens', nodeType: 'agent' }, { label: 'Session Manager', description: 'Manages sessions', nodeType: 'resource' }, { label: 'Permission Checker', description: 'Access control', nodeType: 'action' }],
    };
    const templates = expansions[concept.split(' ')[0]] || expansions['API'];
    return { nodes: templates.map(t => ({ id: `node_exp_${uuidv4().slice(0, 8)}`, label: t.label, description: t.description, nodeType: t.nodeType, position: { x: Math.random() * 400 + 200, y: Math.random() * 400 + 200 }, metadata: { expandedFrom: nodeId } })), usage: tokens() };
  }

  getStatus() { return { enabled: false, provider: 'mock', model: 'mock-llm' }; }
}

export const aiService = new AIService();
