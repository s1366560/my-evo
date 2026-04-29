"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  Gene,
  Capsule,
  GepNode,
  GeneCategory,
  ValidationResult,
  RegisterGeneRequest,
  RegisterCapsuleRequest,
  ApiResponse,
} from "./use-gep-types";

/**
 * GEP Search Hooks
 * Provides React Query hooks for searching and listing Genes, Capsules, and Nodes
 */

// Search query parameters
export interface GeneSearchParams {
  q?: string;
  category?: GeneCategory;
  node_id?: string;
  page?: number;
  limit?: number;
}

export interface CapsuleSearchParams {
  q?: string;
  node_id?: string;
  page?: number;
  limit?: number;
}

export interface NodeSearchParams {
  capabilities?: GeneCategory[];
  min_reputation?: number;
  status?: "active" | "inactive" | "deprecated";
  limit?: number;
}

// API Response types for search
export interface GeneSearchResponse {
  items: Gene[];
  total: number;
  page: number;
  page_size: number;
}

export interface CapsuleSearchResponse {
  items: Capsule[];
  total: number;
  page: number;
  page_size: number;
}

export interface NodeSearchResponse {
  nodes: GepNode[];
  total: number;
}

// ── Gene Hooks ────────────────────────────────────────────────────────────────

/**
 * Hook to search genes with filtering
 */
export function useGeneSearch(params: GeneSearchParams = {}) {
  return useQuery({
    queryKey: ["gep", "genes", "search", params],
    queryFn: async (): Promise<GeneSearchResponse> => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set("q", params.q);
      if (params.category) searchParams.set("category", params.category);
      if (params.node_id) searchParams.set("node_id", params.node_id);
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));

      const response = await apiClient.get<ApiResponse<Gene[]>>(
        `/genes?${searchParams.toString()}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to search genes");
      }

      const genes = response.data;
      const page = params.page ?? 1;
      const pageSize = params.limit ?? 20;

      return {
        items: genes,
        total: genes.length,
        page,
        page_size: pageSize,
      };
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to get a single gene by ID
 */
export function useGene(geneId: string | null) {
  return useQuery({
    queryKey: ["gep", "gene", geneId],
    queryFn: async (): Promise<Gene | null> => {
      if (!geneId) return null;
      const response = await apiClient.get<ApiResponse<Gene>>(
        `/gene/${geneId}`
      );
      if (!response.success) return null;
      return response.data ?? null;
    },
    enabled: Boolean(geneId),
    staleTime: 60 * 1000,
  });
}

// ── Capsule Hooks ──────────────────────────────────────────────────────────────

/**
 * Hook to search capsules with filtering
 */
export function useCapsuleSearch(params: CapsuleSearchParams = {}) {
  return useQuery({
    queryKey: ["gep", "capsules", "search", params],
    queryFn: async (): Promise<CapsuleSearchResponse> => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set("q", params.q);
      if (params.node_id) searchParams.set("node_id", params.node_id);
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));

      const response = await apiClient.get<ApiResponse<Capsule[]>>(
        `/capsules?${searchParams.toString()}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to search capsules");
      }

      const capsules = response.data;
      const page = params.page ?? 1;
      const pageSize = params.limit ?? 20;

      return {
        items: capsules,
        total: capsules.length,
        page,
        page_size: pageSize,
      };
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to get a single capsule by ID
 */
export function useCapsule(capsuleId: string | null) {
  return useQuery({
    queryKey: ["gep", "capsule", capsuleId],
    queryFn: async (): Promise<Capsule | null> => {
      if (!capsuleId) return null;
      const response = await apiClient.get<ApiResponse<Capsule>>(
        `/capsule/${capsuleId}`
      );
      if (!response.success) return null;
      return response.data ?? null;
    },
    enabled: Boolean(capsuleId),
    staleTime: 60 * 1000,
  });
}

// ── Node Hooks ─────────────────────────────────────────────────────────────────

/**
 * Hook to discover/search nodes with filtering
 */
export function useNodeSearch(params: NodeSearchParams = {}) {
  return useQuery({
    queryKey: ["gep", "nodes", "search", params],
    queryFn: async (): Promise<NodeSearchResponse> => {
      const searchParams = new URLSearchParams();
      if (params.capabilities && params.capabilities.length > 0) {
        searchParams.set("capabilities", params.capabilities.join(","));
      }
      if (params.min_reputation !== undefined) {
        searchParams.set("min_reputation", String(params.min_reputation));
      }
      if (params.status) searchParams.set("status", params.status);
      if (params.limit) searchParams.set("limit", String(params.limit));

      const response = await apiClient.get<ApiResponse<GepNode[]>>(
        `/nodes?${searchParams.toString()}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to search nodes");
      }

      return {
        nodes: response.data,
        total: response.data.length,
      };
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to get a single node by ID
 */
export function useNode(nodeId: string | null) {
  return useQuery({
    queryKey: ["gep", "node", nodeId],
    queryFn: async (): Promise<GepNode | null> => {
      if (!nodeId) return null;
      const response = await apiClient.get<ApiResponse<GepNode>>(
        `/node/${nodeId}`
      );
      if (!response.success) return null;
      return response.data ?? null;
    },
    enabled: Boolean(nodeId),
    staleTime: 60 * 1000,
  });
}

// ── Validation & Adapters ───────────────────────────────────────────────────────

/**
 * Hook to validate a gene or capsule
 */
export function useGepValidate() {
  return useMutation({
    mutationFn: async (data: {
      type: "gene" | "capsule";
      data: Partial<RegisterGeneRequest> | Partial<RegisterCapsuleRequest>;
    }): Promise<ValidationResult> => {
      const response = await apiClient.post<ApiResponse<ValidationResult>>(
        "/validate",
        data
      );
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Validation failed");
      }
      return response.data;
    },
  });
}

/**
 * Hook to get all adapters
 */
export function useGepAdapters() {
  return useQuery({
    queryKey: ["gep", "adapters"],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<Array<{ name: string; ecosystem: string }>>
      >("/adapters");
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch adapters");
      }
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
