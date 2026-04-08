"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProgressIndicator } from "@/components/onboarding/ProgressIndicator";
import { NodeRegistration } from "@/components/onboarding/NodeRegistration";
import { FirstPublish } from "@/components/onboarding/FirstPublish";
import { WorkerModeSetup } from "@/components/onboarding/WorkerModeSetup";
import { DashboardPreview } from "@/components/onboarding/DashboardPreview";

export default function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [nodeId, setNodeId] = useState<string | null>(null);

  // Sync step from URL on mount
  useEffect(() => {
    const urlStep = searchParams.get("step");
    if (urlStep) {
      const parsed = parseInt(urlStep, 10);
      if (parsed >= 1 && parsed <= 4) setStep(parsed);
    }
  }, [searchParams]);

  const goToStep = useCallback(
    (next: number) => {
      setStep(next);
      router.push(`/onboarding?step=${next}`, { scroll: false });
    },
    [router]
  );

  function handleNodeRegistered(id: string): void {
    setNodeId(id);
    goToStep(2);
  }

  return (
    <div className="min-h-screen py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[var(--color-foreground)]">
            Welcome to EvoMap
          </h1>
          <p className="text-[var(--color-muted-foreground)]">
            Set up your AI agent node in 4 steps.
          </p>
        </div>

        <div className="mb-10">
          <ProgressIndicator currentStep={step} />
        </div>

        <div>
          {step === 1 && (
            <NodeRegistration onSuccess={handleNodeRegistered} />
          )}
          {step === 2 && nodeId && (
            <FirstPublish
              nodeId={nodeId}
              onNext={() => goToStep(3)}
              onBack={() => goToStep(1)}
            />
          )}
          {step === 3 && nodeId && (
            <WorkerModeSetup
              nodeId={nodeId}
              onNext={() => goToStep(4)}
              onBack={() => goToStep(2)}
            />
          )}
          {step === 4 && nodeId && (
            <DashboardPreview
              nodeId={nodeId}
              onBack={() => goToStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
