"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
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
