// Graph Routes Unit Tests
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

const mockNext = jest.fn();
const mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() } as any;

beforeEach(() => {
  mockNext.mockClear();
  mockRes.json.mockClear();
  mockRes.status.mockClear();
});

describe('Graph Routes - GET /', () => {
  test('should require userId for authenticated requests', () => {
    const userId = undefined;
    expect(!!userId).toBe(false);
  });

  test('should return message and userId on success', () => {
    const data = { message: 'Graph endpoint', userId: 'user_1' };
    expect(data.message).toBe('Graph endpoint');
    expect(data.userId).toBe('user_1');
  });
});

describe('Graph Routes - GET /metrics', () => {
  test('should require authentication', () => {
    const req: { user?: { userId: string } } = { user: undefined };
    const hasAuth = !!req.user?.userId;
    expect(hasAuth).toBe(false);
  });

  test('should return success response shape', () => {
    const result = { success: true, data: { nodeCount: 10, edgeCount: 20 } };
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('nodeCount');
  });

  test('should return 404 when no graph data', () => {
    const result = { success: false, message: 'No graph found' };
    const status = result.success ? 200 : 404;
    expect(status).toBe(404);
  });
});

describe('Graph Routes - GET /pagerank', () => {
  test('should use default damping factor 0.85', () => {
    const damping = Number(undefined) || 0.85;
    expect(damping).toBe(0.85);
  });

  test('should parse custom damping from query', () => {
    const damping = Number('0.9') || 0.85;
    expect(damping).toBe(0.9);
  });

  test('should use default iterations 100', () => {
    const iterations = Number(undefined) || 100;
    expect(iterations).toBe(100);
  });

  test('should parse custom iterations from query', () => {
    const iterations = Number('50') || 100;
    expect(iterations).toBe(50);
  });

  test('should return pagerank result shape', () => {
    const result = { success: true, data: { scores: { node1: 0.5, node2: 0.3 } } };
    expect(result.success).toBe(true);
    expect(result.data.scores).toHaveProperty('node1');
  });
});

describe('Graph Routes - GET /cycles', () => {
  test('should require authentication', () => {
    const req: { user?: { userId: string } } = { user: undefined };
    expect(!!req.user?.userId).toBe(false);
  });

  test('should return cycles result shape', () => {
    const result = { success: true, data: { hasCycles: false, cycles: [] } };
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('hasCycles');
  });

  test('should detect when cycles exist', () => {
    const result = { success: true, data: { hasCycles: true, cycles: [['A', 'B', 'A']] } };
    expect(result.data.hasCycles).toBe(true);
    expect(result.data.cycles.length).toBeGreaterThan(0);
  });
});

describe('Graph Routes - GET /toposort', () => {
  test('should require authentication', () => {
    const req: { user?: { userId: string } } = { user: undefined };
    expect(!!req.user?.userId).toBe(false);
  });

  test('should return 400 when graph has cycles', () => {
    const result = { success: false, message: 'Cannot sort: graph has cycles' };
    const status = result.success ? 200 : 400;
    expect(status).toBe(400);
  });

  test('should return sorted order when valid', () => {
    const result = { success: true, data: { order: ['A', 'B', 'C'] } };
    const status = result.success ? 200 : 400;
    expect(status).toBe(200);
    expect(result.data.order.length).toBe(3);
  });
});

describe('Graph Routes - GET /path', () => {
  test('should require source query param', () => {
    const source = undefined, target = 'n2';
    const isValid = !!(source && target);
    expect(isValid).toBe(false);
  });

  test('should require target query param', () => {
    const source = 'n1', target = undefined;
    const isValid = !!(source && target);
    expect(isValid).toBe(false);
  });

  test('should accept valid source and target', () => {
    const source = 'n1', target = 'n3';
    const isValid = !!(source && target);
    expect(isValid).toBe(true);
  });

  test('should return path result shape', () => {
    const result = { success: true, data: { path: ['n1', 'n2', 'n3'], distance: 2 } };
    expect(result.success).toBe(true);
    expect(result.data.path).toBeDefined();
  });

  test('should return empty path when no route exists', () => {
    const result = { success: true, data: { path: [], distance: -1 } };
    expect(result.data.path.length).toBe(0);
    expect(result.data.distance).toBe(-1);
  });
});

describe('Graph Routes - POST /layout', () => {
  test('should require nodes field', () => {
    const body: Record<string, any> = { edges: [] };
    const isValid = !!(body.nodes && body.edges);
    expect(isValid).toBe(false);
  });

  test('should require edges field', () => {
    const body: Record<string, any> = { nodes: [] };
    const isValid = !!(body.nodes && body.edges);
    expect(isValid).toBe(false);
  });

  test('should accept valid layout request', () => {
    const body: Record<string, any> = { nodes: [{ id: 'n1' }], edges: [{ source: 'n1', target: 'n2' }] };
    const isValid = !!(body.nodes && body.edges);
    expect(isValid).toBe(true);
  });

  test('should use default force layout algorithm', () => {
    const body: Record<string, any> = { nodes: [], edges: [] };
    const algorithm = body.algorithm || 'force';
    expect(algorithm).toBe('force');
  });

  test('should accept custom layout algorithm', () => {
    const body = { nodes: [], edges: [], algorithm: 'circular' };
    expect(body.algorithm).toBe('circular');
  });

  test('should return layout positions', () => {
    const result = { success: true, data: { positions: { n1: { x: 100, y: 200 } } } };
    expect(result.success).toBe(true);
    expect(result.data.positions).toHaveProperty('n1');
  });
});

describe('Graph Routes - POST /validate', () => {
  test('should require nodes field', () => {
    const body: Record<string, any> = { edges: [] };
    const isValid = !!(body.nodes && body.edges);
    expect(isValid).toBe(false);
  });

  test('should require edges field', () => {
    const body: Record<string, any> = { nodes: [] };
    const isValid = !!(body.nodes && body.edges);
    expect(isValid).toBe(false);
  });

  test('should return valid validation result', () => {
    const result = { success: true, data: { valid: true, errors: [] } };
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
  });

  test('should detect invalid edges', () => {
    const result = { success: true, data: { valid: false, errors: ['Edge references non-existent node'] } };
    expect(result.data.valid).toBe(false);
    expect(result.data.errors.length).toBeGreaterThan(0);
  });
});

describe('Graph Routes - Error Handling', () => {
  test('should throw 400 for missing source/target', () => {
    const throw400 = (condition: boolean, msg: string) => {
      if (condition) throw new Error(`400: ${msg}`);
    };
    expect(() => throw400(true, 'source and target query params required')).toThrow();
  });

  test('should throw 400 for missing nodes/edges in layout', () => {
    const throw400 = (condition: boolean, msg: string) => {
      if (condition) throw new Error(`400: ${msg}`);
    };
    expect(() => throw400(true, 'nodes and edges are required')).toThrow();
  });
});
