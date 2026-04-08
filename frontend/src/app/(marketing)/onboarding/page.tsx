import { Suspense } from "react";
import OnboardingContent from "./OnboardingContent";
import { Skeleton } from "@/components/ui/skeleton";

function OnboardingSkeleton() {
  return (
    <div className="min-h-screen py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
        <div className="space-y-2 text-center">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-5 w-48 mx-auto" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
