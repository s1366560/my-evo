"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      });
      if (res.ok) {
        router.push("/login?registered=true");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Registration failed. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-[var(--color-foreground)]">Username</label>
        <Input id="username" placeholder="your_handle" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-[var(--color-foreground)]">Email</label>
        <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-[var(--color-foreground)]">Password</label>
        <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-[var(--color-foreground)]">Confirm Password</label>
        <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Create account"}
      </Button>
      <p className="text-center text-sm text-[var(--color-foreground-soft)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--color-gene-green)] hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
