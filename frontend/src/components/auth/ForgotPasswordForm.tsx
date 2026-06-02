"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      // Endpoint is 202 in success paths (and also when email is unknown)
      if (res.status === 202 && data.success) {
        setSubmitted(true);
        // In non-production, the API surfaces the reset token for E2E usage
        if (data.data?.resetToken) {
          setDevResetToken(data.data.resetToken);
        }
      } else {
        setError(data.error?.message || "Unable to process request. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400"
        >
          If an account exists for <span className="font-semibold">{email}</span>, a reset link has been sent.
        </div>
        {devResetToken && (
          <div
            data-testid="dev-reset-token"
            className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs text-amber-300"
          >
            <p className="mb-1 font-semibold uppercase tracking-wide">Dev-only reset token</p>
            <p className="break-all font-mono">{devResetToken}</p>
            <p className="mt-2">
              <Link
                href={`/reset-password?token=${encodeURIComponent(devResetToken)}`}
                className="text-[var(--color-gene-green)] hover:underline"
              >
                Continue to reset
              </Link>
            </p>
          </div>
        )}
        <p className="text-center text-sm text-[var(--color-foreground-soft)]">
          <Link href="/login" className="text-[var(--color-gene-green)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-[var(--color-foreground)]">
          Email
        </label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-[var(--color-foreground-soft)]">
        Remembered it?{" "}
        <Link href="/login" className="text-[var(--color-gene-green)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
