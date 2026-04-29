"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useWorkspaceStore, useGoals, useTasks, useWorkers,
  type WorkspaceTask, type WorkspaceWorker, type PreflightCheck, type TaskStatus, type Goal,
} from "@/lib/stores/workspace-store";
import { useWorkspaceSync } from "@/lib/api/hooks/use-workspace";

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending", assigned: "Assigned", in_progress: "In Progress",
  submitted: "Submitted", completed: "Completed", failed: "Failed", blocked: "Blocked",
};

const WORKER_STATUS_COLORS: Record<string, string> = {
  idle: "bg-muted-foreground", assigned: "bg-blue-500", in_progress: "bg-orange-500",
  submitted: "bg-purple-500", completed: "bg-green-500", failed: "bg-red-500", blocked: "bg-red-700",
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const colorMap: Record<TaskStatus, string> = {
    pending: "bg-muted text-muted-foreground",
    assigned: "bg-blue-500/20 text-blue-400",
    in_progress: "bg-orange-500/20 text-orange-400",
    submitted: "bg-purple-500/20 text-purple-400",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    blocked: "bg-red-700/20 text-red-300",
  };
  return <Badge className={`${colorMap[status]} text-xs`}>{TASK_STATUS_LABELS[status]}</Badge>;
}

function PreflightRow({ check }: { check: PreflightCheck }) {
  const icon = check.status === "passed" ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : check.status === "failed" ? <AlertCircle className="h-4 w-4 text-red-500" />
    : <Clock className="h-4 w-4 text-muted-foreground" />;
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className="flex-1">{check.kind}</span>
      <span className="text-xs text-muted-foreground">{check.status}</span>
    </div>
  );
}

function TaskCard({ task, selected, onClick }: { task: WorkspaceTask; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer transition-all ${
        selected ? "border-[var(--color-border-strong)] bg-[var(--color-surface-muted)]"
                 : "border-[var(--color-border)] bg-[var(--color-card-background)] hover:border-[var(--color-border-strong)]"
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-card-foreground)]">{task.title}</p>
          {task.description && <p className="mt-1 truncate text-xs text-muted-foreground">{task.description}</p>}
        </div>
        <StatusBadge status={task.status} />
      </div>
      {task.progressPct > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${task.progressPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{task.progressPct}% complete</p>
        </div>
      )}
      {task.preflightChecks && task.preflightChecks.length > 0 && (
        <div className="mt-3 space-y-1">
          {task.preflightChecks.slice(0, 2).map(c => <PreflightRow key={c.check_id} check={c} />)}
          {task.preflightChecks.length > 2 && <p className="text-xs text-muted-foreground">+{task.preflightChecks.length - 2} more</p>}
        </div>
      )}
    </div>
  );
}

function WorkerRow({ worker }: { worker: WorkspaceWorker }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-xs font-semibold">
        {worker.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{worker.name}</p>
        <p className="text-xs capitalize text-muted-foreground">{worker.role}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`h-2 w-2 rounded-full ${WORKER_STATUS_COLORS[worker.status]}`} />
        <span className="text-xs capitalize text-muted-foreground">{worker.status.replace("_", " ")}</span>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const workspaceName = useWorkspaceStore((s) => s.workspaceName);
  const selectTask = useWorkspaceStore((s) => s.selectTask);
  const selectedTaskId = useWorkspaceStore((s) => s.selectedTaskId);
  const goals = useGoals();
  const tasks = useTasks();
  const workers = useWorkers();
  const [activeTab, setActiveTab] = useState<"tasks" | "goals" | "workers">("tasks");

  // Sync workspace data from API (MSW) into the Zustand store
  const { isLoading, isError } = useWorkspaceSync();

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const setSelectedTask = (task: WorkspaceTask | null) => selectTask(task?.id ?? null);

  const activeGoals = goals.filter((g) => g.status === "active");
  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "assigned");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "blocked");

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{workspaceName}</h1>
          <p className="mt-1 text-[var(--color-muted-foreground)]">Manage goals, tasks, and team members</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading workspace data...
          </div>
        )}
        {isError && (
          <div className="text-sm text-red-500">Failed to load workspace data</div>
        )}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-muted-foreground">Active Goals</p><p className="mt-1 text-2xl font-bold">{activeGoals.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Pending Tasks</p><p className="mt-1 text-2xl font-bold">{pendingTasks.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">In Progress</p><p className="mt-1 text-2xl font-bold">{inProgressTasks.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Team Members</p><p className="mt-1 text-2xl font-bold">{workers.length}</p></Card>
      </div>

      <div className="mb-6 border-b">
        <div className="flex gap-6">
          {(["tasks", "goals", "workers"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors ${activeTab === tab
                ? "border-b-2 border-[var(--color-primary)]" : "text-muted-foreground"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {activeTab === "tasks" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Tasks</h2>
              {tasks.length === 0 ? <Card className="p-8 text-center"><p className="text-muted-foreground">No tasks yet</p></Card>
                : <div className="space-y-3">{tasks.map((task) => <TaskCard key={task.id} task={task} selected={selectedTask?.id === task.id} onClick={() => setSelectedTask(task)} />)}</div>}
            </div>
          )}
          {activeTab === "goals" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Goals</h2>
              {goals.length === 0 ? <Card className="p-8 text-center"><p className="text-muted-foreground">No goals yet</p></Card>
                : <div className="space-y-3">{goals.map((goal: Goal) => (
                  <Card key={goal.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div><p className="font-medium">{goal.title}</p><p className="mt-1 text-sm text-muted-foreground">{goal.progress}% complete</p></div>
                      <Badge className={goal.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}>{goal.status}</Badge>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${goal.progress}%` }} />
                    </div>
                  </Card>
                ))}</div>}
            </div>
          )}
          {activeTab === "workers" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Team Members</h2>
              {workers.length === 0 ? <Card className="p-8 text-center"><p className="text-muted-foreground">No team members yet</p></Card>
                : <div className="space-y-3">{workers.map((worker) => <WorkerRow key={worker.id} worker={worker} />)}</div>}
            </div>
          )}
        </div>

        <div>
          {selectedTask ? (
            <Card className="p-4 sticky top-4">
              <h3 className="font-semibold mb-4">Task Details</h3>
              <div className="space-y-3">
                <div><p className="text-sm text-muted-foreground">Title</p><p className="font-medium">{selectedTask.title}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p><StatusBadge status={selectedTask.status} /></div>
                {selectedTask.description && <div><p className="text-sm text-muted-foreground">Description</p><p className="text-sm">{selectedTask.description}</p></div>}
                {selectedTask.progressPct > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${selectedTask.progressPct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedTask.progressPct}%</p>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Select a task to view details</p></Card>
          )}
        </div>
      </div>
    </div>
  );
}
