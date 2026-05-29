/**
 * UI Store
 * Manages global UI state: sidebar, modals, theme, breadcrumbs, etc.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================
export type Theme = 'light' | 'dark' | 'system';
export type SidebarState = 'expanded' | 'collapsed' | 'hidden';
export type ModalType = 
  | 'create-bounty' | 'create-workspace' | 'settings' 
  | 'confirm-action' | 'asset-preview' | 'credits-purchase';

// Modal State
export interface ModalState {
  isOpen: boolean;
  type: ModalType | null;
  data?: Record<string, unknown>;
}

// Breadcrumb
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ============================================================================
// Store Interface
// ============================================================================
interface UIState {
  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  
  // Sidebar
  sidebar: SidebarState;
  sidebarWidth: number;
  setSidebar: (state: SidebarState) => void;
  setSidebarWidth: (width: number) => void;
  
  // Modals
  modal: ModalState;
  openModal: (type: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  
  // Command Palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  
  // Breadcrumbs
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (items: BreadcrumbItem[]) => void;
  
  // Page Loading
  isPageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
  
  // Fullscreen
  isFullscreen: boolean;
  setFullscreen: (fullscreen: boolean) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Theme
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: (theme) => {
        const resolved = theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          : theme;
        set({ theme, resolvedTheme: resolved as 'light' | 'dark' });
      },
      
      // Sidebar
      sidebar: 'expanded',
      sidebarWidth: 280,
      setSidebar: (sidebar) => set({ sidebar }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      
      // Modals
      modal: { isOpen: false, type: null, data: undefined },
      openModal: (type, data) => set({ modal: { isOpen: true, type, data } }),
      closeModal: () => set({ modal: { isOpen: false, type: null, data: undefined } }),
      
      // Command Palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      
      // Breadcrumbs
      breadcrumbs: [],
      setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
      
      // Page Loading
      isPageLoading: false,
      setPageLoading: (isPageLoading) => set({ isPageLoading }),
      
      // Fullscreen
      isFullscreen: false,
      setFullscreen: (isFullscreen) => set({ isFullscreen }),
    }),
    {
      name: 'evo-ui-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebar: state.sidebar,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================
export const useTheme = () => useUIStore((s) => s.theme);
export const useSidebar = () => useUIStore((s) => s.sidebar);
export const useModal = () => useUIStore((s) => s.modal);
export const useBreadcrumbs = () => useUIStore((s) => s.breadcrumbs);
