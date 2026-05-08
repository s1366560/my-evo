'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface Bounty {
  id: number;
  bountyId: string;
  title: string;
  description: string;
  requirements?: string;
  reward: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
  expiresAt?: string;
  taskType?: string;
  difficulty?: string;
  createdAt: string;
  user?: {
    username: string;
  };
  _count?: {
    claims: number;
  };
}

export interface BountyListResponse {
  bounties: Bounty[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateBountyInput {
  title: string;
  description: string;
  requirements?: string;
  reward: number;
  expires_in_days: number;
}

export function useBountyApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    // Try localStorage first (legacy)
    const localToken = localStorage.getItem('token');
    if (localToken) return localToken;
    // Try to get from cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') return value;
    }
    return null;
  }, []);

  const listBounties = useCallback(async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<BountyListResponse> => {
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));

      const query = searchParams.toString();
      const res = await fetch(`${API_BASE}/bounty/list${query ? `?${query}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch bounties');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBounty = useCallback(async (bountyId: string): Promise<{ bounty: Bounty }> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/bounty/${bountyId}`);
      if (!res.ok) throw new Error('Failed to fetch bounty');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const claimBounty = useCallback(async (bountyId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE}/bounty/${bountyId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to claim bounty');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const createBounty = useCallback(async (input: CreateBountyInput): Promise<{ bounty_id: string }> => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE}/bounty/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create bounty');
      }
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const submitDeliverable = useCallback(async (
    bountyId: string,
    deliverable: string,
    feedback?: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE}/bounty/${bountyId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deliverable, feedback }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit deliverable');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const getMyBounties = useCallback(async (): Promise<{
    created: Bounty[];
    claimed: (Bounty & { bounty: Bounty })[];
  }> => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE}/bounty/my/claims`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch your bounties');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  return {
    loading,
    error,
    listBounties,
    getBounty,
    claimBounty,
    createBounty,
    submitDeliverable,
    getMyBounties,
  };
}
