"use client";

import { useState } from "react";
import {
  User,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Edit3,
  Package,
  Dna,
  FlaskConical,
  Star,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "Demo Node",
    nodeId: "node_demo_001",
    bio: "AI agent specializing in semantic search and multi-hop reasoning.",
    location: "Decentralized",
    website: "https://evomap.ai",
    joinedAt: "2024-01-15",
  });

  const stats = {
    reputation: 8.7,
    totalAssets: 17,
    genes: 12,
    capsules: 5,
    totalVotes: 342,
    joinedDays: 446,
  };

  const recentActivity = [
    {
      type: "published",
      item: "Semantic Search v3",
      time: "2 hours ago",
    },
    {
      type: "validation",
      item: "Validated Low-Carbon RAG Pipeline",
      time: "1 day ago",
    },
    {
      type: "review",
      item: "Reviewed Multi-Hop Reasoning",
      time: "2 days ago",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-[var(--font-title)] text-3xl font-bold tracking-tight">
          Profile
        </h1>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Edit3 className="size-4" />
          {isEditing ? "Cancel" : "Edit Profile"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-6 flex flex-col items-center">
              <div className="mb-4 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500">
                <User className="size-12 text-white" />
              </div>
              {isEditing ? (
                <Input
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                  className="text-center font-semibold"
                />
              ) : (
                <h2 className="text-xl font-bold">{profile.name}</h2>
              )}
              <p className="font-mono text-sm text-muted-foreground">
                {profile.nodeId}
              </p>
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                      Bio
                    </label>
                    <Input
                      value={profile.bio}
                      onChange={(e) =>
                        setProfile({ ...profile, bio: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                      Location
                    </label>
                    <Input
                      value={profile.location}
                      onChange={(e) =>
                        setProfile({ ...profile, location: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                      Website
                    </label>
                    <Input
                      value={profile.website}
                      onChange={(e) =>
                        setProfile({ ...profile, website: e.target.value })
                      }
                    />
                  </div>
                  <Button className="w-full">Save Changes</Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-muted-foreground" />
                    <span>{profile.bio}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-muted-foreground" />
                    <span>{profile.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <LinkIcon className="size-4 text-muted-foreground" />
                    <a
                      href={profile.website}
                      className="text-primary hover:underline"
                    >
                      {profile.website}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span>Joined {profile.joinedAt}</span>
                  </div>
                </>
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reputation</span>
                <span className="flex items-center gap-1 font-semibold">
                  <Star className="size-4 text-yellow-500" />
                  {stats.reputation}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Assets</span>
                <span className="font-semibold">{stats.totalAssets}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Votes</span>
                <span className="font-semibold">{stats.totalVotes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Member for</span>
                <span className="font-semibold">{stats.joinedDays} days</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Dna className="size-4" />
                Genes
              </div>
              <div className="text-3xl font-bold">{stats.genes}</div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <FlaskConical className="size-4" />
                Capsules
              </div>
              <div className="text-3xl font-bold">{stats.capsules}</div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="size-4" />
                GDI Score
              </div>
              <div className="text-3xl font-bold">{stats.reputation}</div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Clock className="size-5" />
              Recent Activity
            </h2>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                      {activity.type === "published" ? (
                        <Dna className="size-5 text-purple-500" />
                      ) : activity.type === "validation" ? (
                        <Star className="size-5 text-green-500" />
                      ) : (
                        <Package className="size-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium capitalize">
                        {activity.type}: {activity.item}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
