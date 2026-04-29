/**
 * Workspace Store
 * Manages workspace state: tasks, goals, workers, and team collaboration.
 */
import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================
export type LeaderStatus = 'forming' | 'active' | 'waiting' | 'completing' | 'completed' | 'failed';
export type WorkerStatus = 'idle' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'failed' | 'blocked';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'failed' | 'blocked';

export interface PreflightCheck {
  check_id: string;
  kind: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  evidence?: string;
}

export interface WorkspaceTask {
  id: string;
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  progressPct: number;
  assignedWorkerId?: string;
  role?: string;
  dependencies: string[];
  preflightChecks?: PreflightCheck[];
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkspaceWorker {
  id: string;
  name: string;
  role: 'architect' | 'builder' | 'verifier' | 'specialist';
  status: WorkerStatus;
  assignedTasks: string[];
  joinedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'active' | 'completed' | 'pending' | 'failed';
  childTasks: string[];
  createdAt: string;
}

// ============================================================================
// Store Interface
// ============================================================================
interface WorkspaceState {
  workspaceId: string | null;
  workspaceName: string;
  goals: Goal[];
  activeGoalId: string | null;
  tasks: WorkspaceTask[];
  workers: WorkspaceWorker[];
  selectedTaskId: string | null;
  expandedGoalIds: string[];
  setWorkspace: (id: string, name: string) => void;
  setGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  updateGoalProgress: (goalId: string, progress: number) => void;
  setActiveGoal: (goalId: string | null) => void;
  setTasks: (tasks: WorkspaceTask[]) => void;
  addTask: (task: WorkspaceTask) => void;
  updateTask: (taskId: string, updates: Partial<WorkspaceTask>) => void;
  removeTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
  setWorkers: (workers: WorkspaceWorker[]) => void;
  updateWorkerStatus: (workerId: string, status: WorkerStatus) => void;
  toggleGoalExpanded: (goalId: string) => void;
  getTaskById: (taskId: string) => WorkspaceTask | undefined;
  getTasksByGoal: (goalId: string) => WorkspaceTask[];
  getWorkerById: (workerId: string) => WorkspaceWorker | undefined;
}

// ============================================================================
// Store Implementation
// ============================================================================
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaceId: null,
  workspaceName: 'My Evo Workspace',
  goals: [],
  activeGoalId: null,
  tasks: [],
  workers: [],
  selectedTaskId: null,
  expandedGoalIds: [],

  setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),
  setGoals: (goals) => set({ goals }),
  addGoal: (goal) => set((s) => ({ goals: [...s.goals, goal] })),
  updateGoalProgress: (goalId, progress) =>
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? { ...g, progress } : g)) })),
  setActiveGoal: (goalId) => set({ activeGoalId: goalId }),
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (taskId, updates) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) })),
  removeTask: (taskId) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) })),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setWorkers: (workers) => set({ workers }),
  updateWorkerStatus: (workerId, status) =>
    set((s) => ({ workers: s.workers.map((w) => (w.id === workerId ? { ...w, status } : w)) })),
  toggleGoalExpanded: (goalId) =>
    set((s) => ({
      expandedGoalIds: s.expandedGoalIds.includes(goalId)
        ? s.expandedGoalIds.filter((id) => id !== goalId)
        : [...s.expandedGoalIds, goalId],
    })),
  getTaskById: (taskId) => get().tasks.find((t) => t.id === taskId),
  getTasksByGoal: (goalId) => {
    const goal = get().goals.find((g) => g.id === goalId);
    return goal ? get().tasks.filter((t) => goal.childTasks.includes(t.id)) : [];
  },
  getWorkerById: (workerId) => get().workers.find((w) => w.id === workerId),
}));

// ============================================================================
// Selector Hooks
// ============================================================================
export const useGoals = () => useWorkspaceStore((s) => s.goals);
export const useActiveGoal = () => {
  const goals = useWorkspaceStore((s) => s.goals);
  const activeGoalId = useWorkspaceStore((s) => s.activeGoalId);
  return goals.find((g) => g.id === activeGoalId);
};
export const useTasks = () => useWorkspaceStore((s) => s.tasks);
export const useWorkers = () => useWorkspaceStore((s) => s.workers);
export const useSelectedTask = () => {
  const tasks = useWorkspaceStore((s) => s.tasks);
  const selectedTaskId = useWorkspaceStore((s) => s.selectedTaskId);
  return tasks.find((t) => t.id === selectedTaskId);
};
