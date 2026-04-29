"use client";

import { useMutation } from "@tanstack/react-query";
import type {
  RegisterGeneRequest,
  RegisterCapsuleRequest,
} from "../../../../../src/gep/types";
import type { GepValidationRequest, GepValidationResponse } from "./use-gep-types";

/** Hook to validate a Gene or Capsule before publishing */
export function useGepValidate() {
  return useMutation<GepValidationResponse, Error, GepValidationRequest>({
    mutationFn: async (request) => {
      const res = await fetch("/gep/validate", {
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
