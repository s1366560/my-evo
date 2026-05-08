'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface MemoryEntry {
  id: number;
  agentId: string;
  eventType: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, any>;
  signalStrength?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RecallResult {
  id: number;
  agentId: string;
  eventType: string;
  content: string;
  similarity?: number;
  createdAt: string;
}

export interface MemoryStatus {
  totalMemories: number;
  storageUsage: number;
  lastRecall: string | null;
  signalCount: number;
}

export function useMemoryApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }, []);

  const getNodeId = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('nodeId');
  }, []);

  const recordMemory = useCallback(async (content: string, eventType: string, tags?: string[], metadata?: Record<string, any>): Promise<MemoryEntry> => {
    setLoading(true);
    setError(null);
    try {
      const nodeId = getNodeId();
      if (!nodeId) throw new Error('Node ID not found');

      const res = await fetch(`${API_BASE}/a2a/memory/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: nodeId,
          eventType,
          content,
          tags: tags || [],
          metadata: metadata || {},
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record memory');
      }

      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getNodeId]);

  const recallMemory = useCallback(async (query: string, limit: number = 10): Promise<RecallResult[]> => {
    setLoading(true);
    setError(null);
    try {
      const nodeId = getNodeId();
      if (!nodeId) throw new Error('Node ID not found');

      const res = await fetch(`${API_BASE}/a2a/memory/recall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: nodeId,
          query,
          limit,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to recall memory');
      }

      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getNodeId]);

  const getMemoryStatus = useCallback(async (): Promise<MemoryStatus> => {
    setLoading(true);
    setError(null);
    try {
      const nodeId = getNodeId();
      if (!nodeId) throw new Error('Node ID not found');

      const res = await fetch(`${API_BASE}/a2a/memory/status?agentId=${nodeId}`);
      
      if (!res.ok) {
        // Return mock status if endpoint not implemented
        return {
          totalMemories: 0,
          storageUsage: 0,
          lastRecall: null,
          signalCount: 0,
        };
      }

      return res.json();
    } catch (err) {
      // Return default status on error
      return {
        totalMemories: 0,
        storageUsage: 0,
        lastRecall: null,
        signalCount: 0,
      };
    } finally {
      setLoading(false);
    }
  }, [getNodeId]);

  const getMemories = useCallback(async (limit: number = 50, offset: number = 0): Promise<MemoryEntry[]> => {
    setLoading(true);
    setError(null);
    try {
      const nodeId = getNodeId();
      if (!nodeId) throw new Error('Node ID not found');

      const res = await fetch(`${API_BASE}/a2a/memory/list?agentId=${nodeId}&limit=${limit}&offset=${offset}`);
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get memories');
      }

      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getNodeId]);

  const deleteMemory = useCallback(async (id: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const nodeId = getNodeId();
      if (!nodeId) throw new Error('Node ID not found');

      const res = await fetch(`${API_BASE}/a2a/memory/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId: nodeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete memory');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getNodeId]);

  return {
    loading,
    error,
    recordMemory,
    recallMemory,
    getMemoryStatus,
    getMemories,
    deleteMemory,
  };
}
