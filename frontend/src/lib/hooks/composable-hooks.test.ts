/**
 * @jest-environment jsdom
 *
 * Tests for composable React hooks:
 * - useDebounce
 * - useLocalStorage
 * - useMediaQuery
 * - usePrevious
 */
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./useDebounce";
import { useLocalStorage } from "./useLocalStorage";
import { useMediaQuery } from "./useMediaQuery";
import { usePrevious } from "./useMediaQuery";

// ──────────────────────────────────────────────────────────────
// useDebounce
// ──────────────────────────────────────────────────────────────

describe("useDebounce", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("debounces the value by the given delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );
    expect(result.current).toBe("a");
    rerender({ value: "b", delay: 300 });
    expect(result.current).toBe("a");
    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe("a");
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe("b");
  });

  it("resets the timer when value changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );
    rerender({ value: "b", delay: 300 });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe("a");
    rerender({ value: "c", delay: 300 });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe("a");
    act(() => jest.advanceTimersByTime(101));
    expect(result.current).toBe("c");
  });

  it("works with numeric values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: number; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 42, delay: 200 } }
    );
    expect(result.current).toBe(42);
    rerender({ value: 99, delay: 200 });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe(99);
  });

  it("works with object values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: { key: string }; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: { key: "a" }, delay: 200 } }
    );
    rerender({ value: { key: "b" }, delay: 200 });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toEqual({ key: "b" });
  });
});

// ──────────────────────────────────────────────────────────────
// useLocalStorage
// ──────────────────────────────────────────────────────────────

describe("useLocalStorage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns initialValue when no item exists", () => {
    const { result } = renderHook(() => useLocalStorage("my-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("parses and returns stored JSON value", () => {
    localStorage.setItem("my-key", '"stored-value"');
    const { result } = renderHook(() => useLocalStorage("my-key", "default"));
    expect(result.current[0]).toBe("stored-value");
  });

  it("updates localStorage when setter is called", () => {
    const { result } = renderHook(() => useLocalStorage("my-key", "default"));
    act(() => result.current[1]("new-value"));
    expect(result.current[0]).toBe("new-value");
    expect(localStorage.getItem("my-key")).toBe('"new-value"');
  });

  it("supports functional updater pattern", () => {
    const { result } = renderHook(() => useLocalStorage("counter", 0));
    act(() => result.current[1]((prev) => (prev as number) + 1));
    expect(result.current[0]).toBe(1);
    expect(localStorage.getItem("counter")).toBe("1");
  });

  it("handles JSON parse errors gracefully", () => {
    localStorage.setItem("bad-key", "not-json");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useLocalStorage("bad-key", "fallback"));
    expect(result.current[0]).toBe("fallback");
    warnSpy.mockRestore();
  });

  it("syncs from other-tab storage events", () => {
    const { result } = renderHook(() => useLocalStorage("sync-key", "default"));
    expect(result.current[0]).toBe("default");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "sync-key", newValue: '"updated"' }));
    });
    expect(result.current[0]).toBe("updated");
  });

  it("does not update on unrelated storage events", () => {
    localStorage.setItem("sync-key", '"initial"');
    const { result } = renderHook(() => useLocalStorage("sync-key", "default"));
    expect(result.current[0]).toBe("initial");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "other-key", newValue: '"changed"' }));
    });
    expect(result.current[0]).toBe("initial");
  });
});

// ──────────────────────────────────────────────────────────────
// useMediaQuery
// ──────────────────────────────────────────────────────────────

