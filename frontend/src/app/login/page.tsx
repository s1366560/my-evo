"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";
import { appendRedirectQuery } from "@/lib/auth/redirects";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const signUpHref = appendRedirectQuery("/register", searchParams.get("redirect"));

  return (
    <>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
        Don&apos;t have an account?{" "}
        <Link
          href={signUpHref}
          className="font-medium text-[var(--color-gene-green)] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="w-full max-w-sm animate-pulse">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-2 h-7 w-36 rounded bg-[var(--color-muted-foreground)]/20" />
        <div className="mx-auto h-4 w-52 rounded bg-[var(--color-muted-foreground)]/10" />
      </div>
      <div className="space-y-4">
        <div className="h-10 rounded-lg bg-[var(--color-muted-foreground)]/10" />
        <div className="h-10 rounded-lg bg-[var(--color-muted-foreground)]/10" />
        <div className="h-10 rounded-lg bg-[var(--color-muted-foreground)]/10" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<LoginPageSkeleton />}>
        <LoginPageContent />
      </Suspense>
    </AuthLayout>
  );
}
