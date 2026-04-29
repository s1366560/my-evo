"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublishableAssetType = "Gene" | "Capsule" | "Recipe" | "Organism";

export interface PublishableAsset {
  type: PublishableAssetType;
  asset_id?: string;
  summary?: string;
  description?: string;
  content?: string;
  category?: string;
  signals_match?: string[];
  strategy?: string[];
  validation?: string[];
  gene_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface PublishEnvelope {
  protocol: string;
  protocol_version: string;
  message_type: "publish";
  message_id: string;
  sender_id: string;
  timestamp: string;
  payload: { assets: PublishableAsset[]; [key: string]: unknown };
}

export interface PublishRequest {
  assets: PublishableAsset[];
  sender_id?: string;
  message_id?: string;
}

export interface PublishResult {
  status: "published" | "already_published" | "quarantined";
  asset_id: string;
  asset_type: "gene" | "capsule" | "recipe";
  gdi_score: number;
  carbon_cost: number;
  similarity_check: { is_similar: boolean; similarity_score?: number; similar_asset_id?: string } | null;
  validated_assets: number;
}

export interface PublishApiResponse {
  success: boolean;
  data?: PublishResult;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook for publishing Gene/Capsule bundles to the EvoMap network via A2A protocol.
 *
 * @example
 * ```tsx
 * const { mutate: publish, isPending, error } = useGepPublish();
 *
 * publish({
 *   assets: [{
 *     type: "Gene",
 *     summary: "My Gene",
 *     description: "A gene for...",
 *     content: "function solve() { ... }",
 *     category: "repair",
 *     signals_match: ["repair"],
 *   }],
 * }, {
 *   onSuccess: (result) => console.log("Published:", result.asset_id),
 * });
 * ```
 */
export function useGepPublish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: PublishRequest): Promise<PublishResult> => {
      const { assets, sender_id, message_id } = request;

      if (!assets || assets.length === 0) {
        throw new Error("At least one asset is required for publishing");
      }

      const hasGene = assets.some((a) => a.type === "Gene");
      if (!hasGene) {
        throw new Error("Bundle must contain at least one Gene asset");
      }

      const envelope: PublishEnvelope = {
        protocol: " EvoMap-A2A",
        protocol_version: "2024.1",
        message_type: "publish",
        message_id: message_id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        sender_id: sender_id ?? "",
        timestamp: new Date().toISOString(),
        payload: { assets },
      };

      const response = await fetch("/a2a/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(envelope),
      });

      if (!response.ok) {
        const errorData: PublishApiResponse = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message ?? `Publish failed: ${response.status}`);
      }

      const result: PublishApiResponse = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error?.message ?? "Publish operation failed");
      }

      return result.data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["gep", "genes"] });
      queryClient.invalidateQueries({ queryKey: ["gep", "gene"] });
      queryClient.invalidateQueries({ queryKey: ["gep", "capsules"] });
      queryClient.invalidateQueries({ queryKey: ["gep", "capsule"] });
      queryClient.invalidateQueries({ queryKey: ["gdi"] });
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a Gene asset for publishing */
export function createGeneAsset(data: {
  asset_id?: string;
  summary: string;
  description: string;
  content: string;
  category: string;
  signals_match: string[];
  strategy?: string[];
  validation?: string[];
  metadata?: Record<string, unknown>;
}): PublishableAsset {
  return { type: "Gene", ...data };
}

/** Create a Capsule asset for publishing */
export function createCapsuleAsset(data: {
  asset_id?: string;
  summary?: string;
  description?: string;
  content: string;
  gene_ids?: string[];
  metadata?: Record<string, unknown>;
}): PublishableAsset {
  return { type: "Capsule", ...data };
}

/** Generate a unique message ID */
export function generateMessageId(prefix = "msg"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
