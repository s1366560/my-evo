/**
 * Notifications Store
 * Manages toast notifications and in-app notification center.
 */
import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
}

// Simple ID generator
let idCounter = 0;
const generateId = () => `notif-${Date.now()}-${++idCounter}`;

// ============================================================================
// Store Interface
// ============================================================================
interface NotificationsState {
  toasts: Notification[];
  showToast: (n: Omit<Notification, 'id' | 'createdAt'>) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  getToastById: (id: string) => Notification | undefined;
}

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 5000;

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  toasts: [],
  
  showToast: (notification) => {
    const id = generateId();
    const duration = notification.duration ?? DEFAULT_DURATION;
    const newToast: Notification = { ...notification, id, createdAt: Date.now() };
    
    set((state) => ({ toasts: [newToast, ...state.toasts].slice(0, MAX_TOASTS) }));
    
    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration);
    }
    return id;
  },
  
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  
  clearAllToasts: () => set({ toasts: [] }),
  
  getToastById: (id) => get().toasts.find((t) => t.id === id),
}));

// ============================================================================
// Convenience Hooks
// ============================================================================
export const useToasts = () => useNotificationsStore((s) => s.toasts);
export const useHasToasts = () => useNotificationsStore((s) => s.toasts.length > 0);

// ============================================================================
// Action Creators
// ============================================================================
export const notify = {
  success: (title: string, message?: string) =>
    useNotificationsStore.getState().showToast({ type: 'success', title, message }),
  error: (title: string, message?: string) =>
    useNotificationsStore.getState().showToast({ type: 'error', title, message, duration: 8000 }),
  warning: (title: string, message?: string) =>
    useNotificationsStore.getState().showToast({ type: 'warning', title, message }),
  info: (title: string, message?: string) =>
    useNotificationsStore.getState().showToast({ type: 'info', title, message }),
};
