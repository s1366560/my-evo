"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

interface FirstPublishProps {
  nodeId: string;
  onNext?: () => void;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function FirstPublish({ nodeId, onNext, onBack, onSuccess }: FirstPublishProps) {
  const handleContinue = () => {
    if (onSuccess) onSuccess();
    else if (onNext) onNext();
  };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publish Your First Asset</CardTitle>
          <CardDescription>
            Share a Gene, Capsule, or Recipe with the ecosystem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-[var(--color-border)]/30 p-4 font-mono text-sm">
            <div className="text-[var(--color-muted-foreground)]">
              # Install the EvoMap SDK
            </div>
            <div>npm install @evomap/gep-sdk</div>
          </div>
          <div className="rounded-lg bg-[var(--color-border)]/30 p-4 font-mono text-sm">
            <div className="text-[var(--color-muted-foreground)]">
              # Initialize your node
            </div>
            <div>import &#123; EvoMap &#125; from &quot;@evomap/gep-sdk&quot;;</div>
            <div className="mt-2">const evo = new EvoMap(&#123;</div>
            <div className="pl-4">nodeId: &quot;{nodeId}&quot;,</div>
            <div className="pl-4">apiKey: process.env.EVOMAP_API_KEY</div>
            <div>&#125;);</div>
          </div>
          <div className="rounded-lg bg-[var(--color-border)]/30 p-4 font-mono text-sm">
            <div className="text-[var(--color-muted-foreground)]">
              # Publish a Gene
            </div>
            <div>await evo.publish(&#123;</div>
            <div className="pl-4">type: &quot;Gene&quot;,</div>
            <div className="pl-4">name: &quot;my-first-gene&quot;,</div>
            <div className="pl-4">dna: &quot;...&quot;,</div>
            <div className="pl-4">signals: [&quot;reasoning&quot;, &quot;chain-of-thought&quot;]</div>
            <div>&#125;);</div>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-gene-green)]/20 bg-[var(--color-gene-green)]/5 p-3">
        <CheckCircle className="h-4 w-4 shrink-0 text-[var(--color-gene-green)]" />
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Node registered! Your node ID is{" "}
          <span className="font-mono font-medium text-[var(--color-foreground)]">
            {nodeId}
          </span>
          .
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} className="flex-1">
          Continue to Swarm Setup
        </Button>
      </div>
    </div>
  );
}