describe("useMediaQuery", () => {
  let matchMediaSpy: jest.SpyInstance;
  let addEventListenerMock: jest.Mock;
  let removeEventListenerMock: jest.Mock;

  const createMock = (matches: boolean) => {
    // Each mock gets its own matches ref so rerender doesn't corrupt old mock
    let currentMatches = matches;
    addEventListenerMock = jest.fn();
    removeEventListenerMock = jest.fn();
    return {
      get matches() { return currentMatches; },
      set matches(v: boolean) { currentMatches = v; },
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    };
  };

  beforeEach(() => {
    matchMediaSpy = jest.spyOn(window, "matchMedia").mockImplementation(
      () => createMock(false) as unknown as MediaQueryList
    );
  });

  afterEach(() => matchMediaSpy.mockRestore());

  it("returns matches value from matchMedia", () => {
    // Explicitly configure the spy return value before render
    const trueMock = createMock(true);
    matchMediaSpy.mockReturnValue(trueMock as unknown as MediaQueryList);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("returns false when query does not match", () => {
    const falseMock = createMock(false);
    matchMediaSpy.mockReturnValue(falseMock as unknown as MediaQueryList);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
  });

  it("updates when media query changes via event", () => {
    let handler: ((e: MediaQueryListEvent) => void) | undefined;
    const mock = createMock(false);
    mock.addEventListener = jest.fn((_: string, h: (e: MediaQueryListEvent) => void) => { handler = h; }) as unknown as typeof mock.addEventListener;
    matchMediaSpy.mockReturnValue(mock as unknown as MediaQueryList);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
    act(() => handler!({ matches: true } as MediaQueryListEvent));
    expect(result.current).toBe(true);
  });

  it("removes event listener on unmount", () => {
    const mock = createMock(false);
    matchMediaSpy.mockReturnValue(mock as unknown as MediaQueryList);
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(addEventListenerMock).toHaveBeenCalled();
    unmount();
    expect(removeEventListenerMock).toHaveBeenCalled();
  });

  it("updates when query string changes", () => {
    // Pre-build both mocks so the hook gets them in the right order:
    // 1st render → query "(max-width: 767px)" → false
    // 2nd render → query "(min-width: 768px)" → true
    const mock1 = createMock(false);
    const mock2 = createMock(true);
    // Set up both calls BEFORE the first render to avoid beforeEach interference
    matchMediaSpy.mockImplementation((q: string) => {
      if (q === "(max-width: 767px)") return mock1 as unknown as MediaQueryList;
      return mock2 as unknown as MediaQueryList;
    });
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useMediaQuery(q),
      { initialProps: { q: "(max-width: 767px)" } }
    );
    expect(result.current).toBe(false);
    rerender({ q: "(min-width: 768px)" });
    expect(result.current).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// usePrevious
// ──────────────────────────────────────────────────────────────

describe("usePrevious", () => {
  it("returns undefined on first render", () => {
    const { result } = renderHook(() => usePrevious(42));
    expect(result.current).toBeUndefined();
  });

  it("returns previous value after value changes", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => usePrevious(value),
      { initialProps: { value: 1 } }
    );
    expect(result.current).toBeUndefined();
    rerender({ value: 2 });
    expect(result.current).toBe(1);
    rerender({ value: 3 });
    expect(result.current).toBe(2);
  });

  it("returns previous value even when value is the same", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => usePrevious(value),
      { initialProps: { value: "hello" } }
    );
    // First render: previous = undefined
    expect(result.current).toBeUndefined();
    rerender({ value: "world" });
    // Second render: previous = "hello" (the initial value)
    expect(result.current).toBe("hello");
    rerender({ value: "world" });
    // Same value again: previous = "world" (the last render's value, not re-updated since value unchanged)
    expect(result.current).toBe("world");
  });

  it("works with object values", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: { count: number } }) => usePrevious(value),
      { initialProps: { value: { count: 0 } } }
    );
    rerender({ value: { count: 1 } });
    expect(result.current).toEqual({ count: 0 });
  });

  it("works with null and undefined values", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string | null }) => usePrevious(value),
      { initialProps: { value: null } as { value: string | null } }
    );
    expect(result.current).toBeUndefined();
    rerender({ value: "hello" });
    expect(result.current).toBeNull();
    rerender({ value: null });
    expect(result.current).toBe("hello");
  });
});
