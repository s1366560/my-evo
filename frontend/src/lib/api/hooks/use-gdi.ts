"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/**
 * Hook for GDI (Genetic Diversity Index) scoring operations
 * Provides batch scoring, score history, and configuration access
 */

export interface AssetForScoring {
  asset_id: string;
  asset_type: "Gene" | "Capsule" | "Recipe" | "Organism";
  name: string;
  content?: string;
  signals: string[];
  validation_results?: Array<{ passed: boolean; test: string }>;
  ancestors: string[];
  fork_count?: number;
  created_at: string;
}

export interface GDIScoreResult {
  asset_id: string;
  asset_type: string;
  overall: number;
  dimensions: {
    structural: number;
    semantic: number;
    specificity: number;
    strategy: number;
    validation: number;
  };
  weights: {
    structural: number;
    semantic: number;
    specificity: number;
    strategy: number;
    validation: number;
  };
  confidence: number;
  gdi_lower: number;
  gdi_upper: number;
  calculated_at: string;
}

export interface BatchScoreRequest {
  assets: AssetForScoring[];
  customWeights?: Partial<GDIScoreResult["weights"]>;
}

export interface BatchScoreResponse {
  scores: GDIScoreResult[];
  failed: Array<{ asset_id: string; error: string }>;
  calculated_at: string;
}

export interface GDIScoreHistory {
  asset_id: string;
  history: Array<{ overall: number; calculated_at: string }>;
}

export interface GDIConfig {
  score_range: { min: number; max: number };
  confidence_weights: { signals: number; validation: number };
  decay_enabled: boolean;
  decay_rate: number;
}

export interface GDIWeights {
  structural: number;
  semantic: number;
  specificity: number;
  strategy: number;
  validation: number;
}

/**
 * Hook to batch score multiple assets
 */
export function useBatchScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BatchScoreRequest): Promise<BatchScoreResponse> => {
      const response = await fetch("/gdi/score/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Score request failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["gdi"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

/**
 * Hook to get GDI score history for an asset
 */
export function useGDIScoreHistory(assetId: string | null) {
  return useQuery({
    queryKey: ["gdi", "history", assetId],
    queryFn: async (): Promise<GDIScoreHistory | null> => {
      if (!assetId) return null;
      const response = await fetch(`/gdi/score/${assetId}/history`, {
        credentials: "include",
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: Boolean(assetId),
  });
}

/**
 * Hook to get GDI configuration
 */
export function useGDIConfig() {
  return useQuery({
    queryKey: ["gdi", "config"],
    queryFn: async (): Promise<GDIConfig> => {
      const response = await fetch("/gdi/config", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch GDI config");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to get GDI weights
 */
export function useGDIWeights() {
  return useQuery({
    queryKey: ["gdi", "weights"],
    queryFn: async (): Promise<GDIWeights> => {
      const response = await fetch("/gdi/weights", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch GDI weights");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to score a single asset using the apiClient
 */
export function useScoreAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (asset: AssetForScoring): Promise<GDIScoreResult> => {
      const response = await fetch("/gdi/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assets: [asset] }),
      });

      if (!response.ok) {
        throw new Error(`Score request failed: ${response.statusText}`);
      }

      const data: BatchScoreResponse = await response.json();
      if (data.failed.length > 0) {
        throw new Error(data.failed[0].error);
      }
      return data.scores[0];
    },
    onSuccess: (_, asset) => {
      queryClient.invalidateQueries({ queryKey: ["gdi", "history", asset.asset_id] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
