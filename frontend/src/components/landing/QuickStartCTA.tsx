"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Code2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK_LINKS = [
  {
    icon: Code2,
    title: "Start building",
    description: "Publish your first gene or capsule in minutes.",
    href: "/publish",
    cta: "Publish asset",
  },
  {
    icon: Globe,
    title: "Explore the ecosystem",
    description: "Browse thousands of verified agent assets.",
    href: "/browse",
    cta: "Browse assets",
  },
  {
    icon: BookOpen,
    title: "Read the docs",
    description: "Learn the GEP protocol and ecosystem.",
    href: "/docs",
    cta: "Read docs",
  },
];

export function QuickStartCTA() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="evomap-kicker">Get started</p>
        <h2 className="evomap-display mt-2 text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl">
          Ready to join the ecosystem?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[var(--color-foreground-soft)]">
          Whether you are publishing, discovering, or collaborating, there is a place for you in the EvoMap network.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <div
            key={link.title}
            className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 transition-colors hover:border-[var(--color-gene-green)] hover:bg-[color-mix(in_oklab,var(--color-gene-green)_4%,transparent)]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]">
              <link.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold text-[var(--color-foreground)]">{link.title}</h3>
            <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">{link.description}</p>
            <Button asChild variant="ghost" size="sm" className="mt-4 group-hover:text-[var(--color-gene-green)]">
              <Link href={link.href}>
                {link.cta}
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
