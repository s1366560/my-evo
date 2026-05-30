"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/stores/auth-store";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Open", variant: "default" },
  claimed: { label: "In Progress", variant: "secondary" },
  submitted: { label: "Submitted", variant: "secondary" },
  accepted: { label: "Completed", variant: "default" },
  disputed: { label: "Disputed", variant: "destructive" },
  resolved: { label: "Resolved", variant: "secondary" },
  expired: { label: "Expired", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatReward(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

interface BountyDetailProps {
  bountyId: string;
}

export function BountyDetail({ bountyId }: BountyDetailProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated, userId } = useAuthStore();
  const [activeTab, setActiveTab] = useState("details");

  // Fetch bounty details
  const { data: bountyResult, isLoading: isLoadingBounty, isError } = useQuery({
    queryKey: ["bounty", bountyId],
    queryFn: () => apiClient.getBountyById(bountyId).then(r => r.bounty),
  });

  const bounty = bountyResult;

  // Bid form state
  const [bidAmount, setBidAmount] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [approach, setApproach] = useState("");

  // Submit bid mutation
  const submitBidMutation = useMutation({
    mutationFn: () => apiClient.placeBid(bountyId, {
      proposedAmount: parseFloat(bidAmount),
      estimatedTime,
      approach,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bounty", bountyId] });
      setBidAmount("");
      setEstimatedTime("");
      setApproach("");
    },
  });

  // Submit deliverable mutation
  const [deliverableContent, setDeliverableContent] = useState("");
  const submitDeliverableMutation = useMutation({
    mutationFn: () => apiClient.submitBounty(bountyId, {
      content: deliverableContent,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bounty", bountyId] });
      setDeliverableContent("");
    },
  });

  if (isLoadingBounty) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-2/3 animate-pulse rounded bg-[var(--color-surface-muted)]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--color-surface-muted)]" />
        <div className="h-40 animate-pulse rounded bg-[var(--color-surface-muted)]" />
      </div>
    );
  }

  if (isError || !bounty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">Bounty not found</p>
        <Button variant="outline" className="mt-4" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const status = statusConfig[bounty.status] || statusConfig.open;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-sm text-[var(--color-muted-foreground)]">
              Deadline: {formatDate(bounty.deadline)}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-foreground)]">{bounty.title}</h1>
          {bounty.creator_name && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Posted by {bounty.creator_name}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-[var(--color-gene-green)]">
            {formatReward(bounty.amount)}
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">Reward</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="bid">Place Bid</TabsTrigger>
          {bounty.status === "claimed" && (
            <TabsTrigger value="submit">Submit Work</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-[var(--color-foreground)]">
                {bounty.description}
              </p>
            </CardContent>
          </Card>

          {/* Requirements */}
          {bounty.requirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-2">
                  {bounty.requirements.map((req, i) => (
                    <li key={i} className="text-[var(--color-foreground)]">
                      {req}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Milestones */}
          {bounty.milestones && bounty.milestones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bounty.milestones.map((milestone, i) => (
                    <div key={milestone.milestone_id} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-gene-green)] text-xs font-bold text-white">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[var(--color-foreground)]">
                          {milestone.title}
                        </p>
                        <p className="text-sm text-[var(--color-muted-foreground)]">
                          {milestone.description}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                          {milestone.percentage}% of reward
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status info */}
          {bounty.claimed_by_name && (
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--color-foreground)]">
                  This bounty is being worked on by <strong>{bounty.claimed_by_name}</strong>
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bid" className="mt-4">
          {!isAuthenticated ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-[var(--color-muted-foreground)]">
                  Please log in to place a bid on this bounty.
                </p>
                <Button className="mt-4" onClick={() => window.location.href = "/login"}>
                  Log In
                </Button>
              </CardContent>
            </Card>
          ) : bounty.status !== "open" ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-[var(--color-muted-foreground)]">
                  This bounty is no longer accepting bids.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Place Your Bid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                    Your Bid Amount ($)
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter your bid amount"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={1}
                    max={bounty.amount}
                  />
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Budget range: $1 - ${bounty.amount}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                    Estimated Time
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., 3 days, 1 week"
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                    Your Approach
                  </label>
                  <Textarea
                    placeholder="Describe how you plan to solve this bounty..."
                    value={approach}
                    onChange={(e) => setApproach(e.target.value)}
                    rows={5}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={!bidAmount || !estimatedTime || !approach || submitBidMutation.isPending}
                  onClick={() => submitBidMutation.mutate()}
                >
                  {submitBidMutation.isPending ? "Submitting..." : "Submit Bid"}
                </Button>

                {submitBidMutation.isError && (
                  <p className="text-sm text-[var(--color-destructive)]">
                    Failed to submit bid. Please try again.
                  </p>
                )}

                {submitBidMutation.isSuccess && (
                  <p className="text-sm text-[var(--color-gene-green)]">
                    Bid submitted successfully!
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="submit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Submit Your Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
                  Deliverable
                </label>
                <Textarea
                  placeholder="Describe your completed work, include links to code, documentation, etc..."
                  value={deliverableContent}
                  onChange={(e) => setDeliverableContent(e.target.value)}
                  rows={8}
                />
              </div>

              <Button
                className="w-full"
                disabled={!deliverableContent || submitDeliverableMutation.isPending}
                onClick={() => submitDeliverableMutation.mutate()}
              >
                {submitDeliverableMutation.isPending ? "Submitting..." : "Submit Deliverable"}
              </Button>

              {submitDeliverableMutation.isError && (
                <p className="text-sm text-[var(--color-destructive)]">
                  Failed to submit. Please try again.
                </p>
              )}

              {submitDeliverableMutation.isSuccess && (
                <p className="text-sm text-[var(--color-gene-green)]">
                  Deliverable submitted successfully!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
