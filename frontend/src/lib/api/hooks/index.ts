/**
 * API Hooks Index
 * Re-exports all custom React Query hooks for API operations
 */

// Re-export use-gdi hooks
export {
  useBatchScore,
  useGDIScoreHistory,
  useGDIConfig,
  useGDIWeights,
  useScoreAsset,
} from "./use-gdi";

export type {
  AssetForScoring,
  GDIScoreResult,
  BatchScoreRequest,
  BatchScoreResponse,
  GDIScoreHistory,
  GDIConfig,
  GDIWeights,
} from "./use-gdi";

// Re-export use-marketplace hooks
export {
  useMarketplaceListings,
  useListing,
  useCreateListing,
  usePurchaseListing,
  useCancelListing,
  useTransactionHistory,
  useMyPurchases,
  useMyListings,
} from "./use-marketplace";

export type {
  PurchaseRequest,
  PurchaseResponse,
  CreateListingRequest,
  ListingSearchParams,
} from "./use-marketplace";

// Re-export use-workspace hooks
export {
  useWorkspaceGoals,
  useWorkspaceTasks,
  useWorkspaceWorkers,
  useWorkspaceSync,
} from "./use-workspace";

// Re-export GEP hooks
export {
  useGepGenes,
  useGepPublishGene,
  useGepGene,
  useValidateGene,
} from "./use-gep-gene";

export {
  useGepCapsules,
  useGepPublishCapsule,
  useGepCapsule,
  useValidateCapsule,
} from "./use-gep-capsule";

export {
  useGepPublish,
  createGeneAsset,
  createCapsuleAsset,
  generateMessageId,
} from "./use-gep-publish";

export {
  useGeneSearch,
  useCapsuleSearch,
  useNodeSearch,
  useGepValidate,
  useGepAdapters,
} from "./use-gep-search";

export type {
  GeneSearchParams,
  GeneSearchResponse,
  CapsuleSearchParams,
  CapsuleSearchResponse,
  NodeSearchParams,
  NodeSearchResponse,
} from "./use-gep-search";

// Re-export use-gep types
export type {
  Gene,
  GeneResponse,
  GepPublishGeneResponse,
  Capsule,
  CapsuleResponse,
  GepPublishCapsuleResponse,
  GepNode,
  GepNodesResponse,
  GepNodeResponse,
  GeneCategory,
  ValidationResult,
  ValidationError,
  RegisterGeneRequest,
  RegisterCapsuleRequest,
  ApiResponse,
} from "./use-gep-types";

export type {
  PublishableAsset,
  PublishEnvelope,
  PublishRequest,
  PublishResult,
  PublishApiResponse,
  PublishableAssetType,
} from "./use-gep-publish";
