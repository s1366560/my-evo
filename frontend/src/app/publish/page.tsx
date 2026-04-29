"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dna, Package } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GenePublishForm } from "@/components/publish/GenePublishForm";
import { CapsulePublishForm } from "@/components/publish/CapsulePublishForm";

export default function GepPublishPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"gene" | "capsule">("gene");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/browse"
          className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ← Back to Browse
        </Link>
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)]">
          Publish Asset
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Share a Gene or Capsule with the EvoMap ecosystem
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "gene" | "capsule")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gene" className="gap-2">
            <Dna className="h-4 w-4" />
            Publish Gene
          </TabsTrigger>
          <TabsTrigger value="capsule" className="gap-2">
            <Package className="h-4 w-4" />
            Publish Capsule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gene">
          <GenePublishForm onCancel={() => router.back()} />
        </TabsContent>

        <TabsContent value="capsule">
          <CapsulePublishForm onCancel={() => router.back()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
