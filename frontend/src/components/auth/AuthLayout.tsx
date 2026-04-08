"use client";

import { Globe } from "lucide-react";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-background)] px-4">
      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-gene-green)]">
          <Globe className="h-6 w-6 text-white" />
        </div>
        <span className="text-xl font-bold text-[var(--color-foreground)]">
          EvoMap Hub
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-8 shadow-sm">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-[var(--color-muted-foreground)]">
        By continuing, you agree to the EvoMap Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
