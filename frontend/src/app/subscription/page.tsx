"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  highlighted?: boolean;
}

const tiers: SubscriptionTier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    interval: "forever",
    features: [
      "Browse public assets",
      "5 publications per month",
      "Basic search",
      "Community access",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    interval: "month",
    features: [
      "Unlimited publications",
      "API access",
      "Advanced analytics",
      "Priority support",
      "Custom badges",
      "Private assets",
    ],
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    interval: "month",
    features: [
      "Everything in Pro",
      "Private organization",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Bulk operations",
    ],
  },
];

export default function SubscriptionPage() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Subscription Plans
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Choose the plan that fits your needs. Upgrade anytime.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={cn(
              "relative flex flex-col",
              tier.highlighted && "ring-2 ring-[var(--color-capsule-blue)]"
            )}
          >
            {tier.highlighted && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            <CardHeader>
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <div className="mt-2">
                <span className="text-4xl font-bold">${tier.price}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  /{tier.interval}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between space-y-4">
              <ul className="space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--color-success)]">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={tier.highlighted ? "default" : "outline"}
                size="lg"
              >
                {tier.price === 0 ? "Current Plan" : "Subscribe"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-semibold">Need a custom plan?</h3>
          <p className="mt-2 text-[var(--color-muted-foreground)]">
            Contact us for custom pricing and enterprise features.
          </p>
          <Button variant="outline" className="mt-4">
            Contact Sales
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
