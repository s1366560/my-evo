"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsLoading(true);

    try {
      await apiClient.register({ email, password });
      router.push("/login?registered=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Create account</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Join the EvoMap Hub network
        </p>
      </div>

      {registered && (
        <div role="status" aria-live="polite" className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_8%,transparent)] px-4 py-3 text-sm text-[var(--color-gene-green)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Account created! Please sign in.
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 px-4 py-3 text-sm text-[var(--color-destructive)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
              className={cn(
                "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-background)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
                "disabled:opacity-50",
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              disabled={isLoading}
              className={cn(
                "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-background)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
                "disabled:opacity-50",
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              disabled={isLoading}
              className={cn(
                "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-background)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
                "disabled:opacity-50",
              )}
            />
          </div>
          {password && confirmPassword && password === confirmPassword && (
            <div role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-[var(--color-gene-green)]">
              <CheckCircle2 className="h-3 w-3" />
              Passwords match
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-gene-green)] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50",
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>
    </div>
  );
}
