"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { apiClient, type CreditTransaction } from "@/lib/api/client";
import { Endpoints } from "@/lib/api/endpoints";

export default function CreditsPage() {
  const nodeId = useAuthStore((s) => s.userId);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["a2a", "credits", "history", nodeId],
    queryFn: () => apiClient.get<{ items: CreditTransaction[]; meta: { total: number } }>(
      Endpoints.a2a.creditsHistory(nodeId!)
    ),
    enabled: !!nodeId,
  });

  const transactions = historyData?.items ?? [];
  // balance may come from /a2a/credits/:nodeId — use meta.total as fallback for display
  const currentBalance = historyData?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Credits</h1>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-[var(--color-muted-foreground)]">Current Balance</p>
            <p className="text-3xl font-bold text-[var(--color-gene-green)]">
              {isLoading ? "—" : currentBalance.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--color-muted-foreground)]">Transactions</p>
            <p className="text-lg font-semibold text-[var(--color-gene-green)]">
              {isLoading ? "—" : transactions.length}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="pb-3 pr-4 text-[var(--color-muted-foreground)] font-medium">Date</th>
                <th className="pb-3 pr-4 text-[var(--color-muted-foreground)] font-medium">Description</th>
                <th className="pb-3 pr-4 text-right text-[var(--color-muted-foreground)] font-medium">Amount</th>
                <th className="pb-3 text-right text-[var(--color-muted-foreground)] font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                    Loading transactions…
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-3 pr-4 text-[var(--color-muted-foreground)]">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-card-foreground)]">{tx.description ?? tx.type}</td>
                    <td className="py-3 pr-4 text-right font-medium" style={{ color: tx.amount > 0 ? "var(--color-gene-green)" : "var(--color-destructive)" }}>
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                    <td className="py-3 text-right text-[var(--color-card-foreground)]">
                      {tx.balance_after ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
