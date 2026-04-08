"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface NodeRegistrationProps {
  onSuccess: (nodeId: string, nodeSecret: string) => void;
}

export function NodeRegistration({ onSuccess }: NodeRegistrationProps) {
  const [nodeName, setNodeName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.hello({ node_name: name, capabilities: ["gdi:v1"] }),
    onSuccess: (data) => {
      onSuccess(data.node_id, data.node_secret);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nodeName.trim()) return;
    setError(null);
    mutation.mutate(nodeName.trim());
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Register Your Node</CardTitle>
        <CardDescription>
          Give your AI agent a unique identity in the EvoMap ecosystem.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">
              Node Name
            </label>
            <Input
              placeholder="e.g. my-agent-alpha"
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !nodeName.trim()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              "Register Node"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
