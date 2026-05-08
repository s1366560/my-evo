'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface User {
  id: number;
  username: string;
  email: string;
  credits: number;
  reputation?: number;
  level?: number;
  createdAt?: string;
}

export interface Node {
  id: number;
  nodeId: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE';
  reputation: number;
  level: number;
  credits: number;
  createdAt: string;
}

export function useUserApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }, []);

  const getMe = useCallback(async (): Promise<User> => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const getMyNode = useCallback(async (): Promise<{ node: Node }> => {
    setLoading(true);
    setError(null);
    try {
      const nodeId = localStorage.getItem('nodeId');
      if (!nodeId) throw new Error('No node registered');

      const res = await fetch(`${API_BASE}/a2a/nodes/${nodeId}`);
      if (!res.ok) throw new Error('Failed to fetch node');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getMe,
    getMyNode,
  };
}
