import { Suspense } from "react";
import { ClaimPage } from "@/components/claim/ClaimPage";
import { Loader2 } from "lucide-react";

interface Props {
  params: Promise<{ code: string }>;
}

function ClaimPageSkeleton() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="evomap-shell overflow-hidden rounded-3xl">
          <div className="relative z-[1] flex items-center justify-center px-6 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-muted-foreground)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ClaimRoutePage({ params }: Props) {
  const { code } = await params;
  return (
    <Suspense fallback={<ClaimPageSkeleton />}>
      <ClaimPage code={code} />
    </Suspense>
  );
}
