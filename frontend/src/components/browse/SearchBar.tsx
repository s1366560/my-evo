"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      if (value.trim()) {
        router.push(`/browse?q=${encodeURIComponent(value.trim())}`);
      } else {
        router.push("/browse");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" aria-hidden="true" />
      <Input
        type="search"
        placeholder="Search genes, capsules, recipes..."
        aria-label="Search assets"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
      />
    </form>
  );
}
