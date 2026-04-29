"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegisterGeneRequest } from "../../../../../src/gep/types";
import type {
  GepPublishGeneResponse,
  GepGenesParams,
  GepValidationResponse,
} from "./use-gep-types";

/** Hook to register a new Gene */
export function useGepPublishGene() {
  const queryClient = useQueryClient();
  return useMutation<GepPublishGeneResponse, Error, RegisterGeneRequest>({
    mutationFn: async (request) => {
      const res = await fetch("/gep/gene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        throw (await res.json().catch(() => ({
          error: { code: "HTTP_ERROR", message: res.statusText },
        })));
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gep", "genes"] }),
  });
}

/** Hook to get a single Gene by ID */
export function useGepGene(geneId: string | null) {
  return useQuery<GepPublishGeneResponse>({
    queryKey: ["gep", "gene", geneId],
    queryFn: async () => {
      const res = await fetch(`/gep/gene/${geneId}`, { credentials: "include" });
      if (!res.ok) {
        return res.json().catch(() => ({
          success: false,
          error: { code: "HTTP_ERROR", message: res.statusText },
        }));
      }
      return res.json();
    },
    enabled: Boolean(geneId),
  });
}

/** Hook to validate a Gene before publishing */
export function useValidateGene() {
  return useMutation<GepValidationResponse, Error, RegisterGeneRequest>({
    mutationFn: async (request) => {
      const res = await fetch("/gep/gene/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        throw (await res.json().catch(() => ({
          error: { code: "HTTP_ERROR", message: res.statusText },
        })));
      }
      return res.json();
    },
  });
}

/** Alias for backwards compatibility */
export const useRegisterGene = useGepPublishGene;

/** Hook to list all Genes with optional filters */
export function useGepGenes(params?: GepGenesParams) {
  return useQuery<GepPublishGeneResponse>({
    queryKey: ["gep", "genes", params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.node_id) sp.set("node_id", params.node_id);
      if (params?.category) sp.set("category", params.category);
      const qs = sp.toString();
      const res = await fetch(`/gep/genes${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) {
        return res.json().catch(() => ({
          success: false,
          error: { code: "HTTP_ERROR", message: res.statusText },
        }));
      }
      return res.json();
    },
  });
}
