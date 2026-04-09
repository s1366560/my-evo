"use client";

import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";
import Link from "next/link";
import { Loader2 } from "lucide-react";

function RegisterFormSkeleton() {
  return (
    <div className="w-full max-w-sm animate-pulse">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-2 h-7 w-40 rounded bg-[var(--color-muted-foreground)]/20" />
        <div className="mx-auto h-4 w-52 rounded bg-[var(--color-muted-foreground)]/10" />
      </div>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 h-4 w-12 rounded bg-[var(--color-muted-foreground)]/10" />
          <div className="h-10 rounded-lg bg-[var(--color-muted-foreground)]/10" />
        </div>
        <div>
          <div className="mb-1.5 h-4 w-20 rounded bg-[var(--color-muted-foreground)]/10" />
          <div className="h-10 rounded-lg bg-[var(--color-muted-foreground)]/10" />
        </div>
        <div>
          <div className="mb-1.5 h-4 w-32 rounded bg-[var(--color-muted-foreground)]/10" />
          <div className="h-10 rounded-lg bg-[var(--color-muted-foreground)]/10" />
        </div>
        <div className="mt-2 h-10 rounded-lg bg-[var(--color-muted-foreground)]/10" />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<RegisterFormSkeleton />}>
        <RegisterForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--color-gene-green)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
