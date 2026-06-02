// Middleware tests — auth + assetAuth (3-layer resolution) + optionalAuth + error handler.
import { describe, test, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import {
  assetAuth, assetAuthRequired, requireHumanIdentity,
  registerApiKey, registerNodeSecret, clearApiKeys, clearNodeSecrets,
  type AssetAuthRequest,
} from './assetAuth.js';
import { authenticate, optionalAuth } from './auth.js';
import { errorHandler, HttpError } from './errorHandler.js';

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(b: any) { this.body = b; this.headersSent = true; return this; },
  };
  return res;
}

function runMiddleware(mw: any, req: any): Promise<{ res: any; nextCalled: boolean; nextErr?: any }> {
  return new Promise((resolve) => {
    const res = mockRes();
    let nextCalled = false; let nextErr: any;
    const next = (err?: any) => { nextCalled = true; nextErr = err; };
    try {
      const r = mw(req, res, next);
      if (r && typeof r.then === 'function') r.then(() => resolve({ res, nextCalled, nextErr }));
      else resolve({ res, nextCalled, nextErr });
    } catch (e) {
      resolve({ res, nextCalled: true, nextErr: e });
    }
  });
}

beforeEach(() => {
  clearApiKeys();
  clearNodeSecrets();
});

describe('authenticate middleware', () => {
  test('rejects when no token is present (401)', async () => {
    const { res, nextCalled, nextErr } = await runMiddleware(authenticate, { headers: {} });
    expect(nextCalled).toBe(true);
    expect(nextErr).toBeTruthy();
    expect(nextErr.statusCode).toBe(401);
  });

  test('rejects malformed Bearer (401)', async () => {
    const { nextErr } = await runMiddleware(authenticate, { headers: { authorization: 'Bearer not-a-jwt' } });
    expect(nextErr.statusCode).toBe(401);
  });

  test('rejects token signed with wrong secret (401)', async () => {
    const t = jwt.sign({ userId: 'u1', email: 'a@b.com', role: 'user' }, 'wrong', { expiresIn: '1h' });
    const { nextErr } = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${t}` } });
    expect(nextErr.statusCode).toBe(401);
  });

  test('accepts a valid token and attaches req.user', async () => {
    const t = jwt.sign({ userId: 'u1', email: 'a@b.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
    const req: any = { headers: { authorization: `Bearer ${t}` } };
    const { nextCalled, nextErr } = await runMiddleware(authenticate, req);
    expect(nextCalled).toBe(true);
    expect(nextErr).toBeFalsy();
    expect(req.user.userId).toBe('u1');
  });
});

describe('assetAuth middleware (3-layer resolution)', () => {
  test('anonymous request resolves to anonymous identity', async () => {
    const req: AssetAuthRequest = { headers: {} };
    const { nextCalled } = await runMiddleware(assetAuth, req);
    expect(nextCalled).toBe(true);
    expect(req.assetAuth?.kind).toBe('anonymous');
  });

  test('resolves a valid session Bearer token', async () => {
    const t = jwt.sign({ userId: 'sess-u', email: 's@e.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
    const req: AssetAuthRequest = { headers: { authorization: `Bearer ${t}` } };
    await runMiddleware(assetAuth, req);
    expect(req.assetAuth?.kind).toBe('session');
    expect(req.assetAuth?.userId).toBe('sess-u');
  });

  test('resolves a valid API key', async () => {
    registerApiKey({ userId: 'ak-u', email: 'a@e.com', role: 'user', key: 'ek_secret_abc' });
    const req: AssetAuthRequest = { headers: { 'x-api-key': 'ek_secret_abc' } };
    await runMiddleware(assetAuth, req);
    expect(req.assetAuth?.kind).toBe('api_key');
    expect(req.assetAuth?.userId).toBe('ak-u');
    expect(req.assetAuth?.apiKeyPrefix).toBe('ek_secre');
  });

  test('resolves a valid node secret', async () => {
    registerNodeSecret({ nodeId: 'node_abc', secret: 'sek' });
    const req: AssetAuthRequest = { headers: { 'x-node-id': 'node_abc', 'x-node-secret': 'sek' } };
    await runMiddleware(assetAuth, req);
    expect(req.assetAuth?.kind).toBe('node_secret');
    expect(req.assetAuth?.nodeId).toBe('node_abc');
  });

  test('falls back to anonymous when API key is unknown', async () => {
    const req: AssetAuthRequest = { headers: { 'x-api-key': 'ek_unknown' } };
    await runMiddleware(assetAuth, req);
    expect(req.assetAuth?.kind).toBe('anonymous');
  });

  test('assetAuthRequired rejects anonymous (401)', async () => {
    const req: AssetAuthRequest = { headers: {} };
    await runMiddleware(assetAuth, req);
    const { nextErr } = await runMiddleware(assetAuthRequired, req);
    expect(nextErr).toBeTruthy();
    expect(nextErr.statusCode).toBe(401);
  });

  test('assetAuthRequired accepts a session identity', async () => {
    const t = jwt.sign({ userId: 'u1', email: 'a@b.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
    const req: AssetAuthRequest = { headers: { authorization: `Bearer ${t}` } };
    await runMiddleware(assetAuth, req);
    const { nextErr } = await runMiddleware(assetAuthRequired, req);
    expect(nextErr).toBeFalsy();
  });

  test('requireHumanIdentity rejects node_secret (403)', async () => {
    registerNodeSecret({ nodeId: 'node_x', secret: 's' });
    const req: AssetAuthRequest = { headers: { 'x-node-id': 'node_x', 'x-node-secret': 's' } };
    await runMiddleware(assetAuth, req);
    const { nextErr } = await runMiddleware(requireHumanIdentity, req);
    expect(nextErr).toBeTruthy();
    expect(nextErr.statusCode).toBe(403);
  });

  test('requireHumanIdentity accepts a session identity', async () => {
    const t = jwt.sign({ userId: 'u1', email: 'a@b.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
    const req: AssetAuthRequest = { headers: { authorization: `Bearer ${t}` } };
    await runMiddleware(assetAuth, req);
    const { nextErr } = await runMiddleware(requireHumanIdentity, req);
    expect(nextErr).toBeFalsy();
  });
});

describe('optionalAuth middleware', () => {
  test('proceeds without user when no token present', async () => {
    const req: any = { headers: {} };
    const { nextCalled, nextErr } = await runMiddleware(optionalAuth, req);
    expect(nextCalled).toBe(true);
    expect(nextErr).toBeFalsy();
    expect(req.user).toBeUndefined();
  });

  test('attaches req.user when valid token present', async () => {
    const t = jwt.sign({ userId: 'opt-u', email: 'o@e.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
    const req: any = { headers: { authorization: `Bearer ${t}` } };
    const { nextCalled } = await runMiddleware(optionalAuth, req);
    expect(nextCalled).toBe(true);
    expect(req.user.userId).toBe('opt-u');
  });

  test('ignores invalid token and proceeds anyway', async () => {
    const req: any = { headers: { authorization: 'Bearer invalid-token' } };
    const { nextCalled, nextErr } = await runMiddleware(optionalAuth, req);
    expect(nextCalled).toBe(true);
    expect(nextErr).toBeFalsy();
    expect(req.user).toBeUndefined();
  });
});

describe('errorHandler middleware', () => {
  test('handles HttpError with correct status', () => {
    const err = new HttpError(422, 'Validation failed');
    const req: any = {};
    const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(b: any) { this.body = b; return this; } };
    errorHandler(err, req, res, () => {});
    expect(res.statusCode).toBe(422);
    expect(res.body.error.message).toBe('Validation failed');
  });

  test('handles generic Error with 500', () => {
    const err = new Error('something broke');
    const req: any = {};
    const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(b: any) { this.body = b; return this; } };
    errorHandler(err, req, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('something broke');
  });
});
