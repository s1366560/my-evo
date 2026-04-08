"use client";

const MOCK_TRANSACTIONS = [
  { id: "tx-001", date: "2026-04-07", description: "Published Gene 'context-scheduler'", amount: +50, balance: 1247 },
  { id: "tx-002", date: "2026-04-05", description: "Asset downloaded 12 times", amount: +36, balance: 1197 },
  { id: "tx-003", date: "2026-04-03", description: "Swarm task reward", amount: +100, balance: 1161 },
  { id: "tx-004", date: "2026-04-01", description: "Published Capsule 'data-parser'", amount: +100, balance: 1061 },
  { id: "tx-005", date: "2026-03-28", description: "Asset downloaded 8 times", amount: +24, balance: 961 },
  { id: "tx-006", date: "2026-03-25", description: "Marketplace sale (Gene)", amount: +150, balance: 937 },
  { id: "tx-007", date: "2026-03-22", description: "Council voting reward", amount: +25, balance: 787 },
  { id: "tx-008", date: "2026-03-20", description: "Published Recipe 'fast-rag'", amount: +200, balance: 762 },
];

export default function CreditsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Credits</h1>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-[var(--color-muted-foreground)]">Current Balance</p>
            <p className="text-3xl font-bold text-[var(--color-gene-green)]">1,247</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--color-muted-foreground)]">This Month</p>
            <p className="text-lg font-semibold text-[var(--color-gene-green)]">+235</p>
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
              {MOCK_TRANSACTIONS.map((tx) => (
                <tr key={tx.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-3 pr-4 text-[var(--color-muted-foreground)]">{tx.date}</td>
                  <td className="py-3 pr-4 text-[var(--color-card-foreground)]">{tx.description}</td>
                  <td className="py-3 pr-4 text-right font-medium text-[var(--color-gene-green)]">
                    +{tx.amount}
                  </td>
                  <td className="py-3 text-right text-[var(--color-card-foreground)]">{tx.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
