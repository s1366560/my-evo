/**
 * @jest-environment jsdom
 *
 * Tests for the Cart store (Zustand) state machine used by CartDrawer.
 *
 * The cart store exposes: items, isOpen, recentPurchases, and actions
 * addItem, removeItem, clear, open, close, toggle, recordPurchase,
 * totalCredits. We test the full state-machine transitions here.
 */
import { useCartStore, type CartItem, type PurchaseRecord } from '@/lib/stores/cart-store';

// Zustand persist writes to localStorage. We reset between tests.
beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({
    items: [],
    isOpen: false,
    recentPurchases: [],
  });
});

// ─── addItem / removeItem ─────────────────────────────────────────────────

describe('Cart store — add / remove items', () => {
  const sampleItem: CartItem = {
    assetId: 'asset-1',
    name: 'Gene Alpha',
    price: 100,
    type: 'Gene',
    addedAt: new Date().toISOString(),
  };

  it('adds an item to the cart', () => {
    useCartStore.getState().addItem(sampleItem);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]!.assetId).toBe('asset-1');
  });

  it('does not add a duplicate item (same assetId)', () => {
    useCartStore.getState().addItem(sampleItem);
    useCartStore.getState().addItem(sampleItem);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('removes an item by assetId', () => {
    useCartStore.getState().addItem(sampleItem);
    useCartStore.getState().removeItem('asset-1');
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('removing a non-existent item is a no-op', () => {
    useCartStore.getState().addItem(sampleItem);
    useCartStore.getState().removeItem('asset-999');
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────

describe('Cart store — clear', () => {
  it('clears all items and closes the drawer', () => {
    useCartStore.getState().addItem({
      assetId: 'a1', name: 'X', price: 50, addedAt: new Date().toISOString(),
    });
    useCartStore.getState().addItem({
      assetId: 'a2', name: 'Y', price: 75, addedAt: new Date().toISOString(),
    });
    useCartStore.getState().open();
    expect(useCartStore.getState().items).toHaveLength(2);
    expect(useCartStore.getState().isOpen).toBe(true);

    useCartStore.getState().clear();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().isOpen).toBe(false);
  });
});

// ─── open / close / toggle ────────────────────────────────────────────────

describe('Cart store — drawer state machine', () => {
  it('starts closed', () => {
    expect(useCartStore.getState().isOpen).toBe(false);
  });

  it('open() opens the drawer', () => {
    useCartStore.getState().open();
    expect(useCartStore.getState().isOpen).toBe(true);
  });

  it('close() closes the drawer', () => {
    useCartStore.getState().open();
    useCartStore.getState().close();
    expect(useCartStore.getState().isOpen).toBe(false);
  });

  it('toggle() flips the drawer state', () => {
    expect(useCartStore.getState().isOpen).toBe(false);
    useCartStore.getState().toggle();
    expect(useCartStore.getState().isOpen).toBe(true);
    useCartStore.getState().toggle();
    expect(useCartStore.getState().isOpen).toBe(false);
  });
});

// ─── totalCredits ─────────────────────────────────────────────────────────

describe('Cart store — totalCredits', () => {
  it('returns 0 for empty cart', () => {
    expect(useCartStore.getState().totalCredits()).toBe(0);
  });

  it('sums prices of all items', () => {
    useCartStore.getState().addItem({
      assetId: 'a1', name: 'X', price: 50, addedAt: new Date().toISOString(),
    });
    useCartStore.getState().addItem({
      assetId: 'a2', name: 'Y', price: 75, addedAt: new Date().toISOString(),
    });
    expect(useCartStore.getState().totalCredits()).toBe(125);
  });
});

// ─── recordPurchase ───────────────────────────────────────────────────────

describe('Cart store — recordPurchase', () => {
  it('appends a purchase record to recentPurchases', () => {
    const record: PurchaseRecord = {
      transaction_id: 'tx-1',
      amount: 100,
      asset_id: 'asset-1',
      asset_name: 'Gene Alpha',
      status: 'completed',
      purchased_at: new Date().toISOString(),
    };
    useCartStore.getState().recordPurchase(record);
    expect(useCartStore.getState().recentPurchases).toHaveLength(1);
    expect(useCartStore.getState().recentPurchases[0]!.transaction_id).toBe('tx-1');
  });

  it('caps recentPurchases at 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      useCartStore.getState().recordPurchase({
        transaction_id: `tx-${i}`,
        amount: i * 10,
        asset_id: `asset-${i}`,
        status: 'completed',
        purchased_at: new Date().toISOString(),
      });
    }
    expect(useCartStore.getState().recentPurchases).toHaveLength(50);
    // Most recent first.
    expect(useCartStore.getState().recentPurchases[0]!.transaction_id).toBe('tx-54');
  });
});
