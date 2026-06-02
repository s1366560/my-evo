// AI + Graph + Dashboard + Export + Auth routes — in-process HTTP test suite.
import { describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { mockStore } from '../db/mock-store.js';
import { aiRouter } from '../routes/ai.js';
import { graphRouter } from '../routes/graph.js';
import { exportRouter } from '../routes/export.js';
import { dashboardRouter } from '../routes/dashboard.js';
import { authRouter } from '../routes/auth.js';

beforeAll(() => { delete process.env.DATABASE_URL; });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai', aiRouter);
  app.use('/api/v1/graph', graphRouter);
  app.use('/api/v1/export', exportRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/auth', authRouter);
  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { port, close: () => server.close() };
}

function authHeader(userId = 'user_test_1') {
  const token = jwt.sign({ userId, email: 't@example.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
  return { authorization: `Bearer ${token}` };
}

function req(opts: { port: number; method: string; path: string; body?: unknown; headers?: Record<string, string> }) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = opts.body !== undefined ? JSON.stringify(opts.body) : null;
    const r = http.request({
      hostname: '127.0.0.1', port: opts.port, path: opts.path, method: opts.method,
      headers: { 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}), ...(opts.headers || {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        let body: any = text;
        try { body = JSON.parse(text); } catch { /* keep text */ }
        resolve({ status: res.statusCode || 0, body });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

describe('AI routes', () => {
  let port: number; let close: () => void;
  beforeEach(() => { mockStore.clear(); const t = buildApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET /status returns AI service status', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/ai/status' });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveProperty('provider');
  });

  test('POST /generate/nodes returns generated nodes', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/generate/nodes', headers: authHeader(), body: { mapId: 'm1', count: 2 } });
    expect(r.status).toBe(200);
    expect(r.body.data.nodes).toHaveLength(2);
  });

  test('POST /generate/nodes rejects missing mapId (400)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/generate/nodes', headers: authHeader(), body: { count: 1 } });
    expect(r.status).toBe(400);
  });

  test('POST /generate/nodes rejects missing auth (401)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/generate/nodes', body: { mapId: 'm1' } });
    expect(r.status).toBe(401);
  });

  test('POST /generate/edges returns an edge', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/generate/edges', headers: authHeader(), body: { mapId: 'm1', sourceNodeId: 'a', targetNodeId: 'b' } });
    expect(r.status).toBe(200);
    expect(r.body.data.edges).toHaveLength(1);
  });

  test('POST /generate/edges rejects missing auth (401)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/generate/edges', body: { sourceNodeId: 'a' } });
    expect(r.status).toBe(401);
  });

  test('POST /suggestions returns suggestions', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/suggestions', headers: authHeader(), body: { mapId: 'm1' } });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(3);
  });

  test('POST /context returns context', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/context', headers: authHeader(), body: { mapId: 'm1', nodeIds: ['n1'], task: 'explain' } });
    expect(r.status).toBe(200);
    expect(typeof r.body.data.content).toBe('string');
  });

  test('POST /expand expands a concept', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/ai/expand', headers: authHeader(), body: { mapId: 'm1', nodeId: 'n1', concept: 'API' } });
    expect(r.status).toBe(200);
    expect(r.body.data.nodes).toHaveLength(3);
  });
});

describe('Graph routes', () => {
  let port: number; let close: () => void;
  beforeEach(() => { mockStore.clear(); const t = buildApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET / returns a message with userId', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/graph', headers: authHeader() });
    expect(r.status).toBe(200);
    expect(r.body.data.userId).toBeTruthy();
  });

  test('GET / returns 401 without auth', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/graph' });
    expect(r.status).toBe(401);
  });

  test('GET /pagerank returns ranks', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/graph/pagerank', headers: authHeader() });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });

  test('GET /cycles returns cycles (empty in mock)', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/graph/cycles', headers: authHeader() });
    expect(r.status).toBe(200);
  });

  test('GET /toposort returns order (empty in mock)', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/graph/toposort', headers: authHeader() });
    expect(r.status).toBe(200);
  });

  test('GET /path returns no path in mock', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/graph/path?source=a&target=b', headers: authHeader() });
    expect(r.status).toBe(200);
    expect(r.body.data.distance).toBe(-1);
  });

  test('POST /layout returns laid out nodes', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/graph/layout', headers: authHeader(), body: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ source: 'a', target: 'b' }], algorithm: 'grid' } });
    expect(r.status).toBe(200);
    expect(r.body.data.nodes).toHaveLength(2);
  });

  test('POST /validate returns valid for a well-formed graph', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/graph/validate', headers: authHeader(), body: { nodes: [{ id: 'a' }], edges: [] } });
    expect(r.status).toBe(200);
    expect(r.body.data.valid).toBe(true);
  });
});

