/**
 * Stores Index
 * Central export for all Zustand stores
 */

// UI Store
export {
  useUIStore,
  useTheme,
  useSidebar,
  useModal,
  useBreadcrumbs,
  type Theme,
  type SidebarState,
  type ModalType,
  type ModalState,
  type BreadcrumbItem,
} from './ui-store';

// Notifications Store
export {
  useNotificationsStore,
  useToasts,
  useHasToasts,
  notify,
  type Notification,
  type NotificationType,
} from './notifications-store';

// Workspace Store
export {
  useWorkspaceStore,
  useGoals,
  useActiveGoal,
  useTasks,
  useWorkers,
  useSelectedTask,
  type WorkspaceTask,
  type WorkspaceWorker,
  type Goal,
  type TaskStatus,
  type WorkerStatus,
  type LeaderStatus,
  type PreflightCheck,
} from './workspace-store';

// Auth Store
export {
  useAuthStore,
  type AuthUser,
} from './auth-store';
