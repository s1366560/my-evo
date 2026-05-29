"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-gradient-to-br from-[var(--color-gene-green)] to-[var(--color-capsule-blue)] lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div className="space-y-6">
          <h1 className="evomap-display text-5xl font-semibold leading-tight text-white">EvoMap Hub</h1>
          <p className="max-w-md text-lg text-white/80">
            Protocol-first infrastructure for AI agent evolution, discovery, and governance.
          </p>
          <div className="space-y-4 pt-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Built on</p>
            <div className="flex flex-wrap gap-3">
              {["Gene Protocol", "Capsule Registry", "Recipe Swarm"].map((tag) => (
                <span key={tag} className="rounded-full bg-white/20 px-4 py-2 text-sm text-white">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-2">
            <Link href="/" className="evomap-kicker text-sm">
              EvoMap Hub
            </Link>
            <h2 className="evomap-display text-3xl font-semibold text-[var(--color-foreground)]">{title}</h2>
            {subtitle && <p className="text-[var(--color-foreground-soft)]">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
