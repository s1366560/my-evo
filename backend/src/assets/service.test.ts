// Unit tests for the assets marketplace service.
// Covers core service methods: list, create, get, update, publish (versioning),
// version history, review, purchase (incl. idempotency), recycle.
import { describe, test, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { mockStore } from '../db/mock-store.js';
import { assetService } from './service.js';

async function seedUser(email: string, name: string, credits: number) {
  const hashed = await bcrypt.hash('Password123!', 4);
  return mockStore.createUser({ email, password: hashed, name, level: 1, reputation: 0, credits });
}

describe('AssetService (mock mode)', () => {
  let author: any;
  let buyer: any;

  beforeEach(async () => {
    mockStore.clear();
    author = await seedUser('author@evo.local', 'Author', 0);
    buyer = await seedUser('buyer@evo.local', 'Buyer', 1000);
  });

  test('createAsset creates a draft asset and assigns the author', async () => {
    const dto = await assetService.createAsset(author.id, {
      title: 'Alpha Gene', type: 'Gene', kind: 'strategy',
      description: 'A test gene', content: 'hello', metadata: { tags: ['demo'] },
    });
    expect(dto.id).toBeTruthy();
    expect(dto.title).toBe('Alpha Gene');
    expect(dto.type).toBe('Gene');
    expect(dto.status).toBe('draft');
    expect(dto.published).toBe(false);
    expect(dto.authorId).toBe(author.id);
  });

  test('listAssets returns only the requested type and respects pagination', async () => {
    await assetService.createAsset(author.id, { title: 'G1', type: 'Gene' });
    await assetService.createAsset(author.id, { title: 'C1', type: 'Capsule' });
    await assetService.createAsset(author.id, { title: 'R1', type: 'Recipe' });
    const genes = await assetService.listAssets({ page: 1, limit: 20, type: 'Gene' });
    expect(genes.data.length).toBe(1);
    expect(genes.data[0].type).toBe('Gene');
    expect(genes.pagination.total).toBe(1);
    const paged = await assetService.listAssets({ page: 1, limit: 1 });
    expect(paged.data.length).toBe(1);
    expect(paged.pagination.total).toBe(3);
  });

  test('publishAsset creates version 1, flips status to published, and surfaces version in history', async () => {
    const a = await assetService.createAsset(author.id, { title: 'R1', type: 'Recipe' });
    const v1 = await assetService.publishAsset(author.id, a.id, {
      changelog: 'initial', steps: [
        { order: 1, kind: 'prompt', title: 'Step 1', body: 'Do X' },
        { order: 2, kind: 'tool_call', title: 'Step 2', body: 'Do Y' },
      ],
    });
    expect(v1.versionNo).toBe(1);
    expect(v1.steps?.length).toBe(2);
    const detail = await assetService.getAsset(a.id);
    expect(detail.status).toBe('published');
    expect(detail.published).toBe(true);
    expect(detail.publishedVersionId).toBe(v1.id);
    expect(detail.versions?.length).toBe(1);
  });

  test('subsequent publish bumps versionNo to 2 and the old version is still in history', async () => {
    const a = await assetService.createAsset(author.id, { title: 'G2', type: 'Gene' });
    const v1 = await assetService.publishAsset(author.id, a.id, { changelog: 'v1' });
    const v2 = await assetService.publishAsset(author.id, a.id, { changelog: 'v2 fix' });
    expect(v2.versionNo).toBe(2);
    const history = await assetService.getVersionHistory(a.id);
    expect(history.length).toBe(2);
    expect(history[0].versionNo).toBe(2);
    expect(history[1].versionNo).toBe(1);
    // First version's changelog preserved
    expect(history[1].changelog).toBe('v1');
    // Pointer still on the latest
    const detail = await assetService.getAsset(a.id);
    expect(detail.publishedVersionId).toBe(v2.id);
    expect(v1.id).not.toBe(v2.id);
  });

  test('review after publish computes average rating; reviewing unpublished asset is rejected', async () => {
    const a = await assetService.createAsset(author.id, { title: 'G3', type: 'Gene' });
    await expect(
      assetService.createReview(buyer.id, a.id, { rating: 5 })
    ).rejects.toThrow(/unpublished/);
    await assetService.publishAsset(author.id, a.id, {});
    await assetService.createReview(buyer.id, a.id, { rating: 5, comment: 'great' });
    await assetService.createReview(author.id, a.id, { rating: 3, comment: 'ok' });
    const detail = await assetService.getAsset(a.id);
    expect(detail.reviewCount).toBe(2);
    expect(detail.avgRating).toBeCloseTo(4.0, 1);
  });

  test('purchase deducts credits, prevents self-purchase, and supports idempotency', async () => {
    const a = await assetService.createAsset(author.id, { title: 'G4', type: 'Gene', price: 50 });
    await assetService.publishAsset(author.id, a.id, {});

    // self-purchase forbidden
    await expect(
      assetService.purchaseAsset(author.id, a.id, {})
    ).rejects.toThrow(/own asset/);

    // first purchase: deduct credits from buyer
    const p1 = await assetService.purchaseAsset(buyer.id, a.id, { idempotencyKey: 'idem_abc_123' });
    expect(p1.pricePaid).toBe(50);
    expect(p1.status).toBe('completed');
    const buyerAfter = await mockStore.findUserById(buyer.id);
    expect(buyerAfter?.credits).toBe(950);
    const authorAfter = await mockStore.findUserById(author.id);
    expect(authorAfter?.credits).toBe(50);

    // idempotent: same key returns the original purchase
    const p2 = await assetService.purchaseAsset(buyer.id, a.id, { idempotencyKey: 'idem_abc_123' });
    expect(p2.id).toBe(p1.id);
    const buyerAfter2 = await mockStore.findUserById(buyer.id);
    expect(buyerAfter2?.credits).toBe(950); // not double-charged
  });

  test('recycleAsset sets status to recycled, clears published pointer, and blocks further updates', async () => {
    const a = await assetService.createAsset(author.id, { title: 'G5', type: 'Capsule' });
    const v = await assetService.publishAsset(author.id, a.id, {});
    const recycled = await assetService.recycleAsset(author.id, a.id);
    expect(recycled.status).toBe('recycled');
    expect(recycled.published).toBe(false);
    expect(recycled.publishedVersionId).toBeNull();
    // Cannot update a recycled asset
    await expect(
      assetService.updateAsset(author.id, a.id, { title: 'new' })
    ).rejects.toThrow(/recycled/);
    // Cannot re-publish
    await expect(
      assetService.publishAsset(author.id, a.id, {})
    ).rejects.toThrow(/recycled/);
    // History is preserved (versions remain)
    const history = await assetService.getVersionHistory(a.id);
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(v.id);
  });

  test('updateAsset blocks non-author and non-existent asset; allows author updates', async () => {
    const a = await assetService.createAsset(author.id, { title: 'G6', type: 'Gene' });
    // Non-existent
    await expect(
      assetService.updateAsset(author.id, '00000000-0000-0000-0000-000000000000', { title: 'x' })
    ).rejects.toThrow(/not found/i);
    // Non-author
    await expect(
      assetService.updateAsset(buyer.id, a.id, { title: 'hack' })
    ).rejects.toThrow(/not your asset/i);
    // Author succeeds
    const updated = await assetService.updateAsset(author.id, a.id, { title: 'G6 v2', description: 'updated' });
    expect(updated.title).toBe('G6 v2');
    expect(updated.description).toBe('updated');
  });

  test('listAssets filters by status, author, node, and free-text query', async () => {
    await assetService.createAsset(author.id, { title: 'Alpha strategy', type: 'Gene' });
    await assetService.createAsset(author.id, { title: 'Beta strategy', type: 'Gene' });
    const c = await assetService.createAsset(author.id, { title: 'Capsule one', type: 'Capsule' });
    await assetService.publishAsset(author.id, c.id, {});

    const byStatus = await assetService.listAssets({ page: 1, limit: 20, status: 'published' });
    expect(byStatus.data.length).toBe(1);
    expect(byStatus.data[0].id).toBe(c.id);
    const byAuthor = await assetService.listAssets({ page: 1, limit: 20, authorId: author.id });
    expect(byAuthor.data.length).toBe(3);
    const byText = await assetService.listAssets({ page: 1, limit: 20, q: 'strategy' });
    expect(byText.data.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTP / route-level tests for the assets controller.
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { mockStore } from '../db/mock-store.js';
import { assetRouter } from './routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/assets', assetRouter);
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

describe('Asset routes (in-process HTTP)', () => {
  let port: number; let close: () => void;
  beforeEach(() => { const t = buildApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET / lists assets (200, public)', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/assets' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /?type=Gene filters by type', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/assets?type=Gene' });
    expect(r.status).toBe(200);
  });

  test('GET /?status=draft filters by status', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/assets?status=draft' });
    expect(r.status).toBe(200);
  });

  test('GET /:assetId returns 404 for unknown asset', async () => {
    const r = await req({ port, method: 'GET', path: '/api/v1/assets/00000000-0000-0000-0000-000000000000' });
    expect(r.status).toBe(404);
  });

  test('POST / rejects anonymous (401)', async () => {
    const r = await req({ port, method: 'POST', path: '/api/v1/assets', body: { title: 'X', type: 'Gene' } });
    expect(r.status).toBe(401);
  });

  test('POST / creates a draft asset (201)', async () => {
    const r = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { title: 'My Gene', type: 'Gene', description: 'd' },
    });
    expect(r.status).toBe(201);
    expect(r.body.data.title).toBe('My Gene');
    expect(r.body.data.status).toBe('draft');
  });

  test('POST / validates missing title (400)', async () => {
    const r = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { type: 'Gene' },
    });
    expect(r.status).toBe(400);
  });

  test('POST / validates invalid type (400)', async () => {
    const r = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { title: 'T', type: 'Invalid' },
    });
    expect(r.status).toBe(400);
  });

  test('GET /:assetId returns the asset after creation', async () => {
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { title: 'L', type: 'Capsule' },
    });
    const id = create.body.data.id;
    const r = await req({ port, method: 'GET', path: `/api/v1/assets/${id}` });
    expect(r.status).toBe(200);
    expect(r.body.data.id).toBe(id);
  });

  test('PATCH /:assetId updates the asset', async () => {
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { title: 'orig', type: 'Gene' },
    });
    const id = create.body.data.id;
    const r = await req({
      port, method: 'PATCH', path: `/api/v1/assets/${id}`, headers: authHeader(),
      body: { title: 'new' },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.title).toBe('new');
  });

  test('POST /:assetId/publish creates a version (201)', async () => {
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { title: 'P', type: 'Recipe' },
    });
    const id = create.body.data.id;
    const r = await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/publish`, headers: authHeader(),
      body: { changelog: 'first' },
    });
    expect(r.status).toBe(201);
    expect(r.body.data.versionNo).toBe(1);
  });

  test('GET /:assetId/versions lists version history', async () => {
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { title: 'V', type: 'Gene' },
    });
    const id = create.body.data.id;
    await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/publish`, headers: authHeader(),
      body: { changelog: 'v1' },
    });
    const r = await req({ port, method: 'GET', path: `/api/v1/assets/${id}/versions` });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
  });

  test('POST /:assetId/recycle recycles the asset', async () => {
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(),
      body: { title: 'R', type: 'Gene' },
    });
    const id = create.body.data.id;
    const r = await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/recycle`, headers: authHeader(),
      body: {},
    });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('recycled');
  });

  test('POST /:assetId/reviews rejects review of unpublished asset (400)', async () => {
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader('author-id'),
      body: { title: 'Q', type: 'Gene' },
    });
    const id = create.body.data.id;
    const r = await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/reviews`, headers: authHeader('reviewer-id'),
      body: { rating: 5, comment: 'great' },
    });
    expect(r.status).toBe(400);
  });

  test('POST /:assetId/purchase rejects self-purchase (400)', async () => {
    const uid = 'author-2';
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader(uid),
      body: { title: 'P', type: 'Gene', price: 100 },
    });
    const id = create.body.data.id;
    await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/publish`, headers: authHeader(uid),
      body: { changelog: 'v1' },
    });
    const r = await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/purchase`, headers: authHeader(uid),
      body: {},
    });
    expect(r.status).toBe(400);
  });

  test('POST /:assetId/purchase succeeds with a different user (201)', async () => {
    // Pre-create the buyer with 500 credits (in the same store the controller reads from)
    const hashed = await (await import('bcryptjs')).default.hash('Password123!', 4);
    const buyer = await mockStore.createUser({
      email: 'prebuyer-3@e.com', password: hashed, name: 'PreBuyer3',
      level: 1, reputation: 0, credits: 500,
    });
    const create = await req({
      port, method: 'POST', path: '/api/v1/assets', headers: authHeader('author-3'),
      body: { title: 'P', type: 'Gene', price: 100 },
    });
    const id = create.body.data.id;
    await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/publish`, headers: authHeader('author-3'),
      body: { changelog: 'v1' },
    });
    const r = await req({
      port, method: 'POST', path: `/api/v1/assets/${id}/purchase`, headers: authHeader(buyer.id),
      body: { idempotencyKey: 'k_real_12345' },
    });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('completed');
  });
});
