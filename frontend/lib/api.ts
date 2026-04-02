const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface FetchOptions extends RequestInit {
  token?: string
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

// A2A Node API
export const nodeApi = {
  list: (token?: string) => apiFetch<{ nodes: any[] }>('/a2a/nodes', { token }),
  get: (nodeId: string, token?: string) => apiFetch<any>(`/a2a/nodes/${nodeId}`, { token }),
  register: (payload: any) => apiFetch<any>('/a2a/hello', { method: 'POST', body: JSON.stringify(payload) }),
  heartbeat: (token: string) => apiFetch<any>('/a2a/heartbeat', { method: 'POST', token }),
}

// Assets API
export const assetsApi = {
  list: (token?: string, params?: Record<string, string>) => {
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiFetch<{ assets: any[]; total: number }>(`/a2a/assets${searchParams}`, { token })
  },
  get: (assetId: string, token?: string) => apiFetch<any>(`/a2a/assets/${assetId}`, { token }),
  publish: (asset: any, token: string) => apiFetch<any>('/a2a/publish', { method: 'POST', body: JSON.stringify(asset), token }),
  fetch: (query: any, token?: string) => apiFetch<any>('/a2a/fetch', { method: 'POST', body: JSON.stringify(query), token }),
  myUsage: (token: string) => apiFetch<any>('/a2a/assets/my-usage', { token }),
  recommended: (token: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return apiFetch<any>(`/a2a/assets/recommended${searchParams}`, { token })
  },
}

// Swarm API
export const swarmApi = {
  tasks: (token?: string) => apiFetch<{ tasks: any[] }>('/a2a/swarm/tasks', { token }),
  subtasks: (taskId: string, token?: string) => apiFetch<any>(`/a2a/swarm/tasks/${taskId}/subtasks`, { token }),
  join: (taskId: string, token: string) => apiFetch<any>(`/a2a/swarm/tasks/${taskId}/join`, { method: 'POST', token }),
}

// Council API
export const councilApi = {
  proposals: (token?: string) => apiFetch<{ proposals: any[] }>('/a2a/council/proposals', { token }),
  proposal: (proposalId: string, token?: string) => apiFetch<any>(`/a2a/council/proposal/${proposalId}`, { token }),
  propose: (proposal: any, token: string) => apiFetch<any>('/a2a/council/propose', { method: 'POST', body: JSON.stringify(proposal), token }),
  vote: (proposalId: string, vote: any, token: string) =>
    apiFetch<any>(`/a2a/council/vote/${proposalId}`, { method: 'POST', body: JSON.stringify(vote), token }),
  config: (token?: string) => apiFetch<any>('/a2a/council/config', { token }),
}

// Marketplace API
export const marketplaceApi = {
  listings: (params?: Record<string, string>, token?: string) => {
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiFetch<any>(`/market/listings${searchParams}`, { token })
  },
  listing: (listingId: string, token?: string) => apiFetch<any>(`/market/listings/${listingId}`, { token }),
  createListing: (listing: any, token: string) => apiFetch<any>('/market/listings', { method: 'POST', body: JSON.stringify(listing), token }),
  stats: (token?: string) => apiFetch<any>('/market/stats', { token }),
  transactions: (token?: string) => apiFetch<any>('/market/transactions', { token }),
  bounties: (params?: Record<string, string>, token?: string) => {
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiFetch<any>(`/market/bounties${searchParams}`, { token })
  },
}

// Arena API
export const arenaApi = {
  seasons: (token?: string) => apiFetch<any>('/arena/seasons', { token }),
  currentSeason: (token?: string) => apiFetch<any>('/arena/seasons/current', { token }),
  matches: (params?: Record<string, string>, token?: string) => {
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiFetch<any>(`/arena/matches${searchParams}`, { token })
  },
  match: (matchId: string, token?: string) => apiFetch<any>(`/arena/matches/${matchId}`, { token }),
  vote: (matchId: string, vote: any, token: string) =>
    apiFetch<any>(`/arena/matches/${matchId}/vote`, { method: 'POST', body: JSON.stringify(vote), token }),
  benchmark: (token?: string) => apiFetch<any>('/arena/benchmark/current', { token }),
}

// Knowledge Graph API
export const kgApi = {
  query: (query: any, token?: string) => apiFetch<any>('/api/hub/kg/query', { method: 'POST', body: JSON.stringify(query), token }),
  neighbors: (entityId: string, token?: string) => apiFetch<any>(`/api/hub/kg/neighbors/${entityId}`, { token }),
  entity: (entityId: string, token?: string) => apiFetch<any>(`/api/hub/kg/entity/${entityId}`, { token }),
}
