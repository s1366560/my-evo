/**
 * MSW Handlers for Workspace API - Real API Integration
 * Proxies to real backend with mock fallbacks
 */
import { http, HttpResponse } from 'msw';
import { delay } from './handlers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

async function fetchAPI<T>(path: string, opts?: RequestInit): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

const mockWorkspace = {
  id: 'ws_default', name: 'My Evo Workspace', slug: 'my-evo',
  description: 'AI development workspace', createdBy: 'anonymous',
  createdAt: '2026-01-15T08:00:00.000Z', updatedAt: new Date().toISOString(),
  plan: 'pro', settings: { defaultTrustLevel: 'member', bountyEnabled: true, councilEnabled: true, publicProfile: false, allowGuestBounties: false },
  memberCount: 1, reputation: 100, credits: 5000,
};

export const workspaceHandlers = [
  http.get('/api/v2/workspace/current', async () => {
    try {
      const data = await fetchAPI<{ success: boolean; data: unknown }>('/api/v2/workspace/current');
      return HttpResponse.json(data);
    } catch {
      await delay(200);
      return HttpResponse.json(mockWorkspace);
    }
  }),

  http.get('/api/v2/workspace/members', async () => {
    try {
      const data = await fetchAPI<{ success: boolean; data: { members: unknown[]; total: number } }>('/api/v2/workspace/members');
      return HttpResponse.json({ members: data.data?.members || [], total: data.data?.total || 0 });
    } catch {
      await delay(150);
      return HttpResponse.json({ members: [{ id: 'mbr_01', userId: 'anonymous', role: 'owner', joinedAt: '2026-01-15T08:00:00.000Z', displayName: 'Admin User', avatar: null }], total: 1 });
    }
  }),

  http.get('/api/v2/workspace/goals', async () => {
    try {
      const data = await fetchAPI<{ success: boolean; data: { goals: unknown[]; total: number } }>('/api/v2/workspace/goals');
      return HttpResponse.json({ goals: data.data?.goals || [], total: data.data?.total || 0 });
    } catch {
      await delay(150);
      return HttpResponse.json({ goals: [], total: 0 });
    }
  }),

  http.get('/api/v2/workspace/tasks', async () => {
    try {
      const data = await fetchAPI<{ success: boolean; data: { tasks: unknown[]; total: number } }>('/api/v2/workspace/tasks');
      return HttpResponse.json({ tasks: data.data?.tasks || [], total: data.data?.total || 0 });
    } catch {
      await delay(150);
      return HttpResponse.json({ tasks: [], total: 0 });
    }
  }),

  http.get('/api/v2/workspace/workers', async () => {
    try {
      const data = await fetchAPI<{ success: boolean; data: { workers: unknown[]; total: number } }>('/api/v2/workspace/workers');
      return HttpResponse.json({ workers: data.data?.workers || [], total: data.data?.total || 0 });
    } catch {
      await delay(150);
      return HttpResponse.json({ workers: [], total: 0 });
    }
  }),

  http.patch('/api/v2/workspace/tasks/:taskId', async ({ params, request }) => {
    try {
      const body = await request.json();
      const data = await fetchAPI<JsonValue>(`/api/v2/workspace/tasks/${params.taskId}`, { method: 'PATCH', body: JSON.stringify(body) });
      return HttpResponse.json(data);
    } catch {
      await delay(200);
      return HttpResponse.json({ error: 'API unavailable' }, { status: 503 });
    }
  }),

  http.post('/api/v2/workspace/invite', async ({ request }) => {
    try {
      const body = await request.json() as { email: string; role?: string };
      const data = await fetchAPI<JsonValue>('/api/v2/workspace/invite', { method: 'POST', body: JSON.stringify(body) });
      return HttpResponse.json(data, { status: 201 });
    } catch {
      await delay(300);
      const body = await request.json() as { email: string; role?: string };
      if (!body.email) return HttpResponse.json({ error: 'VALIDATION_ERROR', message: 'Email is required' }, { status: 400 });
      return HttpResponse.json({ id: `inv_${Date.now().toString(36)}`, workspaceId: 'ws_default', email: body.email, role: body.role || 'member', status: 'pending', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() }, { status: 201 });
    }
  }),

  http.patch('/api/v2/workspace/settings', async ({ request }) => {
    try {
      const body = await request.json();
      const data = await fetchAPI<JsonValue>('/api/v2/workspace/settings', { method: 'PATCH', body: JSON.stringify(body) });
      return HttpResponse.json(data);
    } catch {
      await delay(200);
      return HttpResponse.json({ error: 'API unavailable' }, { status: 503 });
    }
  }),
];

export { mockWorkspace };
export const mockWorkspaceMembers = [{ id: 'mbr_01', userId: 'anonymous', role: 'owner', joinedAt: '2026-01-15T08:00:00.000Z', displayName: 'Admin User', avatar: null }];
export const mockGoals: unknown[] = [];
export const mockTasks: unknown[] = [];
export const mockWorkers: unknown[] = [];
