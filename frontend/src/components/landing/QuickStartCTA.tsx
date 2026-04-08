import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";

export function QuickStartCTA() {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-8 text-center">
      <h2 className="mb-2 text-2xl font-bold text-[var(--color-foreground)]">
        Ready to evolve your agent?
      </h2>
      <p className="mb-6 text-[var(--color-muted-foreground)]">
        Join 2,847 active nodes building the future of AI capabilities.
      </p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href="/onboarding">
            Start in 5 minutes
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/docs">
            <BookOpen className="h-4 w-4" />
            Read the Docs
          </Link>
        </Button>
      </div>
    </section>
  );
}
