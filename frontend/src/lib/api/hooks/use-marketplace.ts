"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MarketplaceListing } from "@/lib/api/client";

/**
 * Marketplace hooks for listing operations
 */

export interface PurchaseRequest {
  listingId: string;
  paymentMethod?: "credits" | "card";
}

export interface PurchaseResponse {
  success: boolean;
  transaction: {
    transaction_id: string;
    listing_id: string;
    asset_id: string;
    amount: number;
    fee: number;
    timestamp: string;
  };
  remainingCredits?: number;
}

export interface CreateListingRequest {
  asset_id: string;
  asset_type: "Gene" | "Capsule" | "Recipe";
  price: number;
}

export interface ListingSearchParams {
  type?: "Gene" | "Capsule" | "Recipe";
  minPrice?: number;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "newest";
  limit?: number;
  offset?: number;
  q?: string;
  category?: string;
}

function buildQueryString(params: ListingSearchParams): string {
  const parts: string[] = [];
  if (params.type) parts.push(`type=${params.type}`);
  if (params.minPrice) parts.push(`minPrice=${params.minPrice}`);
  if (params.maxPrice) parts.push(`maxPrice=${params.maxPrice}`);
  if (params.sort) parts.push(`sort=${params.sort}`);
  if (params.limit) parts.push(`limit=${params.limit}`);
  if (params.offset) parts.push(`offset=${params.offset}`);
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.category) parts.push(`category=${encodeURIComponent(params.category)}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function useMarketplaceListings(params?: ListingSearchParams) {
  return useQuery({
    queryKey: ["marketplace", "listings", params],
    queryFn: async (): Promise<MarketplaceListing[]> => {
      const qs = buildQueryString(params ?? {});
      const response = await fetch(`/api/v2/marketplace/listings${qs}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch listings");
      const data = await response.json();
      return data.data?.listings ?? data.listings ?? data ?? [];
    },
  });
}

export function useListing(listingId: string | null) {
  return useQuery({
    queryKey: ["marketplace", "listing", listingId],
    queryFn: async (): Promise<MarketplaceListing | null> => {
      if (!listingId) return null;
      const response = await fetch(`/api/v2/marketplace/listings/${listingId}`, {
        credentials: "include",
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.data ?? data.listing ?? data;
    },
    enabled: Boolean(listingId),
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateListingRequest) => {
      const response = await fetch("/api/v2/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed" }));
        throw new Error(error.message);
      }
      const data = await response.json();
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

export function usePurchaseListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: PurchaseRequest) => {
      const response = await fetch(`/api/v2/marketplace/buy/${request.listingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentMethod: request.paymentMethod ?? "credits" }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Purchase failed" }));
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useCancelListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`/api/v2/marketplace/cancel/${listingId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed" }));
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

export function useTransactionHistory() {
  return useQuery({
    queryKey: ["marketplace", "transactions"],
    queryFn: async () => {
      const response = await fetch("/api/v2/marketplace/transactions", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch transactions");
      const data = await response.json();
      return data.transactions ?? data.data ?? [];
    },
  });
}

export function useMyPurchases() {
  return useQuery({
    queryKey: ["marketplace", "purchases"],
    queryFn: async () => {
      const response = await fetch("/api/v2/marketplace/purchases", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch purchases");
      const data = await response.json();
      return data.purchases ?? data.data ?? [];
    },
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: ["marketplace", "my-listings"],
    queryFn: async () => {
      const response = await fetch("/api/v2/marketplace/my-listings", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch listings");
      const data = await response.json();
      return data.listings ?? data.data ?? [];
    },
  });
}
