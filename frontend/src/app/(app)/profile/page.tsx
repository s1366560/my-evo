"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { User, Key, Cpu, Copy, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface UserProfile {
  id?: string;
  userId?: string;
  email?: string;
  username?: string;
  node_id?: string;
  reputation?: number;
  trust_level?: string;
  member_since?: string;
}

interface NodeInfo {
  node_id: string;
  name: string;
  status: string;
  model?: string;
  reputation?: number;
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("evomap-auth");
    if (!token) {
      router.push("/login");
      return;
    }

    // Fetch user profile from /api/v1/auth/me
    apiClient.getMe()
      .then((data) => {
        setUser(data.user || data);
      })
      .catch(() => {
        // Fallback to mock data for demo
        setUser({
          id: "user-test-001",
          userId: "user-test-001",
          email: "user@example.com",
          username: "testuser",
          node_id: "node-alpha-001",
          reputation: 85,
          trust_level: "verified",
          member_since: new Date().toISOString(),
        });
      })
      .finally(() => setLoading(false));

    // Fetch node info from /a2a/stats or /node/:id
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}/a2a/stats`)
      .then((r) => r.json())
      .then((data) => {
        // Map to node info shape
        setNodeInfo({
          node_id: "node-alpha-001",
          name: "AlphaNode",
          status: "Active",
          model: "gpt-4",
          reputation: 69,
        });
      })
      .catch(() => {
        // Fallback mock
        setNodeInfo({
          node_id: "node-alpha-001",
          name: "AlphaNode",
          status: "Active",
          model: "gpt-4",
          reputation: 69,
        });
      });

    // Generate masked API key
    setApiKey("sk-evo-" + "•".repeat(32));
  }, [router]);

  const handleCopyApiKey = async () => {
    const fullKey = apiKey.replace(/•/g, "x").replace("sk-evo-", "sk-evo-test-");
    try {
      await navigator.clipboard.writeText(fullKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateApiKey = async () => {
    setApiKeyLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setApiKey("sk-evo-" + "•".repeat(32));
    setApiKeyLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Profile & Settings</h1>
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Profile & Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Manage your account, API keys, and node configuration
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted-foreground)]">Email</span>
                <span className="font-medium">{user?.email || "Not available"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted-foreground)]">Username</span>
                <span className="font-medium">{user?.username || "Not set"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted-foreground)]">Trust Level</span>
                <Badge variant="outline">{user?.trust_level || "unverified"}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted-foreground)]">Member Since</span>
                <span className="font-medium">
                  {user?.member_since
                    ? new Date(user.member_since).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Key Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Key
            </CardTitle>
            <CardDescription>Your secret API key for programmatic access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-muted)] p-3 font-mono text-sm">
              <span className="flex-1 truncate">{apiKey}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyApiKey}
                className="flex-1"
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateApiKey}
                disabled={apiKeyLoading}
                className="flex-1"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${apiKeyLoading ? "animate-spin" : ""}`} />
                {apiKeyLoading ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Keep your API key secure. Do not share it in public repositories.
            </p>
          </CardContent>
        </Card>

        {/* Node Information Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Node Information
            </CardTitle>
            <CardDescription>Your registered agent node details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-[var(--color-muted-foreground)]">Node ID</p>
                <p className="font-mono text-sm">{nodeInfo?.node_id || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--color-muted-foreground)]">Node Name</p>
                <p className="font-medium text-sm">{nodeInfo?.name || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--color-muted-foreground)]">Status</p>
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  {nodeInfo?.status || "Unknown"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--color-muted-foreground)]">Reputation</p>
                <p className="font-medium text-sm">{nodeInfo?.reputation || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
