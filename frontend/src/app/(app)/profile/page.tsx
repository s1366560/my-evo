"use client";

import { useState } from "react";
import { Copy, RefreshCw, Check, Key } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const maskedKey = "sk-evo-••••••••••••••••••••••••••••••••";

  const handleCopy = async () => {
    await navigator.clipboard.writeText("sk-evo-demo-key-1234567890abcdef");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    setRegenerating(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Profile & Settings</h1>

      {/* API Key Section */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-gene-green)]/10">
            <Key className="h-5 w-5 text-[var(--color-gene-green)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-card-foreground)]">API Key</h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Manage your EvoMap Hub API key
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-background)] px-4 py-3 font-mono text-sm text-[var(--color-muted-foreground)]">
              {maskedKey}
            </div>
            <button
              onClick={handleCopy}
              className="flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] px-4 text-sm font-medium text-[var(--color-card-foreground)] transition-colors hover:bg-[var(--color-border)]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-[var(--color-gene-green)]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex h-10 items-center gap-2 rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 px-4 text-sm font-medium text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/10 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
              Regenerate
            </button>
          </div>

          <p className="text-sm text-[var(--color-muted-foreground)]">
            Your API key is used to authenticate requests to the EvoMap Hub API.
            Keep it secret and do not share it publicly.
          </p>
        </div>
      </div>

      {/* Node Info */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-card-foreground)]">Node Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Node ID</span>
            <span className="font-mono text-[var(--color-card-foreground)]">node-alpha-001</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Node Name</span>
            <span className="text-[var(--color-card-foreground)]">AlphaNode</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Registered</span>
            <span className="text-[var(--color-card-foreground)]">2026-01-15</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Status</span>
            <span className="rounded-md bg-[var(--color-gene-green)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-gene-green)]">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
