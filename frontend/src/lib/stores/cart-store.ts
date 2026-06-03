/**
 * Cart Store
 *
 * Holds the list of asset ids the current user wants to buy and a small
 * "last purchase" cache so the purchase-history page can show transaction
 * id and amount without an extra round-trip right after checkout.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  assetId: string;
  name: string;
  price: number;
  type?: string;
  addedAt: string;
}

export interface PurchaseRecord {
  transaction_id: string;
  amount: number;
  asset_id: string;
  asset_name?: string;
  version_id?: string;
  status: string;
  purchased_at: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  recentPurchases: PurchaseRecord[];
  addItem: (item: CartItem) => void;
  removeItem: (assetId: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  recordPurchase: (record: PurchaseRecord) => void;
  totalCredits: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      recentPurchases: [],

      addItem: (item) => {
        const existing = get().items.find((i) => i.assetId === item.assetId);
        if (existing) return;
        set({ items: [...get().items, item] });
      },

      removeItem: (assetId) => {
        set({ items: get().items.filter((i) => i.assetId !== assetId) });
      },

      clear: () => set({ items: [], isOpen: false }),

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set({ isOpen: !get().isOpen }),

      recordPurchase: (record) => {
        set({
          recentPurchases: [record, ...get().recentPurchases].slice(0, 50),
        });
      },

      totalCredits: () => get().items.reduce((s, i) => s + i.price, 0),
    }),
    {
      name: 'evomap-cart',
      partialize: (s) => ({
        items: s.items,
        recentPurchases: s.recentPurchases,
      }),
    },
  ),
);
