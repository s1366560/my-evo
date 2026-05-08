import { create } from 'zustand';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));

interface MapNode {
  id: string;
  label: string;
  type: 'gene' | 'capsule' | 'recipe';
  score: number;
  x: number;
  y: number;
}

interface MapState {
  nodes: MapNode[];
  selectedNode: MapNode | null;
  setNodes: (nodes: MapNode[]) => void;
  setSelectedNode: (node: MapNode | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  nodes: [],
  selectedNode: null,
  setNodes: (nodes) => set({ nodes }),
  setSelectedNode: (node) => set({ selectedNode: node }),
}));
