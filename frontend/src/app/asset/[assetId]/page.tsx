"use client";

/**
 * Asset detail route page.
 *
 * Renders the shared AssetDetail component which calls:
 *   GET  /api/v1/assets/:assetId
 *   GET  /api/v1/assets/:assetId/versions
 *   POST /api/v1/assets/:assetId/reviews
 *   POST /api/v1/assets/:assetId/purchase
 */
import { use } from 'react';
import Link from 'next/link';
import { AssetDetail } from '@/components/asset/AssetDetail';
import { Button } from '@/components/ui/button';

export default function AssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = use(params);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16">
      <div>
        <Link href="/marketplace" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
          ← Back to Marketplace
        </Link>
      </div>
      <AssetDetail assetId={assetId} />
    </div>
  );
}
