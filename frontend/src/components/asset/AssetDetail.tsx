"use client";

/**
 * Asset detail page.
 *
 * Backend contracts:
 *   GET  /api/v1/assets/:assetId           — full detail incl. versions
 *   GET  /api/v1/assets/:assetId/versions  — version history (defensive)
 *   POST /api/v1/assets/:assetId/purchase  — purchaseAsset (Buy now)
 *   POST /api/v1/assets/:assetId/reviews   — createReview
 *
 * Cart integration:
 *   - "Add to Cart" pushes the asset into the cart store
 *   - "Buy Now" calls purchase directly and records the transaction
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { useCartStore, type CartItem, type PurchaseRecord } from "@/lib/stores/cart-store";
import { useAuthStore } from "@/lib/stores/auth-store";

type AssetType = "Gene" | "Capsule" | "Recipe" | string;

interface AssetVersion {
  id: string;
  versionNo: number;
  title?: string;
  changelog?: string | null;
  createdAt: string;
}

interface AssetReview {
  id: string;
  userId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

interface Asset {
  id: string;
  title?: string;
  name?: string;
  type: AssetType;
  description?: string | null;
  price?: number;
  published?: boolean;
  publishedVersionId?: string | null;
  versions?: AssetVersion[];
  avgRating?: number | null;
  reviewCount?: number;
  tags?: string[];
}

interface AssetDetailProps {
  assetId: string;
}

const typeBadgeClass: Record<string, string> = {
  Gene: "bg-purple-100 text-purple-700",
  Capsule: "bg-amber-100 text-amber-700",
  Recipe: "bg-emerald-100 text-emerald-700",
};

function AssetHeader({ asset }: { asset: Asset }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Badge className={typeBadgeClass[asset.type] ?? "bg-slate-100 text-slate-700"}>
            {asset.type}
          </Badge>
          <h1 className="mt-2 text-3xl font-bold">
            {asset.title ?? asset.name ?? asset.id}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{asset.price ?? 0} Credits</div>
          {asset.avgRating !== undefined && asset.avgRating !== null && (
            <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              ★ {asset.avgRating.toFixed(1)} ({asset.reviewCount ?? 0} reviews)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetDescription({ asset }: { asset: Asset }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Description</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm">
          {asset.description ?? 'No description provided.'}
        </p>
      </CardContent>
    </Card>
  );
}

function VersionsList({ assetId, versions }: { assetId: string; versions?: AssetVersion[] }) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery<AssetVersion[]>({
    queryKey: ['asset', assetId, 'versions'],
    queryFn: async () => {
      const r = await apiClient.get<{ success: boolean; data: AssetVersion[] }>(
        `/api/v1/assets/${assetId}/versions`,
      );
      return (r as any).data ?? (Array.isArray(r) ? (r as AssetVersion[]) : []);
    },
    initialData: versions,
  });

  const list = versionsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Versions ({list.length})</h2>
      </CardHeader>
      <CardContent>
        {versionsQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : list.length === 0 ? (
          <p data-testid="asset-versions-empty" className="py-4 text-sm text-[var(--color-muted-foreground)]">
            No published versions yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((v) => (
              <li
                key={v.id}
                data-testid="asset-version-row"
                className="rounded border border-[var(--color-border)] p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    v{v.versionNo} {v.title ? `· ${v.title}` : ''}
                  </p>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {v.changelog && (
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    {v.changelog}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewForm({ assetId, onSubmitted }: { assetId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/assets/${assetId}/reviews`, { rating, comment }),
    onSuccess: () => {
      setComment('');
      onSubmitted();
    },
  });

  if (!isAuthed) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Log in to leave a review.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Rating</label>
        <Input
          data-testid="review-rating"
          type="number"
          min={1}
          max={5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-20"
        />
      </div>
      <Textarea
        data-testid="review-comment"
        placeholder="Share your experience…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />
      <Button
        data-testid="review-submit"
        type="submit"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Posting…' : 'Post review'}
      </Button>
      {mutation.isError && (
        <p data-testid="review-error" className="text-sm text-[var(--color-destructive)]">
          Could not post review.
        </p>
      )}
      {mutation.isSuccess && (
        <p data-testid="review-success" className="text-sm text-green-600">
          Thanks for your feedback!
        </p>
      )}
    </form>
  );
}

function AssetPurchase({
  asset,
  onPurchase,
}: {
  asset: Asset;
  onPurchase: (record: PurchaseRecord) => void;
}) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.open);
  const [error, setError] = useState<string | null>(null);

  const buyNow = useMutation({
    mutationFn: async () => {
      const res: any = await apiClient.post(`/api/v1/assets/${asset.id}/purchase`, {});
      return res;
    },
    onSuccess: (res) => {
      onPurchase({
        transaction_id: res.id ?? res.transaction_id ?? asset.id,
        amount: typeof res.pricePaid === 'number' ? res.pricePaid : asset.price ?? 0,
        asset_id: res.assetId ?? asset.id,
        asset_name: asset.title ?? asset.name,
        version_id: res.versionId,
        status: res.status ?? 'completed',
        purchased_at: res.createdAt ?? new Date().toISOString(),
      });
    },
    onError: () => setError('Purchase failed. Please try again.'),
  });

  const handleAddToCart = () => {
    const item: CartItem = {
      assetId: asset.id,
      name: asset.title ?? asset.name ?? asset.id,
      price: asset.price ?? 0,
      type: asset.type,
      addedAt: new Date().toISOString(),
    };
    addItem(item);
    openCart();
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Purchase</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl font-bold">{asset.price ?? 0} Credits</div>
        <Button
          data-testid="asset-buy-now"
          className="w-full"
          size="lg"
          onClick={() => buyNow.mutate()}
          disabled={!isAuthed || buyNow.isPending}
        >
          {buyNow.isPending ? 'Processing…' : isAuthed ? 'Buy Now' : 'Log in to buy'}
        </Button>
        <Button
          data-testid="asset-add-to-cart"
          variant="outline"
          className="w-full"
          onClick={handleAddToCart}
        >
          Add to Cart
        </Button>
        {error && (
          <p data-testid="asset-purchase-error" className="text-sm text-[var(--color-destructive)]">
            {error}
          </p>
        )}
        {buyNow.isSuccess && (
          <p data-testid="asset-purchase-success" className="text-sm text-green-600">
            Purchase complete. See your dashboard for the transaction.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AssetDetail({ assetId }: AssetDetailProps) {
  const recordPurchase = useCartStore((s) => s.recordPurchase);
  const queryClient = useQueryClient();

  const { data: asset, isLoading, isError } = useQuery<Asset>({
    queryKey: ['asset', assetId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/v1/assets/${assetId}`);
      return (res as any).data ?? res;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">
          Failed to load asset
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          It may have been removed, recycled, or not yet published.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <AssetHeader asset={asset} />

        <Tabs defaultValue="description">
          <TabsList>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="description">
            <AssetDescription asset={asset} />
          </TabsContent>
          <TabsContent value="versions">
            <VersionsList assetId={assetId} versions={asset.versions} />
          </TabsContent>
          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Reviews</h2>
              </CardHeader>
              <CardContent>
                <ReviewForm
                  assetId={assetId}
                  onSubmitted={() =>
                    queryClient.invalidateQueries({ queryKey: ['asset', assetId] })
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <AssetPurchase
          asset={asset}
          onPurchase={(rec) => {
            recordPurchase(rec);
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
          }}
        />
      </div>
    </div>
  );
}
