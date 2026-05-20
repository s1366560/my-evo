"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, ShoppingCart, ArrowDownUp, History } from "lucide-react";

interface CreditInfo {
  balance: number;
  tier: string;
  monthly_allowance: number;
  remaining_this_month: number;
  last_updated: string;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus_credits: number;
  price_cents: number;
}

function CreditsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("evomap-auth");
    if (!token) {
      router.push("/login");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    const nodeSecret = localStorage.getItem("evomap-node-secret") || "stub-node-secret";

    const headers = { "Content-Type": "application/json", "x-node-secret": nodeSecret };

    Promise.all([
      fetch(`${apiUrl}/api/v2/credits/balance`, { headers }).then((r) => r.json()).catch(() => null),
      fetch(`${apiUrl}/api/v2/credits/packages`, { headers }).then((r) => r.json()).catch(() => null),
    ]).then(([balanceData, packagesData]) => {
      if (balanceData?.success && balanceData.data) {
        setCreditInfo(balanceData.data);
      } else {
        setCreditInfo({
          balance: 0,
          tier: "free",
          monthly_allowance: 200,
          remaining_this_month: 0,
          last_updated: new Date().toISOString(),
        });
      }
      if (packagesData?.success && packagesData.data?.packages) {
        setPackages(packagesData.data.packages);
      }
    }).catch(() => {
      setCreditInfo({
        balance: 0,
        tier: "free",
        monthly_allowance: 200,
        remaining_this_month: 0,
        last_updated: new Date().toISOString(),
      });
    }).finally(() => setLoading(false));
  }, [router]);

  const formatCredits = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Credits</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Manage your credits balance and purchase additional credits
        </p>
      </div>

      {loading ? (
        <CreditsSkeleton />
      ) : (
        <>
          {/* Balance Card */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Coins className="h-5 w-5 text-[var(--color-gene-green)]" />
                    Balance
                  </CardTitle>
                  <CardDescription>Current credits balance</CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">{creditInfo?.tier ?? "free"}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-[var(--color-gene-green)]">
                  {formatCredits(creditInfo?.balance ?? 0)}
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  {formatCredits(creditInfo?.remaining_this_month ?? 0)} remaining this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <TrendingUp className="h-5 w-5 text-[var(--color-gene-green)]" />
                  Monthly Allowance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCredits(creditInfo?.monthly_allowance ?? 0)}
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">credits/month</p>
              </CardContent>
            </Card>
          </div>

          {/* Packages */}
          {packages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase Credits
                </CardTitle>
                <CardDescription>
                  Buy additional credits for expanded usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-gene-green)] transition-colors"
                    >
                      <div className="font-semibold">{pkg.name}</div>
                      <div className="mt-1 text-2xl font-bold text-[var(--color-gene-green)]">
                        {pkg.credits.toLocaleString()}
                      </div>
                      <div className="text-sm text-[var(--color-muted-foreground)]">
                        +{pkg.bonus_credits} bonus
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        ${(pkg.price_cents / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stub links */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-5 w-5" />
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  View your credit transaction history
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowDownUp className="h-5 w-5" />
                  Economics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  Credits-based economy overview
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
