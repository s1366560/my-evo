"use client";

/**
 * CartDrawer — slide-in cart for the marketplace.
 *
 * Talks to existing backend contracts:
 *   GET  /api/v1/assets/:assetId           — refresh each line item
 *   POST /api/v1/assets/:assetId/purchase  — purchaseAsset
 *
 * The backend returns { id, assetId, versionId, userId, pricePaid, status,
 * idempotencyKey, createdAt }; we surface that as
 * { transaction_id: id, amount: pricePaid, asset_id: assetId, version_id: versionId }
 * to satisfy the dashboard purchase history contract.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useCartStore, type CartItem, type PurchaseRecord } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AssetSummary {
  id: string;
  title: string;
  name?: string;
  type: string;
  price: number;
}

function useCartAssets(items: CartItem[]) {
  return useQuery({
    queryKey: ['cart', 'assets', items.map((i) => i.assetId).join(',')],
    enabled: items.length > 0,
    queryFn: async () => {
      const results = await Promise.allSettled(
        items.map((item) =>
          apiClient.get<AssetSummary>(`/api/v1/assets/${item.assetId}`),
        ),
      );
      return results.map((r, idx) => {
        if (r.status === 'fulfilled') {
          const v = r.value as any;
          return {
            ...items[idx],
            title: v.title ?? items[idx].name,
            type: v.type ?? items[idx].type,
            price: typeof v.price === 'number' ? v.price : items[idx].price,
            live: true,
          } as CartItem & { live: boolean };
        }
        return { ...items[idx], live: false } as CartItem & { live: boolean };
      });
    },
  });
}

export function CartDrawer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.close);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const recordPurchase = useCartStore((s) => s.recordPurchase);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  const { data: liveItems, isLoading } = useCartAssets(items);

  const [error, setError] = useState<string | null>(null);

  const purchaseMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await apiClient.post<any>(`/api/v1/assets/${assetId}/purchase`, {});
      return { assetId, res };
    },
    onSuccess: ({ assetId, res }, _vars, _ctx) => {
      const rec: PurchaseRecord = {
        transaction_id: res.id ?? res.transaction_id ?? assetId,
        amount: typeof res.pricePaid === 'number' ? res.pricePaid : res.amount ?? 0,
        asset_id: res.assetId ?? assetId,
        asset_name: items.find((i) => i.assetId === assetId)?.name,
        version_id: res.versionId,
        status: res.status ?? 'completed',
        purchased_at: res.createdAt ?? new Date().toISOString(),
      };
      recordPurchase(rec);
      removeItem(assetId);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
  });

  const goCheckout = () => {
    close();
    router.push('/checkout');
  };

  useEffect(() => {
    if (!isOpen) setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const total = (liveItems ?? items).reduce((s, i) => s + (i.price ?? 0), 0);

  return (
    <>
      <div
        data-testid="cart-backdrop"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={close}
      />
      <aside
        data-testid="cart-drawer"
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col',
          'border-l border-[var(--color-border)] bg-[var(--color-background)]',
          'shadow-xl',
        )}
        role="dialog"
        aria-label="Shopping cart"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-lg font-semibold">Cart ({items.length})</h2>
          <Button variant="ghost" size="sm" onClick={close} aria-label="Close cart">
            ✕
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 && (
            <p data-testid="cart-empty" className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">
              Your cart is empty. Browse the marketplace to add assets.
            </p>
          )}

          {isLoading && items.length > 0 && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!isLoading &&
            (liveItems ?? items.map((i) => ({ ...i, live: true }))).map((it: any) => (
              <div
                key={it.assetId}
                data-testid="cart-item"
                className="mb-2 flex items-center justify-between gap-2 rounded border border-[var(--color-border)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {it.title ?? it.name ?? it.assetId}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {it.type ?? 'Asset'} · {it.price ?? 0} credits
                    {!it.live && ' (cached)'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => purchaseMutation.mutate(it.assetId)}
                    disabled={purchaseMutation.isPending}
                    data-testid="cart-buy-now"
                  >
                    Buy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(it.assetId)}
                    data-testid="cart-remove"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}

          {error && (
            <p data-testid="cart-error" className="mt-2 text-sm text-[var(--color-destructive)]">
              {error}
            </p>
          )}

          {purchaseMutation.isError && (
            <p data-testid="cart-error" className="mt-2 text-sm text-[var(--color-destructive)]">
              Purchase failed. Please try again.
            </p>
          )}
        </div>

        <footer className="border-t border-[var(--color-border)] px-4 py-3">
          <div className="mb-2 flex justify-between text-sm">
            <span>Total</span>
            <span data-testid="cart-total" className="font-semibold">
              {total} credits
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={clear}
              disabled={items.length === 0}
              data-testid="cart-clear"
            >
              Clear
            </Button>
            <Button
              className="flex-1"
              onClick={goCheckout}
              disabled={items.length === 0}
              data-testid="cart-checkout"
            >
              {isAuthed ? 'Checkout' : 'Sign in to checkout'}
            </Button>
          </div>
        </footer>
      </aside>
    </>
  );
}

export default CartDrawer;
