// OAuth service tests — complements the existing oauth.test.ts by exercising
// the service surface against the real mockStore: validateUser upsert path,
// buildAuthResponse fields, fetchProfileForCode mock branch.
import { describe, test, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { mockStore } from '../db/mock-store.js';
import { oauthService } from './service.js';
import { config } from '../config/index.js';
import { __resetOAuthStateStore } from './state.js';

beforeAll(() => {
  delete process.env.DATABASE_URL;
});

const CALLBACK_URI = 'http://localhost:3000/api/v1/auth/oauth/google/callback';

describe('OAuthService (mock mode, real store)', () => {
  beforeEach(() => {
    mockStore.clear();
    __resetOAuthStateStore();
  });

  test('buildAuthorizeUrl sets prompt=select_account for Google', () => {
    const r = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
    const url = new URL(r.url);
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  test('buildAuthorizeUrl omits prompt for GitHub', () => {
    const ghCb = 'http://localhost:3000/api/v1/auth/oauth/github/callback';
    const r = oauthService.buildAuthorizeUrl('github', ghCb);
    const url = new URL(r.url);
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  test('buildAuthorizeUrl rejects missing scheme in redirect_uri', () => {
    expect(() => oauthService.buildAuthorizeUrl('google', 'localhost/cb')).toThrow(/absolute http/i);
  });

  test('buildAuthorizeUrl rejects javascript: redirect_uri', () => {
    expect(() => oauthService.buildAuthorizeUrl('google', 'javascript:alert(1)')).toThrow(/absolute http/i);
  });

  test('callback creates a user with valid JWT and userId matches', async () => {
    const auth = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
    const r = await oauthService.handleCallback('google', {
      code: 'unique-code-A', state: auth.state, redirectUri: CALLBACK_URI,
    });
    expect(r.isNewUser).toBe(true);
    const decoded = jwt.verify(r.authResponse.accessToken, config.jwtSecret) as any;
    expect(decoded.userId).toBe(r.authResponse.user.id);
  });

  test('callback returns a refresh token that decodes to the same user', async () => {
    const auth = oauthService.buildAuthorizeUrl('github', 'http://localhost:3000/api/v1/auth/oauth/github/callback');
    const r = await oauthService.handleCallback('github', {
      code: 'github-X', state: auth.state,
      redirectUri: 'http://localhost:3000/api/v1/auth/oauth/github/callback',
    });
    const decoded = jwt.verify(r.authResponse.refreshToken, config.jwtSecret) as any;
    expect(decoded.userId).toBe(r.authResponse.user.id);
  });

  test('callback returning the same code is idempotent across calls', async () => {
    const a1 = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
    const first = await oauthService.handleCallback('google', {
      code: 'idempotent-1', state: a1.state, redirectUri: CALLBACK_URI,
    });
    const a2 = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
    const second = await oauthService.handleCallback('google', {
      code: 'idempotent-1', state: a2.state, redirectUri: CALLBACK_URI,
    });
    expect(first.authResponse.user.id).toBe(second.authResponse.user.id);
    expect(second.isNewUser).toBe(false);
  });

  test('callback with no state rejects as missing_state', async () => {
    await expect(
      oauthService.handleCallback('google', { code: 'any', redirectUri: CALLBACK_URI })
    ).rejects.toThrow(/missing_state/);
  });

  test('callback with state issued for a different provider rejects', async () => {
    const ghAuth = oauthService.buildAuthorizeUrl('github', 'http://localhost:3000/api/v1/auth/oauth/github/callback');
    await expect(
      oauthService.handleCallback('google', {
        code: 'any', state: ghAuth.state, redirectUri: CALLBACK_URI,
      })
    ).rejects.toThrow(/provider_mismatch/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OAuth controller tests — exercises redirect + callback handlers through
// an in-process Express app.
import express from 'express';
import http from 'node:http';
import { oauthController } from './controller.js';
import { oauthRouter } from './routes.js';

function buildOAuthApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/v1/auth/oauth/:provider', (req, res, next) => oauthController.redirect(req, res, next));
  app.get('/api/v1/auth/oauth/:provider/callback', (req, res, next) => oauthController.callback(req, res, next));
  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { port, close: () => server.close() };
}

function buildOAuthRouterApp() {
  // Use the real exported oauthRouter so the routes.ts file is exercised.
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth/oauth', oauthRouter);
  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { port, close: () => server.close() };
}

function oauthReq(opts: { port: number; method: string; path: string; headers?: Record<string, string> }) {
  return new Promise<{ status: number; headers: Record<string, string>; body: string }>((resolve, reject) => {
    const r = http.request({
      hostname: '127.0.0.1', port: opts.port, path: opts.path, method: opts.method,
      headers: { ...(opts.headers || {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers as Record<string, string>,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });
    r.on('error', reject);
    r.end();
  });
}

describe('OAuth controller (HTTP)', () => {
  let port: number; let close: () => void;
  beforeEach(() => { mockStore.clear(); __resetOAuthStateStore(); const t = buildOAuthApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET /:provider redirects to authorize URL (302)', async () => {
    const r = await oauthReq({ port, method: 'GET', path: '/api/v1/auth/oauth/google' });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('accounts.google.com');
  });

  test('GET /:provider uses x-forwarded-proto when present', async () => {
    const r = await oauthReq({ port, method: 'GET', path: '/api/v1/auth/oauth/github', headers: { 'x-forwarded-proto': 'https', host: 'myapp.com' } });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('github.com');
    expect(r.headers.location).toContain('redirect_uri=https');
  });

  test('GET /:provider/callback redirects to frontend with token on success', async () => {
    const auth = oauthService.buildAuthorizeUrl('google', `http://127.0.0.1:${port}/api/v1/auth/oauth/google/callback`);
    const state = new URL(auth.url).searchParams.get('state')!;
    const r = await oauthReq({ port, method: 'GET', path: `/api/v1/auth/oauth/google/callback?code=test-code&state=${state}` });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('/auth/callback?token=');
  });

  test('GET /:provider/callback redirects to login with error on failure', async () => {
    const r = await oauthReq({ port, method: 'GET', path: '/api/v1/auth/oauth/google/callback?code=bad&state=invalid-state' });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('/login?error=');
  });

  test('GET /:provider/callback respects redirect_origin query param', async () => {
    const auth = oauthService.buildAuthorizeUrl('google', `http://127.0.0.1:${port}/api/v1/auth/oauth/google/callback`);
    const state = new URL(auth.url).searchParams.get('state')!;
    const r = await oauthReq({ port, method: 'GET', path: `/api/v1/auth/oauth/google/callback?code=test-code&state=${state}&redirect_origin=http://myfrontend.com` });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('http://myfrontend.com/auth/callback');
  });
});

describe('OAuth router (exercises routes.ts)', () => {
  let port: number; let close: () => void;
  beforeEach(() => { mockStore.clear(); __resetOAuthStateStore(); const t = buildOAuthRouterApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('GET /:provider via exported oauthRouter returns 302', async () => {
    const r = await oauthReq({ port, method: 'GET', path: '/api/v1/auth/oauth/google' });
    expect(r.status).toBe(302);
  });

  test('GET /github via exported oauthRouter redirects to github.com', async () => {
    const r = await oauthReq({ port, method: 'GET', path: '/api/v1/auth/oauth/github' });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('github.com');
  });

  test('GET /:provider/callback via exported oauthRouter handles invalid state with 302 to login', async () => {
    const r = await oauthReq({ port, method: 'GET', path: '/api/v1/auth/oauth/google/callback?code=x&state=bogus' });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('/login?error=');
  });

  test('GET /:provider/callback via exported oauthRouter succeeds with valid state', async () => {
    const cb = `http://127.0.0.1:${port}/api/v1/auth/oauth/google/callback`;
    const auth = oauthService.buildAuthorizeUrl('google', cb);
    const state = new URL(auth.url).searchParams.get('state')!;
    const r = await oauthReq({ port, method: 'GET', path: `/api/v1/auth/oauth/google/callback?code=unique-code-router&state=${state}` });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('/auth/callback?token=');
  });
});
