"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--color-gene-green)] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
