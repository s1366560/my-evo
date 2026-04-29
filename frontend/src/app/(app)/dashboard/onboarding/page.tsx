"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /dashboard/onboarding — redirect to /onboarding for new users.
 *
 * This page lives inside the (app) route group so it renders inside the
 * authenticated dashboard shell (SideNav, etc.) before the redirect fires.
 * Once the user has completed onboarding they will be routed away from here.
 */
export default function DashboardOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding");
  }, [router]);

  return null;
}
