/**
 * @jest-environment jsdom
 *
 * Tests for React Query hooks (useAssets, useTrendingAssets, useRankedAssets, etc.)
 * using @testing-library/react helpers.
 */
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mock data ────────────────────────────────────────────────────────────────
const mockAssets = [
  { asset_id: "asset-1", name: "BRCA1", type: "Gene", dna: "ATCG", score: 0.95 },
  { asset_id: "asset-2", name: "p53", type: "Protein", dna: "GTCA", score: 0.88 },
];

const mockGetAssets = jest.fn();
const mockGetTrending = jest.fn();
const mockGetAssetsRanked = jest.fn();
const mockGetAssetById = jest.fn();
const mockGetAssetLineage = jest.fn();
const mockSearchAssets = jest.fn();
const mockPublish = jest.fn();

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    getAssets: (...args: unknown[]) => mockGetAssets(...args),
    getTrending: (...args: unknown[]) => mockGetTrending(...args),
    getAssetsRanked: (...args: unknown[]) => mockGetAssetsRanked(...args),
    getAssetById: (...args: unknown[]) => mockGetAssetById(...args),
    getAssetLineage: (...args: unknown[]) => mockGetAssetLineage(...args),
    searchAssets: (...args: unknown[]) => mockSearchAssets(...args),
    publish: (...args: unknown[]) => mockPublish(...args),
  },
}));

// Import AFTER the mock so hooks use mocked apiClient
import { useAssets, useTrendingAssets, useRankedAssets, useAssetById, useAssetLineage, useAssetSearch, usePublishAsset } from "./useAssets";

// ── Test wrapper ─────────────────────────────────────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── useAssets tests ────────────────────────────────────────────────────────────
describe("useAssets", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches assets with no filters", async () => {
    mockGetAssets.mockResolvedValue(mockAssets);
    const { result } = renderHook(() => useAssets(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAssets);
    expect(mockGetAssets).toHaveBeenCalledWith(undefined);
  });

  it("fetches assets with filters", async () => {
    mockGetAssets.mockResolvedValue([mockAssets[0]]);
    const filters = { type: "Gene" as const };
    const { result } = renderHook(() => useAssets(filters), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetAssets).toHaveBeenCalledWith(filters);
  });
});

describe("useTrendingAssets", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches trending assets", async () => {
    mockGetTrending.mockResolvedValue(mockAssets);
    const { result } = renderHook(() => useTrendingAssets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAssets);
  });
});

describe("useRankedAssets", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches ranked assets", async () => {
    mockGetAssetsRanked.mockResolvedValue(mockAssets);
    const { result } = renderHook(() => useRankedAssets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAssets);
  });
});

describe("useAssetById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not fetch when assetId is empty", async () => {
    const { result } = renderHook(() => useAssetById(""), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockGetAssetById).not.toHaveBeenCalled();
  });

  it("fetches asset by id", async () => {
    mockGetAssetById.mockResolvedValue(mockAssets[0]);
    const { result } = renderHook(() => useAssetById("asset-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAssets[0]);
    expect(mockGetAssetById).toHaveBeenCalledWith("asset-1");
  });
});

describe("useAssetLineage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not fetch when assetId is empty", async () => {
    const { result } = renderHook(() => useAssetLineage(""), { wrapper: createWrapper() });

    expect(result.current.isFetching).toBe(false);
    expect(mockGetAssetLineage).not.toHaveBeenCalled();
  });

  it("fetches asset lineage", async () => {
    const lineage = { nodes: [], edges: [] };
    mockGetAssetLineage.mockResolvedValue(lineage);
    const { result } = renderHook(() => useAssetLineage("asset-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(lineage);
  });
});

describe("useAssetSearch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not fetch when query is empty", async () => {
    const { result } = renderHook(() => useAssetSearch(""), { wrapper: createWrapper() });

    expect(result.current.isFetching).toBe(false);
    expect(mockSearchAssets).not.toHaveBeenCalled();
  });

  it("fetches assets when query is non-empty", async () => {
    mockSearchAssets.mockResolvedValue(mockAssets);
    const { result } = renderHook(() => useAssetSearch("gene", 1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSearchAssets).toHaveBeenCalledWith("gene", 1);
  });
});

describe("usePublishAsset", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls publish API on mutation", async () => {
    mockPublish.mockResolvedValue({ asset_id: "new-asset", status: "published", created_at: "2024-01-01" });
    const { result } = renderHook(() => usePublishAsset(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ name: "Test", type: "Gene" as const, dna: "ATCG" });
    });

    expect(mockPublish).toHaveBeenCalledWith({
      name: "Test",
      type: "Gene",
      dna: "ATCG",
      description: undefined,
      signals: undefined,
    });
  });
});
