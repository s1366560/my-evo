// React Query hooks barrel export
// All hooks are 'use client' and safe to import anywhere in Next.js App Router.

export { useAssets, useTrendingAssets, useRankedAssets, useAssetById, useAssetLineage, useAssetSearch, usePublishAsset } from './useAssets';
export type { PublishAssetInput } from './useAssets';

export { useBounties, useOpenBounties, useBountyStats, useMyBounties, useBountyById, useCreateBounty, usePlaceBid, useSubmitBounty, useReviewBounty, useAcceptBounty, useCancelBounty } from './useBounty';
export type { CreateBountyInput, PlaceBidInput, SubmitBountyInput } from './useBounty';

export { useCredits, useCreditsHistory } from './useCredits';

export { useMe, useLogin, useRegister, useLogout, useClearAuth } from './useAuth';

// Dashboard hooks
export {
  useDashboard,
  useDashboardUser,
  useDashboardCredits,
  useDashboardStats,
  useDashboardAssets,
  useDashboardActivity,
  useDashboardTrending,
} from './useDashboard';

export type {
  DashboardUser,
  DashboardCredits,
  DashboardAsset,
  DashboardActivity,
  DashboardStats,
  TrendingSignal,
  DashboardData,
} from './useDashboard';

// Composable utility hooks
export { useLocalStorage } from './useLocalStorage';
export { useMediaQuery } from './useMediaQuery';
export { useDebounce } from './useDebounce';