describe('Dashboard routes', () => {
  let port: number; let close: () => void;
  beforeEach(() => { const t = buildApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET / returns the full dashboard', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/dashboard' });
    expect(r.status).toBe(200);
    expect(r.body.user.username).toBe('demouser');
    expect(r.body.credits.balance).toBeGreaterThan(0);
  });

  test('GET /user returns user profile', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/dashboard/user' });
    expect(r.status).toBe(200);
    expect(r.body.username).toBe('demouser');
  });

  test('GET /stats returns stats', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/dashboard/stats' });
    expect(r.status).toBe(200);
    expect(r.body.total_assets).toBeDefined();
  });

  test('GET /assets returns recent assets', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/dashboard/assets' });
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });

  test('GET /activity returns activity feed', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/dashboard/activity' });
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });

  test('GET /trending returns trending signals', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/dashboard/trending' });
    expect(r.status).toBe(200);
  });

  test('GET /credits returns credit info', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/dashboard/credits' });
    expect(r.status).toBe(200);
    expect(r.body.balance).toBeGreaterThan(0);
  });
});

describe('Export routes', () => {
  let port: number; let close: () => void;
  beforeEach(() => { mockStore.clear(); const t = buildApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('POST /map rejects missing mapId (400)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/export/map', headers: authHeader(), body: { format: 'json' } });
    expect(r.status).toBe(400);
  });

  test('POST /map rejects missing format (400)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/export/map', headers: authHeader(), body: { mapId: 'm1' } });
    expect(r.status).toBe(400);
  });

  test('POST /map returns 401 without auth', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/export/map', body: { mapId: 'm1', format: 'json' } });
    expect(r.status).toBe(401);
  });

  test('GET /formats returns supported formats (no auth needed)', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/export/formats' });
    expect(r.status).toBe(200);
    expect(r.body.data.formats).toBeDefined();
    expect(r.body.data.formats.length).toBe(5);
  });

  test('POST /import rejects missing content (400)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/export/import', headers: authHeader(), body: {} });
    expect(r.status).toBe(400);
  });

  test('POST /import returns 401 without auth', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/export/import', body: { content: '{}' } });
    expect(r.status).toBe(401);
  });

  test('POST /import returns 503 in mock mode (no DB)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/export/import', headers: authHeader(), body: { content: '{"nodes":[]}' } });
    expect(r.status).toBe(503);
  });
});

describe('Auth routes', () => {
  let port: number; let close: () => void;
  beforeEach(() => { mockStore.clear(); const t = buildApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET /me returns 401 without auth', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/auth/me' });
    expect(r.status).toBe(401);
  });

  test('GET /me returns the current user (200)', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/auth/me', headers: authHeader('user_demo_1') });
    expect(r.status).toBe(200);
    expect(r.body.data.user.userId).toBe('user_demo_1');
  });

  test('POST /register creates a user via the router (201)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'r@e.com', password: 'Password123!', name: 'R' } });
    expect(r.status).toBe(201);
  });

  test('POST /login authenticates via the router (200)', async () => {
    await req({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'l@e.com', password: 'Password123!', name: 'L' } });
    const r = await req({ port, method: 'POST', path: '/api/v1/auth/login', body: { email: 'l@e.com', password: 'Password123!' } });
    expect(r.status).toBe(200);
  });

  test('POST /refresh issues a new access token via the router (200)', async () => {
    const reg = await req({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 't@e.com', password: 'Password123!', name: 'T' } });
    const refreshToken = reg.body.data.refreshToken;
    const r = await req({ port, method: 'POST', path: '/api/v1/auth/refresh', body: { refreshToken } });
    expect(r.status).toBe(200);
  });

  test('POST /forgot-password via the router (202)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/auth/forgot-password', body: { email: 'nope@e.com' } });
    expect(r.status).toBe(202);
  });
});
