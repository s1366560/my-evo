import type { Verdict } from './types';

export const ASSET_QUALITY_DISPUTE_TYPE = 'asset_quality';
export const ASSET_QUALITY_DISPUTE_TYPES = [
  ASSET_QUALITY_DISPUTE_TYPE,
  'ASSET_QUALITY',
] as const;

export type AssetQualityDisputeRecord = {
  status: string;
  ruling: unknown;
};

function getVerdict(ruling: unknown): Verdict | null {
  if (!ruling || typeof ruling !== 'object') {
    return null;
  }

  const verdict = (ruling as { verdict?: unknown }).verdict;
  if (
    verdict === 'plaintiff_wins'
    || verdict === 'defendant_wins'
    || verdict === 'compromise'
    || verdict === 'no_fault'
  ) {
    return verdict;
  }

  return null;
}

export function blocksAssetPromotion(disputes: AssetQualityDisputeRecord[]): boolean {
  const { passes, fails, blocks } = summarizeAssetQualityDisputes(disputes);
  return blocks || (fails > 0 && fails >= passes);
}

export function summarizeAssetQualityDisputes(
  disputes: AssetQualityDisputeRecord[],
): { passes: number; fails: number; blocks: boolean } {
  let passes = 0;
  let fails = 0;

  for (const dispute of disputes) {
    if (dispute.status === 'dismissed') {
      continue;
    }

    if (dispute.status !== 'resolved') {
      return { passes, fails, blocks: true };
    }

    const verdict = getVerdict(dispute.ruling);
    if (!verdict) {
      return { passes, fails, blocks: true };
    }

    if (verdict === 'defendant_wins' || verdict === 'no_fault') {
      passes += 1;
      continue;
    }

    fails += 1;
  }

  return { passes, fails, blocks: false };
}
