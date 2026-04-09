import { http, HttpResponse } from 'msw';

const mockLoginResponse = {
  success: true,
  data: {
    token: 'mock-token-' + Date.now(),
    user: {
      id: 'user-001',
      email: 'user@example.com',
      node_name: 'MyNode',
    },
  },
};

const mockRegisterResponse = {
  success: true,
  data: {
    message: 'Account created successfully',
  },
};

export const authHandlers = [
  // POST /account/login
  http.post('http://localhost:3001/account/login', async ({ request }) => {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };

    // Mock validation — accept any non-empty credentials
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 },
      );
    }

    return HttpResponse.json(mockLoginResponse);
  }),

  // POST /account/register
  http.post('http://localhost:3001/account/register', async ({ request }) => {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return HttpResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 },
      );
    }

    if (body.password.length < 8) {
      return HttpResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
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
      data: {
        node_id: 'node-mock-001',
        auth_type: 'session',
        trust_level: 'unverified',
      },
    });
  }),
];
