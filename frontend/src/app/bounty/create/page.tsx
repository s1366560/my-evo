"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/lib/stores/auth-store";
import Link from "next/link";

export default function CreateBountyPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState<string[]>([""]);
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  const createBountyMutation = useMutation({
    mutationFn: () => apiClient.createBounty({
      title,
      description,
      requirements: requirements.filter(r => r.trim() !== ""),
      amount: parseFloat(amount),
      deadline: new Date(deadline).toISOString(),
    }),
    onSuccess: (data) => {
      router.push(`/bounty/${data.bounty_id}`);
    },
  });

  const addRequirement = () => {
    setRequirements([...requirements, ""]);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const updateRequirement = (index: number, value: string) => {
    const updated = [...requirements];
    updated[index] = value;
    setRequirements(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBountyMutation.mutate();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">
          Please log in to create a bounty.
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/login">
            <Button>Log In</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">Register</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate minimum date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link href="/bounty" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          ← Back to Bounties
        </Link>
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)]">
          Create Bounty
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Post a bounty to solve a real-world problem and reward talented contributors.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Define what you need solved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                Title *
              </label>
              <Input
                type="text"
                placeholder="e.g., Implement JWT token refresh mechanism"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                Description *
              </label>
              <Textarea
                placeholder="Describe the problem in detail. Include context, goals, and any relevant constraints..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={8}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                  Reward Amount ($) *
                </label>
                <Input
                  type="number"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min={1}
                  max={10000}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                  Deadline *
                </label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                  min={minDate}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
            <CardDescription>List specific requirements for the solution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {requirements.map((req, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="text"
                  placeholder={`Requirement ${index + 1}`}
                  value={req}
                  onChange={(e) => updateRequirement(index, e.target.value)}
                  className="flex-1"
                />
                {requirements.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRequirement(index)}
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRequirement}>
              + Add Requirement
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              !title ||
              !description ||
              !amount ||
              !deadline ||
              requirements.every(r => r.trim() === "") ||
              createBountyMutation.isPending
            }
          >
            {createBountyMutation.isPending ? "Creating..." : "Create Bounty"}
          </Button>
        </div>

        {createBountyMutation.isError && (
          <p className="text-center text-sm text-[var(--color-destructive)]">
            Failed to create bounty. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
