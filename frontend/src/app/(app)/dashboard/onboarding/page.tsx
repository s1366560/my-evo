"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * /dashboard/onboarding — shows onboarding status and redirects appropriately.
 *
 * This page lives inside the (app) route group so it renders inside the
 * authenticated dashboard shell (SideNav, etc.) before redirecting.
 * - If user has not completed onboarding: redirect to /onboarding
 * - If user has completed onboarding: redirect to /dashboard
 */
export default function DashboardOnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check localStorage for onboarding completion status
    const checkOnboardingStatus = async () => {
      try {
        // Check if user has completed onboarding in localStorage
        const onboardingComplete = localStorage.getItem("onboarding_complete");
        const authStorage = localStorage.getItem("auth-storage");

        if (!authStorage) {
          // Not authenticated, redirect to root
          router.replace("/");
          return;
        }

        if (onboardingComplete === "true") {
          // Onboarding complete, redirect to main dashboard
          router.replace("/dashboard");
        } else {
          // Onboarding not complete, redirect to onboarding flow
          router.replace("/onboarding");
        }
      } catch {
        // On error, redirect to onboarding
        router.replace("/onboarding");
      } finally {
        setChecking(false);
      }
    };

    checkOnboardingStatus();
  }, [router]);

  if (checking) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Fallback - should not render
  return null;
}
