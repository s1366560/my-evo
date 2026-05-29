import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Asset, type AssetType } from '@/lib/api/client';

// ── Asset Hooks ────────────────────────────────────────────────────────────────

export function useAssets(filters?: { type?: AssetType; author_id?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['assets', filters],
    queryFn: () => apiClient.getAssets(filters),
  });
}

export function useTrendingAssets() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: () => apiClient.getTrending(),
  });
}

export function useRankedAssets() {
  return useQuery({
    queryKey: ['assets-ranked'],
    queryFn: () => apiClient.getAssetsRanked(),
  });
}

export function useAssetById(assetId: string) {
  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => apiClient.getAssetById(assetId),
    enabled: !!assetId,
  });
}

export function useAssetLineage(assetId: string) {
  return useQuery({
    queryKey: ['asset-lineage', assetId],
    queryFn: () => apiClient.getAssetLineage(assetId),
    enabled: !!assetId,
  });
}

export function useAssetSearch(q: string, page?: number) {
  return useQuery({
    queryKey: ['asset-search', q, page],
    queryFn: async () => {
      const assets = await apiClient.searchAssets(q, page);
      // Backend returns { success, assets, total, data } - normalize to Asset[]
      if (Array.isArray(assets)) return assets;
      // Handle wrapped response shape
      const wrapped = assets as unknown as { data?: Asset[]; assets?: Asset[]; items?: Asset[] };
      return wrapped.data ?? wrapped.assets ?? wrapped.items ?? [];
    },
    enabled: q.length > 0,
  });
}

export interface PublishAssetInput {
  name: string;
  type: AssetType;
  dna: string;
  description?: string;
  signals?: string[];
}

export function usePublishAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishAssetInput) =>
      apiClient.publish({
        name: input.name,
        type: input.type,
        dna: input.dna,
        description: input.description,
        signals: input.signals,
      }),
    onSuccess: () => {
      // Invalidate all asset-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['a2a'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}
