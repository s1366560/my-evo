"use client";

/**
 * Purchase history page.
 *
 * Surfaces:
 *   - Recent purchases cached in the cart store (has `transaction_id`, `amount`)
 *   - The full asset catalogue (GET /api/v1/assets) so the user can revisit
 *     previously seen items
 *
 * The page is intentionally read-only: purchases happen on the asset detail
 * or cart page; this view just records and presents them.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useCartStore, type PurchaseRecord } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface AssetsListResponse {
  success?: boolean;
  data?: any[];
  items?: any[];
  pagination?: { total: number; page: number; limit: number };
}

export default function PurchaseHistoryPage() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const recent = useCartStore((s) => s.recentPurchases);

  // GET /api/v1/assets — full catalogue
  const assetsQuery = useQuery({
    queryKey: ['purchases', 'assets'],
    queryFn: async () => {
      const r = await apiClient.get<AssetsListResponse>('/api/v1/assets?page=1&limit=50');
      return r;
    },
  });

  const allAssets: any[] = useMemo(() => {
    const r = assetsQuery.data as any;
    if (!r) return [];
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.items)) return r.items;
    if (Array.isArray(r)) return r;
    return [];
  }, [assetsQuery.data]);

  const purchasedAssetIds = new Set(recent.map((p) => p.asset_id));
  const myAssets = allAssets.filter((a) => purchasedAssetIds.has(a.id));

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">
          Please log in to view your purchase history.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/login">
            <Button>Log in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">My Purchases</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Transaction history and access to your acquired assets.
        </p>
      </div>

      <Card data-testid="purchase-history-card">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p data-testid="purchase-empty" className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              No purchases yet. Visit the marketplace to acquire your first asset.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="purchase-table">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
                    <th className="py-2 pr-3">Transaction</th>
                    <th className="py-2 pr-3">Asset</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <PurchaseRow key={p.transaction_id} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchased Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {assetsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : myAssets.length === 0 ? (
            <p data-testid="purchased-assets-empty" className="py-4 text-sm text-[var(--color-muted-foreground)]">
              {recent.length > 0
                ? 'Asset details not in the catalogue.'
                : 'Nothing here yet.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {myAssets.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border border-[var(--color-border)] p-3"
                >
                  <div>
                    <Link
                      href={`/asset/${a.id}`}
                      className="font-medium hover:underline"
                    >
                      {a.title ?? a.name ?? a.id}
                    </Link>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {a.type ?? 'Asset'} · {a.price ?? 0} credits
                    </p>
                  </div>
                  <Link href={`/asset/${a.id}`}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PurchaseRow({ p }: { p: PurchaseRecord }) {
  return (
    <tr data-testid="purchase-row" className="border-b border-[var(--color-border)] last:border-0">
      <td className="py-2 pr-3 font-mono text-xs">{p.transaction_id}</td>
      <td className="py-2 pr-3">
        <Link href={`/asset/${p.asset_id}`} className="hover:underline">
          {p.asset_name ?? p.asset_id}
        </Link>
      </td>
      <td className="py-2 pr-3 font-semibold">{p.amount} cr</td>
      <td className="py-2 pr-3">
        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
          {p.status}
        </span>
      </td>
      <td className="py-2 pr-3 text-xs text-[var(--color-muted-foreground)]">
        {new Date(p.purchased_at).toLocaleString()}
      </td>
    </tr>
  );
}
