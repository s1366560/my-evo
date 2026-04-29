"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  GepNodesResponse,
  GepNodeResponse,
  GepNodesParams,
} from "./use-gep-types";

/** Hook to discover GEP nodes with optional filters */
export function useGepNodes(params?: GepNodesParams) {
  return useQuery<GepNodesResponse>({
    queryKey: ["gep", "nodes", params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.capabilities?.length) {
        sp.set("capabilities", params.capabilities.join(","));
      }
      if (params?.min_reputation !== undefined) {
        sp.set("min_reputation", String(params.min_reputation));
      }
      if (params?.status) sp.set("status", params.status);
      if (params?.limit) sp.set("limit", String(params.limit));
      const qs = sp.toString();
      const res = await fetch(`/gep/nodes${qs ? `?${qs}` : ""}`, {
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
    staleTime: 2 * 60 * 1000,
  });
}

/** Hook to get a single GEP node by ID */
export function useGepNode(nodeId: string | null) {
  return useQuery<GepNodeResponse>({
    queryKey: ["gep", "node", nodeId],
    queryFn: async () => {
      const res = await fetch(`/gep/node/${nodeId}`, { credentials: "include" });
      if (!res.ok) {
        return res.json().catch(() => ({
          success: false,
          error: { code: "HTTP_ERROR", message: res.statusText },
        }));
      }
      return res.json();
    },
    enabled: Boolean(nodeId),
  });
}
