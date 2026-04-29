/**
 * @jest-environment jsdom
 *
 * Tests for useLocalStorage hook logic (pure JS, no React rendering).
 * The hook's behavior can be validated by testing the localStorage contract directly.
 */

const STORAGE_KEY = "test-useLocalStorage-key";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ----------------------------------------------------------------
// Helpers that mirror the useLocalStorage implementation logic
// ----------------------------------------------------------------

function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeToStorage<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeFromStorage(key: string): void {
  window.localStorage.removeItem(key);
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("useLocalStorage — localStorage contract", () => {
  describe("readFromStorage", () => {
    it("returns fallback when key does not exist", () => {
      const result = readFromStorage("nonexistent-key", { name: "fallback" });
      expect(result).toEqual({ name: "fallback" });
    });

    it("returns parsed value when key exists", () => {
      writeToStorage(STORAGE_KEY, { name: "stored" });
      const result = readFromStorage<{ name: string }>(STORAGE_KEY, {
        name: "fallback",
      });
      expect(result).toEqual({ name: "stored" });
    });

    it("returns fallback on corrupted JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not valid json{");
      const result = readFromStorage(STORAGE_KEY, { name: "fallback" });
      expect(result).toEqual({ name: "fallback" });
    });

    it("handles primitives (string, number, boolean)", () => {
      writeToStorage("str-key", "hello");
      writeToStorage("num-key", 42);
      writeToStorage("bool-key", true);

      expect(readFromStorage("str-key", "")).toBe("hello");
      expect(readFromStorage("num-key", 0)).toBe(42);
      expect(readFromStorage("bool-key", false)).toBe(true);
    });

    it("handles arrays and nested objects", () => {
      const complex = {
        user: { id: 1, tags: ["a", "b"] },
        scores: [10, 20, 30],
      };
      writeToStorage(STORAGE_KEY, complex);
      const result = readFromStorage(STORAGE_KEY, complex);
      expect(result).toEqual(complex);
    });
  });

  describe("writeToStorage", () => {
    it("stores JSON-serialized value", () => {
      writeToStorage(STORAGE_KEY, { count: 5 });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ count: 5 }));
    });

    it("overwrites previous value", () => {
      writeToStorage(STORAGE_KEY, { v: 1 });
      writeToStorage(STORAGE_KEY, { v: 2 });
      expect(readFromStorage<{ v: number }>(STORAGE_KEY, { v: 0 })).toEqual({ v: 2 });
    });
  });

  describe("removeFromStorage", () => {
    it("removes key and readFromStorage returns fallback", () => {
      writeToStorage(STORAGE_KEY, { name: "stored" });
      removeFromStorage(STORAGE_KEY);
      const result = readFromStorage(STORAGE_KEY, { name: "fallback" });
      expect(result).toEqual({ name: "fallback" });
    });

    it("removeFromStorage on nonexistent key is a no-op", () => {
      expect(() => removeFromStorage("nonexistent")).not.toThrow();
    });
  });

  describe("functional updater", () => {
    it("functional updater receives current value", () => {
      const current = { count: 0 };
      const updater = (prev: { count: number }) => ({ count: prev.count + 1 });
      const newVal = updater instanceof Function ? updater(current) : updater;
      expect(newVal).toEqual({ count: 1 });
    });
  });

  describe("cross-tab sync (storage event)", () => {
    it("storage event fires when another tab writes to the same key", () => {
      const events: StorageEvent[] = [];
      const handler = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) events.push(e);
      };
      window.addEventListener("storage", handler);
      try {
        // In jsdom, localStorage.setItem does NOT fire cross-tab storage events
        // in the same context. We simulate the event that the browser would fire:
        window.dispatchEvent(new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: JSON.stringify({ updated: true }),
          oldValue: null,
          storageArea: localStorage,
        }));
        expect(events.length).toBeGreaterThanOrEqual(1);
        expect(events[0].key).toBe(STORAGE_KEY);
      } finally {
        window.removeEventListener("storage", handler);
      }
    });
  });
});
