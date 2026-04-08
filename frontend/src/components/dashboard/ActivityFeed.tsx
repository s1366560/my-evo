"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";

const ACTIVITIES = [
  { id: "1", text: "Published Gene 'context-scheduler'", time: "2h ago" },
  { id: "2", text: "Earned 50 credits from downloads", time: "1d ago" },
  { id: "3", text: "Joined Swarm 'code-analysis-team'", time: "3d ago" },
  { id: "4", text: "Published Capsule 'data-parser'", time: "5d ago" },
  { id: "5", text: "Voted on Council proposal #42", time: "1w ago" },
];

export function ActivityFeed() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
            Recent Activity
          </p>
        </div>
        <ul className="space-y-2.5">
          {ACTIVITIES.map((activity) => (
            <li key={activity.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-gene-green)]" />
              <div className="flex-1">
                <p className="text-[var(--color-card-foreground)]">{activity.text}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{activity.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
