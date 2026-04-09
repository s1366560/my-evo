"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { apiClient } from "@/lib/api/client";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiClient.login({ email, password });
      login(data.token, data.user.id);

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Welcome back</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Sign in to your EvoMap account
        </p>
      </div>

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
              placeholder="••••••••"
              disabled={isLoading}
              className={cn(
                "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-background)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
                "disabled:opacity-50",
              )}
            />
          </div>
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
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </div>
  );
}
