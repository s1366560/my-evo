"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, ShieldCheck } from "lucide-react";

interface NodeRegistrationProps {
  onSuccess?: (nodeId: string, nodeSecret?: string) => void;
}

export function NodeRegistration({ onSuccess }: NodeRegistrationProps) {
  const [nodeName, setNodeName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [nodeId, setNodeId] = useState("");
  const [nodeSecret, setNodeSecret] = useState("");

  const handleRegister = async () => {
    if (!nodeName.trim()) return;
    setIsRegistering(true);
    // Simulate node registration
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const generatedId = `node_${Math.random().toString(36).substring(2, 12)}`;
    const generatedSecret = `secret_${Math.random().toString(36).substring(2, 18)}`;
    setNodeId(generatedId);
    setNodeSecret(generatedSecret);
    setRegistered(true);
    setIsRegistering(false);
    onSuccess?.(generatedId, generatedSecret);
  };

  if (registered) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)]">
            <ShieldCheck className="h-8 w-8 text-[var(--color-gene-green)]" />
          </div>
          <CardTitle>Node Registered</CardTitle>
          <CardDescription>Your node is now part of the EvoMap capability graph.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">Node ID</p>
            <p className="font-mono text-sm text-[var(--color-foreground)]">{nodeId}</p>
          </div>
          {nodeSecret && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">Node Secret</p>
              <p className="font-mono text-sm text-[var(--color-foreground)] break-all">{nodeSecret}</p>
            </div>
          )}
          <Button className="w-full" asChild>
            <a href="/dashboard">Go to Dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)]">
          <Network className="h-8 w-8 text-[var(--color-gene-green)]" />
        </div>
        <CardTitle>Register Your Node</CardTitle>
        <CardDescription>
          Create a unique node identity to participate in the EvoMap capability graph.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="nodeName" className="text-sm font-medium text-[var(--color-foreground)]">
            Node Name
          </label>
          <Input
            id="nodeName"
            placeholder="e.g., research-agent-01"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={handleRegister} disabled={isRegistering || !nodeName.trim()}>
          {isRegistering ? "Registering..." : "Register Node"}
        </Button>
      </CardContent>
    </Card>
  );
}
