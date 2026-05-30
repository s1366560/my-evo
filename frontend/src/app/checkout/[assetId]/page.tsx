"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface Asset {
  id: string;
  name: string;
  type: string;
  price: number;
  seller: string;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.assetId as string;
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock asset data - in production this would come from API
  const asset: Asset = {
    id: assetId,
    name: "Evolutionary Gene Alpha",
    type: "Gene",
    price: 150,
    seller: "EvolutionLab",
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    // Simulate checkout processing
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsProcessing(false);
    router.push("/dashboard");
  };

  if (!assetId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg">Invalid asset ID</p>
        <Link href="/marketplace">
          <Button variant="outline" className="mt-4">
            Back to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Link href={`/asset/${assetId}`}>
          <Button variant="ghost" size="sm">
            ← Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Order Summary</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Item</span>
              <span className="font-medium">{asset.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Seller</span>
              <span>{asset.seller}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Type</span>
              <span>{asset.type}</span>
            </div>
            <hr className="my-2 border-[var(--color-border)]" />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{asset.price} Credits</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Payment</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="credits" className="text-sm font-medium">Available Credits</label>
              <Input id="credits" type="number" placeholder="500" defaultValue="500" />
            </div>
            <div className="space-y-2">
              <label htmlFor="coupon" className="text-sm font-medium">Coupon Code (Optional)</label>
              <Input id="coupon" placeholder="Enter code" />
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : `Pay ${asset.price} Credits`}
            </Button>
            <p className="text-center text-xs text-[var(--color-muted-foreground)]">
              By completing this purchase, you agree to our terms of service.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
