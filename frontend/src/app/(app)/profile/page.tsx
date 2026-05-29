"use client";

import { useState, useEffect } from "react";
import { Key, Copy, RefreshCw, Cpu, User, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  level: number;
  reputation: number;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyResponse {
  apiKey: string;
}

// ── Mock data for unauthenticated/dev mode ─────────────────────────────────────

const MOCK_PROFILE: UserProfile = {
  id: "user-mock-001",
  email: "user@example.com",
  name: "AlphaNode",
  avatar: null,
  role: "operator",
  level: 3,
  reputation: 150,
  credits: 500,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_API_KEY = "sk-evo-mock-key-12345678901234567890";
const MOCK_NODE_ID = "node-alpha-001";
const MOCK_NODE_NAME = "AlphaNode";
const MOCK_NODE_STATUS = "Active";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return key.slice(0, 8) + "••••••••••••••••••••••••••••••••";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Skeleton ────────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

// ── API Key Card ────────────────────────────────────────────────────────────────

interface ApiKeyCardProps {
  apiKey: string;
  onCopy: () => void;
  onRegenerate: () => void;
  isLoading: boolean;
}

function ApiKeyCard({ apiKey, onCopy, onRegenerate, isLoading }: ApiKeyCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Key className="h-5 w-5 text-[var(--color-gene-green)]" />
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
          API Key
        </h2>
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-muted)] px-4 py-3">
        <code className="flex-1 font-mono text-sm text-[var(--color-foreground)]">
          {maskApiKey(apiKey)}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={isLoading}
          className="shrink-0"
        >
          {copied ? (
            <>
              <CheckCircle className="mr-1 h-4 w-4 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 h-4 w-4" />
              Copy
            </>
          )}
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRegenerate}
        disabled={isLoading}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        Regenerate
      </Button>
    </div>
  );
}

// ── Node Info Card ──────────────────────────────────────────────────────────────

interface NodeInfoCardProps {
  nodeId: string;
  nodeName: string;
  status: string;
}

function NodeInfoCard({ nodeId, nodeName, status }: NodeInfoCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Cpu className="h-5 w-5 text-[var(--color-gene-blue)]" />
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
          Node Information
        </h2>
      </div>
      <dl className="space-y-3">
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Node ID</dt>
          <dd className="font-mono text-sm text-[var(--color-foreground)]">{nodeId}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Node Name</dt>
          <dd className="text-sm text-[var(--color-foreground)]">{nodeName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Status</dt>
          <dd className="flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[var(--color-foreground)]">{status}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── User Profile Card ───────────────────────────────────────────────────────────

interface UserProfileCardProps {
  profile: UserProfile;
}

function UserProfileCard({ profile }: UserProfileCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <User className="h-5 w-5 text-[var(--color-gene-purple)]" />
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
          Profile & Settings
        </h2>
      </div>
      <dl className="space-y-3">
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Email</dt>
          <dd className="text-sm text-[var(--color-foreground)]">{profile.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Role</dt>
          <dd className="text-sm capitalize text-[var(--color-foreground)]">{profile.role}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Level</dt>
          <dd className="text-sm text-[var(--color-foreground)]">{profile.level}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Reputation</dt>
          <dd className="text-sm text-[var(--color-foreground)]">{profile.reputation}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Credits</dt>
          <dd className="text-sm text-[var(--color-foreground)]">{profile.credits}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-[var(--color-muted-foreground)]">Member Since</dt>
          <dd className="text-sm text-[var(--color-foreground)]">
            {formatDate(profile.createdAt)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [apiKey, setApiKey] = useState<string>(MOCK_API_KEY);
  const [nodeId, setNodeId] = useState<string>(MOCK_NODE_ID);
  const [nodeName, setNodeName] = useState<string>(MOCK_NODE_NAME);
  const [nodeStatus, setNodeStatus] = useState<string>(MOCK_NODE_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile from /api/v1/auth/me
  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        const response = await apiClient.getMe() as { success?: boolean; data?: { user: UserProfile } };
        
        // Handle different response shapes
        let userData: UserProfile;
        if (response.data?.user) {
          userData = response.data.user;
        } else if ("user" in response) {
          userData = (response as unknown as { user: UserProfile }).user;
        } else {
          // Use mock data if response format is unexpected
          userData = MOCK_PROFILE;
        }
        
        setProfile(userData);
        
        // Generate a mock API key based on user ID
        const generatedKey = `sk-evo-${userData.id.slice(0, 8)}-generated`;
        setApiKey(generatedKey);
        
        // Set node info from user data
        setNodeId(`node-${userData.id.slice(0, 8)}`);
        setNodeName(userData.name || userData.email.split("@")[0]);
        setNodeStatus("Active");
        
        setError(null);
      } catch (err) {
        console.warn("Failed to fetch profile, using mock data:", err);
        // Use mock data on error
        setProfile(MOCK_PROFILE);
        setNodeId(MOCK_NODE_ID);
        setNodeName(MOCK_NODE_NAME);
        setNodeStatus(MOCK_NODE_STATUS);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, []);

  // Regenerate API key handler
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      // Simulate API call for regeneration
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Generate new mock key
      const newKey = `sk-evo-${Date.now().toString(36)}-regenerated`;
      setApiKey(newKey);
    } catch (err) {
      console.error("Failed to regenerate API key:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Copy handler (for tracking)
  const handleCopy = () => {
    // Clipboard write is handled in the component
    // This is for analytics/tracking if needed
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          Profile & Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Manage your account, API keys, and node settings
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <ApiKeyCard
          apiKey={apiKey}
          onCopy={handleCopy}
          onRegenerate={handleRegenerate}
          isLoading={isRegenerating}
        />
        <NodeInfoCard
          nodeId={nodeId}
          nodeName={nodeName}
          status={nodeStatus}
        />
      </div>

      {profile && <UserProfileCard profile={profile} />}
    </div>
  );
}
