'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface Asset {
  assetId: string;
  type: 'GENE' | 'CAPSULE' | 'gene' | 'capsule';
  name: string;
  description: string;
  tags: string[];
  license?: string;
  gdiScore: number;
  createdAt: string;
  publishedAt?: string;
  node?: {
    nodeId: string;
    name: string;
    reputation: number;
  };
  _count?: {
    reviews: number;
  };
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
  limit: number;
  offset: number;
}

export interface AssetFetchInput {
  query?: string;
  type?: 'gene' | 'capsule';
  tags?: string[];
  sort?: 'recent' | 'popular' | 'gdi' | 'calls';
  limit?: number;
  offset?: number;
}

export function useAssetApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }, []);

  const fetchAssets = useCallback(async (input: AssetFetchInput = {}): Promise<AssetListResponse> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/a2a/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to fetch assets');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAsset = useCallback(async (assetId: string): Promise<{ asset: Asset }> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/a2a/asset/${assetId}`);
      if (!res.ok) throw new Error('Failed to fetch asset');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMyAssets = useCallback(async (): Promise<{ assets: Partial<Asset>[] }> => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE}/assets/my`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch your assets');
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const reviewAsset = useCallback(async (
    assetId: string,
    rating: number,
    comment?: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE}/a2a/asset/${assetId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit review');
      }
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
    fetchAssets,
    getAsset,
    getMyAssets,
    reviewAsset,
  };
}
