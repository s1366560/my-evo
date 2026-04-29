/**
 * Workspace Hooks
 * Fetches workspace data (goals, tasks, workers) from the API and syncs to the Zustand store.
 * Uses real API calls to the backend instead of MSW mock data.
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import type { Goal, WorkspaceWorker } from '@/lib/stores/workspace-store';
import type { WorkspaceTask } from '@/lib/api/client';

// API Response types (from real backend)
interface WorkspaceGoalsResponse {
  goals: Goal[];
  total: number;
}

interface WorkspaceTasksResponse {
  tasks: WorkspaceTask[];
  total: number;
}

interface WorkspaceWorkersResponse {
  workers: WorkspaceWorker[];
  total: number;
}

interface WorkspaceMembersResponse {
  members: Array<{
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    displayName: string;
    avatar: string | null;
  }>;
  total: number;
}

// Type compatibility fix - use store types directly
const mapGoal = (goal: Goal): Goal => goal;
const mapTask = (task: WorkspaceTask): WorkspaceTask => task;
const mapWorker = (worker: WorkspaceWorker): WorkspaceWorker => worker;

/**
 * Fetches workspace goals from the API
 */
export function useWorkspaceGoals() {
  return useQuery<WorkspaceGoalsResponse>({
    queryKey: ['workspace', 'goals'],
    queryFn: async () => {
      const data = await apiClient.getWorkspaceGoals();
      // Ensure data matches store types
      return {
        goals: (data.goals || []).map(mapGoal),
        total: data.total || 0,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetches workspace tasks from the API
 */
export function useWorkspaceTasks() {
  return useQuery<WorkspaceTasksResponse>({
    queryKey: ['workspace', 'tasks'],
    queryFn: async () => {
      const data = await apiClient.getWorkspaceTasks();
      return {
        tasks: (data.tasks || []).map(mapTask),
        total: data.total || 0,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetches workspace workers from the API
 */
export function useWorkspaceWorkers() {
  return useQuery<WorkspaceWorkersResponse>({
    queryKey: ['workspace', 'workers'],
    queryFn: async () => {
      const data = await apiClient.getWorkspaceWorkers();
      return {
        workers: (data.workers || []).map(mapWorker),
        total: data.total || 0,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetches workspace members from the API
 */
export function useWorkspaceMembers() {
  return useQuery<WorkspaceMembersResponse>({
    queryKey: ['workspace', 'members'],
    queryFn: () => apiClient.getWorkspaceMembers(),
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to sync workspace data (goals, tasks, workers) into the Zustand store.
 * Call this once in a layout or page to populate the store.
 */
export function useWorkspaceSync() {
  const goalsQuery = useWorkspaceGoals();
  const tasksQuery = useWorkspaceTasks();
  const workersQuery = useWorkspaceWorkers();

  const setGoals = useWorkspaceStore((s) => s.setGoals);
  const setTasks = useWorkspaceStore((s) => s.setTasks);
  const setWorkers = useWorkspaceStore((s) => s.setWorkers);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  useEffect(() => {
    if (goalsQuery.data) {
      setGoals(goalsQuery.data.goals);
      const activeGoal = goalsQuery.data.goals.find((g: Goal) => g.status === 'active');
      if (activeGoal) {
        useWorkspaceStore.getState().setActiveGoal(activeGoal.id);
      }
    }
  }, [goalsQuery.data, setGoals]);

  useEffect(() => {
    if (tasksQuery.data) {
      setTasks(tasksQuery.data.tasks);
    }
  }, [tasksQuery.data, setTasks]);

  useEffect(() => {
    if (workersQuery.data) {
      setWorkers(workersQuery.data.workers);
    }
  }, [workersQuery.data, setWorkers]);

  useEffect(() => {
    if (goalsQuery.data?.goals[0]) {
      setWorkspace('ws_default', 'My Evo Workspace');
    }
  }, [goalsQuery.data, setWorkspace]);

  return {
    goalsLoading: goalsQuery.isLoading,
    tasksLoading: tasksQuery.isLoading,
    workersLoading: workersQuery.isLoading,
    goalsError: goalsQuery.error,
    tasksError: tasksQuery.error,
    workersError: workersQuery.error,
    isLoading: goalsQuery.isLoading || tasksQuery.isLoading || workersQuery.isLoading,
    isError: goalsQuery.isError || tasksQuery.isError || workersQuery.isError,
  };
}

/**
 * Hook to update workspace task status
 */
export function useUpdateWorkspaceTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<WorkspaceTask> }) =>
      apiClient.updateWorkspaceTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'tasks'] });
    },
  });
}

/**
 * Hook to invite a workspace member
 */
export function useInviteWorkspaceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, role }: { email: string; role?: string }) =>
      apiClient.inviteWorkspaceMember(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'members'] });
    },
  });
}

/**
 * Hook to update workspace settings
 */
export function useUpdateWorkspaceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Parameters<typeof apiClient.updateWorkspaceSettings>[0]) =>
      apiClient.updateWorkspaceSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'current'] });
    },
  });
}
