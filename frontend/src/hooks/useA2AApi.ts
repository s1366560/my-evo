'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface AgentRegistration {
  agentId: string;
  claimCode: string;
  claimUrl: string;
  nodeId: string;
  hubUrl: string;
}

export interface AgentCapabilities {
  name: string;
  version: string;
  capabilities: string[];
}

export interface HelloResponse {
  success: boolean;
  agentId?: string;
  claimCode?: string;
  claimUrl?: string;
  nodeId?: string;
  message?: string;
}

export function useA2AApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerAgent = useCallback(async (agentName: string, capabilities: string[], version: string): Promise<HelloResponse> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/a2a/hello`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_name: agentName,
          capabilities: capabilities,
          version: version,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }

      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const heartbeat = useCallback(async (agentId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/a2a/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Heartbeat failed');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getNodeStatus = useCallback(async (nodeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/a2a/nodes/${nodeId}`);
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get node status');
      }

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
    registerAgent,
    heartbeat,
    getNodeStatus,
  };
}
