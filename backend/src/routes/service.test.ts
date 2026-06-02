// Route-level tests — exercises Express routes via in-process HTTP.
// We sign a real JWT to satisfy the `authenticate` middleware.
import { describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { mockStore } from '../db/mock-store.js';
import { mapRouter } from './map.js';

beforeAll(() => { delete process.env.DATABASE_URL; });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/maps', mapRouter);
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

describe('Map routes', () => {
  let port: number;
  let close: () => void;
  beforeEach(() => { mockStore.clear(); const t = buildApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET / returns user maps', async () => {
    const u = await mockStore.createUser({ email: 'm@e.com', password: 'x', name: 'M', level: 1, reputation: 0, credits: 0 });
    await mockStore.createMap({ userId: u.id, name: 'Map1', description: '', isPublic: true });
    const r = await req({ port, method: 'GET', path: '/api/v1/maps', headers: authHeader(u.id) });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
  });

  test('GET / returns 401 without token', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/maps' });
    expect(r.status).toBe(401);
  });

  test('POST / creates a map', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/maps', headers: authHeader(), body: { name: 'New' } });
    expect(r.status).toBe(201);
    expect(r.body.data.name).toBe('New');
  });

  test('POST / rejects missing name (400)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/maps', headers: authHeader(), body: {} });
    expect(r.status).toBe(400);
  });

  test('GET /:mapId returns a map', async () => {
    const u = await mockStore.createUser({ email: 'g@e.com', password: 'x', name: 'G', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    const r = await req({ port, method: 'GET', path: `/api/v1/maps/${m.id}`, headers: authHeader(u.id) });
    expect(r.status).toBe(200);
    expect(r.body.data.id).toBe(m.id);
  });

  test('GET /:mapId returns 404 for unknown map', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/maps/nope', headers: authHeader() });
    expect(r.status).toBe(404);
  });

  test('PATCH /:mapId updates a map', async () => {
    const u = await mockStore.createUser({ email: 'p@e.com', password: 'x', name: 'P', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'old', description: '', isPublic: false });
    const r = await req({ port, method: 'PATCH', path: `/api/v1/maps/${m.id}`, headers: authHeader(u.id), body: { name: 'new' } });
    expect(r.status).toBe(200);
    expect(r.body.data.name).toBe('new');
  });

  test('DELETE /:mapId deletes a map', async () => {
    const u = await mockStore.createUser({ email: 'd@e.com', password: 'x', name: 'D', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: false });
    const r = await req({ port, method: 'DELETE', path: `/api/v1/maps/${m.id}`, headers: authHeader(u.id) });
    expect(r.status).toBe(200);
  });

  test('GET /nodes paginates', async () => {
    const u = await mockStore.createUser({ email: 'n@e.com', password: 'x', name: 'N', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    for (let i = 0; i < 5; i++) await mockStore.createNode({ mapId: m.id, label: `n${i}`, description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const r = await req({ port, method: 'GET', path: `/api/v1/maps/nodes?mapId=${m.id}&page=1&limit=3`, headers: authHeader(u.id) });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(3);
    expect(r.body.pagination.total).toBe(5);
  });

  test('POST /nodes creates a node', async () => {
    const u = await mockStore.createUser({ email: 'cn@e.com', password: 'x', name: 'C', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    const r = await req({ port, method: 'POST', path: '/api/v1/maps/nodes', headers: authHeader(u.id), body: { mapId: m.id, label: 'L' } });
    expect(r.status).toBe(201);
    expect(r.body.data.label).toBe('L');
  });

  test('POST /nodes rejects missing label (400)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/maps/nodes', headers: authHeader(), body: { mapId: 'x' } });
    expect(r.status).toBe(400);
  });

  test('PATCH /nodes/:nodeId updates node', async () => {
    const u = await mockStore.createUser({ email: 'pn@e.com', password: 'x', name: 'P', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    const n = await mockStore.createNode({ mapId: m.id, label: 'old', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const r = await req({ port, method: 'PATCH', path: `/api/v1/maps/nodes/${n.id}`, headers: authHeader(u.id), body: { label: 'new' } });
    expect(r.status).toBe(200);
    expect(r.body.data.label).toBe('new');
  });

  test('DELETE /nodes/:nodeId deletes node and cascades edges', async () => {
    const u = await mockStore.createUser({ email: 'dn@e.com', password: 'x', name: 'D', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    const a = await mockStore.createNode({ mapId: m.id, label: 'a', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const b = await mockStore.createNode({ mapId: m.id, label: 'b', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const e = await mockStore.createEdge({ mapId: m.id, sourceId: a.id, targetId: b.id, label: '', metadata: {} });
    const r = await req({ port, method: 'DELETE', path: `/api/v1/maps/nodes/${a.id}`, headers: authHeader(u.id) });
    expect(r.status).toBe(200);
    expect(await mockStore.findEdgeById(e.id)).toBeNull();
  });

  test('GET /edges returns edges for a map', async () => {
    const u = await mockStore.createUser({ email: 'ge@e.com', password: 'x', name: 'E', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    const a = await mockStore.createNode({ mapId: m.id, label: 'a', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const b = await mockStore.createNode({ mapId: m.id, label: 'b', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    await mockStore.createEdge({ mapId: m.id, sourceId: a.id, targetId: b.id, label: 'l', metadata: {} });
    const r = await req({ port, method: 'GET', path: `/api/v1/maps/edges?mapId=${m.id}`, headers: authHeader(u.id) });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
  });

  test('POST /edges creates an edge', async () => {
    const u = await mockStore.createUser({ email: 'ce@e.com', password: 'x', name: 'C', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    const a = await mockStore.createNode({ mapId: m.id, label: 'a', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const b = await mockStore.createNode({ mapId: m.id, label: 'b', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const r = await req({ port, method: 'POST', path: '/api/v1/maps/edges', headers: authHeader(u.id), body: { mapId: m.id, sourceId: a.id, targetId: b.id, label: 'x' } });
    expect(r.status).toBe(201);
  });

  test('POST /edges rejects missing fields (400)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/maps/edges', headers: authHeader(), body: { mapId: 'm' } });
    expect(r.status).toBe(400);
  });

  test('DELETE /edges/:edgeId deletes an edge', async () => {
    const u = await mockStore.createUser({ email: 'de@e.com', password: 'x', name: 'D', level: 1, reputation: 0, credits: 0 });
    const m = await mockStore.createMap({ userId: u.id, name: 'M', description: '', isPublic: true });
    const a = await mockStore.createNode({ mapId: m.id, label: 'a', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const b = await mockStore.createNode({ mapId: m.id, label: 'b', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const e = await mockStore.createEdge({ mapId: m.id, sourceId: a.id, targetId: b.id, label: '', metadata: {} });
    const r = await req({ port, method: 'DELETE', path: `/api/v1/maps/edges/${e.id}`, headers: authHeader(u.id) });
    expect(r.status).toBe(200);
    expect(await mockStore.findEdgeById(e.id)).toBeNull();
  });
});
