import { http, HttpResponse } from 'msw';
import { MOCK_USER_ID, delay } from './handlers';

// Session token storage (in-memory for mock)
let mockSessionToken = 'mock-session-token-' + Date.now();

const mockLoginResponse = {
  success: true,
  data: {
    token: mockSessionToken,
    user: { id: MOCK_USER_ID, email: 'user@example.com', node_name: 'MyNode' },
  },
};

const mockRegisterResponse = {
  success: true,
  data: { message: 'Account created successfully' },
};

// ── Auth Handlers — legacy backend URLs (localhost:3001) ────────────────────────

export const authHandlers = [
  // POST /account/login
  http.post('http://localhost:3001/account/login', async ({ request }) => {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }
    mockSessionToken = 'mock-session-token-' + Date.now();
    return HttpResponse.json({ ...mockLoginResponse, data: { ...mockLoginResponse.data, token: mockSessionToken } });
  }),

  // POST /account/register
  http.post('http://localhost:3001/account/register', async ({ request }) => {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }
    if (body.password.length < 8) {
      return HttpResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    return HttpResponse.json(mockRegisterResponse);
  }),

  // POST /account/logout
  http.post('http://localhost:3001/account/logout', async () => {
    return HttpResponse.json({ success: true });
  }),

  // GET /account/me
  http.get('http://localhost:3001/account/me', async () => {
    return HttpResponse.json({
      success: true,
      data: { node_id: 'node-mock-001', auth_type: 'session', trust_level: 'unverified' },
    });
  }),
];

// ── BFF-level handlers (localhost:3002) ───────────────────────────────────────
// The Next.js BFF proxies /api/v1/auth/* → backend.
// MSW must intercept at the BFF URL so e2e tests work when the app calls
// relative paths like /api/v1/auth/login that resolve to localhost:3002.

export const bffAuthHandlers = [
  // POST /api/v1/auth/login  (→ BFF → backend, returns {token, user})
  http.post('http://127.0.0.1:3002/api/v1/auth/login', async ({ request }) => {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }
    mockSessionToken = 'mock-session-token-' + Date.now();
    // Return the shape the BFF route handler would return (unwrapped {token, user})
    return HttpResponse.json({
      token: mockSessionToken,
      user: { id: MOCK_USER_ID, email: body.email },
    });
  }),

  // POST /api/v1/auth/register  (→ BFF → backend, returns {message})
  http.post('http://127.0.0.1:3002/api/v1/auth/register', async ({ request }) => {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }
    if (body.password.length < 8) {
      return HttpResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    return HttpResponse.json({ message: 'Account created successfully' });
  }),

  // POST /api/v1/auth/logout
  http.post('http://127.0.0.1:3002/api/v1/auth/logout', async () => {
    return HttpResponse.json({ success: true });
  }),

  // GET /api/v1/auth/me  (→ BFF returns {node_id, auth_type, trust_level})
  http.get('http://127.0.0.1:3002/api/v1/auth/me', async () => {
    await delay(100);
    return HttpResponse.json({
      node_id: 'node-mock-001',
      auth_type: 'session',
      trust_level: 'unverified',
    });
  }),
];

// ── Session Handlers ──────────────────────────────────────────────────────────

export const sessionHandlers = [
  // POST /api/v2/session/create
  http.post('http://localhost:3001/api/v2/session/create', async ({ request }) => {
    await delay(300);
    const body = await request.json().catch(() => ({})) as { workspaceId?: string };
    return HttpResponse.json({
      sessionId: `sess_${Date.now().toString(36)}`,
      workspaceId: body.workspaceId || 'ws_default',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
  }),

  // GET /api/v2/session/current
  http.get('http://localhost:3001/api/v2/session/current', async () => {
    await delay(100);
    return HttpResponse.json({
      sessionId: 'sess_current_demo',
      workspaceId: 'ws_01J8K4M6N7P9Q2R3S5T6U7V8W',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: '2026-04-28T00:00:00.000Z',
    });
  }),

  // DELETE /api/v2/session/end
  http.delete('http://localhost:3001/api/v2/session/end', async () => {
    await delay(100);
    return HttpResponse.json({ success: true });
  }),
];
