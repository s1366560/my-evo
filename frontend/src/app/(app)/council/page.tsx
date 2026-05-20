"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Scale, Users, FileText, Vote, Shield } from "lucide-react";

interface CouncilMember {
  id: string;
  name: string;
  role: string;
  votes: number;
  status: string;
}

function CouncilSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    </div>
  );
}

export default function CouncilPage() {
  const [members, setMembers] = useState<CouncilMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    fetch(`${apiUrl}/api/v2/council/members`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setMembers(data.data);
        } else {
          setMembers([]);
        }
      })
      .catch(() => {
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const roles = [
    { icon: <Shield className="h-5 w-5 text-[var(--color-gene-green)]" />, label: "Governance", count: members.filter(m => m.role === "governance").length },
    { icon: <Vote className="h-5 w-5 text-[var(--color-gene-green)]" />, label: "Voting", count: members.filter(m => m.role === "voting").length },
    { icon: <FileText className="h-5 w-5 text-[var(--color-gene-green)]" />, label: "Policy", count: members.filter(m => m.role === "policy").length },
    { icon: <Users className="h-5 w-5 text-[var(--color-gene-green)]" />, label: "Members", count: members.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Council</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          AI governance council and decision-making process
        </p>
      </div>

      {loading ? (
        <CouncilSkeleton />
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {roles.map((role) => (
              <Card key={role.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  {role.icon}
                  <span className="text-2xl font-bold">{role.count}</span>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--color-muted-foreground)]">{role.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Council Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Council Members
              </CardTitle>
              <CardDescription>
                Active members of the governance council
              </CardDescription>
            </CardHeader>
            <CardContent>
              {members.length > 0 ? (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-gene-green)]/10 text-sm font-semibold text-[var(--color-gene-green)]">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-[var(--color-muted-foreground)] capitalize">{member.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{member.votes} votes</Badge>
                        <Badge variant="outline" className="capitalize">{member.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {["Alpha Arbiter", "Beta Chancellor", "Gamma Scribe"].map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-gene-green)]/10 text-sm font-semibold text-[var(--color-gene-green)]">
                          {name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-[var(--color-muted-foreground)]">governance</p>
                        </div>
                      </div>
                      <Badge variant="outline">Stub</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Governance Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Governance Process</CardTitle>
              <CardDescription>
                How the council makes decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Proposal Submission</Badge>
                <Badge variant="outline">Community Review</Badge>
                <Badge variant="outline">Council Vote</Badge>
                <Badge variant="outline">Implementation</Badge>
                <Badge variant="outline" className="text-[var(--color-muted-foreground)]">
                  Under development
                </Badge>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
