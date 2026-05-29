"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegisterCapsuleRequest } from "../../../../../src/gep/types";
import type { GepPublishCapsuleResponse, GepValidationResponse } from "./use-gep-types";

/** Hook to register a new Capsule */
export function useGepPublishCapsule() {
  const queryClient = useQueryClient();
  return useMutation<GepPublishCapsuleResponse, Error, RegisterCapsuleRequest>({
    mutationFn: async (request) => {
      const res = await fetch("/gep/capsule", {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gep", "capsules"] }),
  });
}

/** Hook to get a single Capsule by ID */
export function useGepCapsule(capsuleId: string | null) {
  return useQuery<GepPublishCapsuleResponse>({
    queryKey: ["gep", "capsule", capsuleId],
    queryFn: async () => {
      const res = await fetch(`/gep/capsule/${capsuleId}`, {
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
    enabled: Boolean(capsuleId),
  });
}

/** Hook to validate a Capsule before publishing */
export function useValidateCapsule() {
  return useMutation<GepValidationResponse, Error, RegisterCapsuleRequest>({
    mutationFn: async (request) => {
      const res = await fetch("/gep/capsule/validate", {
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
export const useRegisterCapsule = useGepPublishCapsule;

/** Hook to list all Capsules with optional node_id filter */
export function useGepCapsules(nodeId?: string) {
  return useQuery<GepPublishCapsuleResponse>({
    queryKey: ["gep", "capsules", { nodeId }],
    queryFn: async () => {
      const url = nodeId
        ? `/gep/capsules?node_id=${encodeURIComponent(nodeId)}`
        : "/gep/capsules";
      const res = await fetch(url, { credentials: "include" });
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
