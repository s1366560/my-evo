"use client";

/**
 * Cart checkout page.
 *
 * Combines cart contents with the buyer's credit balance (via
 * GET /api/v1/auth/me) and submits each line through
 * POST /api/v1/assets/:assetId/purchase (purchaseAsset).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useCartStore } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface MeResponse {
  user?: { id: string; email: string; role?: string };
  credits?: number;
}

export default function CartCheckoutPage() {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clear);
  const recordPurchase = useCartStore((s) => s.recordPurchase);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ assetId: string; ok: boolean; tx?: string }>>([]);

  // GET /api/v1/auth/me — gives us current user + credit balance
  const meQuery = useQuery({
    queryKey: ['checkout', 'me'],
    enabled: isAuthed,
    queryFn: async () => {
      const r = await apiClient.get<MeResponse>('/api/v1/auth/me');
      return r;
    },
  });

  const balance = (meQuery.data as any)?.credits ?? 0;
  const total = items.reduce((s, i) => s + i.price, 0);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setError(null);
    setSubmitting(true);
    const out: Array<{ assetId: string; ok: boolean; tx?: string }> = [];
    for (const item of items) {
      try {
        const res: any = await apiClient.post(`/api/v1/assets/${item.assetId}/purchase`, {});
        out.push({
          assetId: item.assetId,
          ok: true,
          tx: res.id ?? res.transaction_id,
        });
        recordPurchase({
          transaction_id: res.id ?? res.transaction_id ?? item.assetId,
          amount: typeof res.pricePaid === 'number' ? res.pricePaid : item.price,
          asset_id: res.assetId ?? item.assetId,
          asset_name: item.name,
          version_id: res.versionId,
          status: res.status ?? 'completed',
          purchased_at: res.createdAt ?? new Date().toISOString(),
        });
        removeItem(item.assetId);
      } catch (e) {
        out.push({ assetId: item.assetId, ok: false });
        setError(`Failed to purchase ${item.name}. Please try again.`);
      }
    }
    setResults(out);
    setSubmitting(false);
    if (out.every((r) => r.ok)) {
      clearCart();
      router.push('/dashboard/purchases');
    }
  };

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">
          Please log in to complete checkout.
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <Link href="/login">
            <Button>Log in</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">Register</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-16">
      <div className="space-y-2">
        <Link href="/marketplace" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
          ← Back to Marketplace
        </Link>
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {meQuery.isLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <p data-testid="checkout-balance" className="text-2xl font-semibold">
              {balance} credits
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <p data-testid="checkout-empty" className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              Your cart is empty.
            </p>
          )}
          {items.map((it) => (
            <div
              key={it.assetId}
              data-testid="checkout-item"
              className="flex justify-between rounded border border-[var(--color-border)] p-3"
            >
              <div>
                <p className="font-medium">{it.name}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {it.type ?? 'Asset'}
                </p>
              </div>
              <p className="font-semibold">{it.price} credits</p>
            </div>
          ))}

          {items.length > 0 && (
            <div className="flex justify-between border-t border-[var(--color-border)] pt-3 text-lg font-bold">
              <span>Total</span>
              <span data-testid="checkout-total">{total} credits</span>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r) => (
              <p
                key={r.assetId}
                data-testid={r.ok ? 'checkout-result-ok' : 'checkout-result-fail'}
                className={r.ok ? 'text-sm text-green-600' : 'text-sm text-[var(--color-destructive)]'}
              >
                {r.assetId}: {r.ok ? `OK (tx ${r.tx})` : 'failed'}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <p data-testid="checkout-error" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
        <Button
          data-testid="checkout-pay"
          disabled={items.length === 0 || submitting || total > balance}
          onClick={handleCheckout}
        >
          {submitting ? 'Processing…' : `Pay ${total} credits`}
        </Button>
      </div>
    </div>
  );
}
