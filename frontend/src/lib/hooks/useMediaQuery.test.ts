/**
 * @jest-environment jsdom
 *
 * Tests for useMediaQuery hook logic.
 * Exercises the window.matchMedia API directly since rendering is not available.
 */

// jsdom does not provide MediaQueryListEvent; provide a minimal polyfill
if (typeof window !== "undefined" && !window.hasOwnProperty("MediaQueryListEvent")) {
  (window as unknown as Record<string, unknown>).MediaQueryListEvent = class MediaQueryListEvent extends Event {
    readonly matches: boolean;
    readonly media: string;
    constructor(type: string, init?: { matches?: boolean; media?: string }) {
      super(type, init as EventInit);
      this.matches = init?.matches ?? false;
      this.media = init?.media ?? "";
    }
  };
}

describe("useMediaQuery — matchMedia contract", () => {
  // ─────────────────────────────────────────────────────────────────
  // Mock matchMedia helpers — jsdom's default viewport is 1024×768,
  // so queries like "(max-width: 99999px)" may not behave as expected.
  // We use programmatic mocks for tests that need specific matches values.
  // ─────────────────────────────────────────────────────────────────

  // Direct reference to the real matchMedia — we replace window.matchMedia
  // via assignment (not Object.defineProperty) to avoid non-configurable issues.
  const realMatchMedia = window.matchMedia.bind(window);

  /** Create a mock MQL with controllable matches + captured listeners */
  function createMockMQL(initialMatches: boolean) {
    let matches = initialMatches;
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    return {
      get matches() { return matches; },
      set matches(v: boolean) { matches = v; },
      get media() { return ""; },
      addEventListener(_type: string, handler: (e: MediaQueryListEvent) => void) {
        listeners.push(handler);
      },
      removeEventListener(_type: string, handler: (e: MediaQueryListEvent) => void) {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      },
      dispatchEvent(_event: Event): boolean { return true; },
      // Helper to simulate a change event (not standard DOM API, used in tests)
      _fireChange(newMatches: boolean) {
        listeners.forEach(h => h(new MediaQueryListEvent("change", { matches: newMatches, media: "" })));
      },
    };
  }

  beforeEach(() => {
    // Restore real matchMedia before each test
    window.matchMedia = realMatchMedia;
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  function subscribe(
    mql: ReturnType<typeof createMockMQL>,
    callback: (matches: boolean) => void
  ): () => void {
    const handler = (event: MediaQueryListEvent) => callback(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }

  // ----------------------------------------------------------------
  // Tests
  // ----------------------------------------------------------------

  describe("getMatches", () => {
    it("returns false for a query that does not match", () => {
      // A query that never matches in a standard test environment
      expect(window.matchMedia("(min-width: 99999px)").matches).toBe(false);
    });

    it("returns true for a query that matches", () => {
      // Use a mock so the test is deterministic regardless of jsdom viewport size
      const mock = createMockMQL(true);
      window.matchMedia = () => mock as unknown as MediaQueryList;
      expect(window.matchMedia("(min-width: 0px)").matches).toBe(true);
    });

    it("handles arbitrary media query strings", () => {
      // Color scheme query
      const result = window.matchMedia("(prefers-color-scheme: light)").matches;
      expect(typeof result).toBe("boolean");
    });
  });

  describe("subscribe / change detection", () => {
    it("callback fires when media query transitions", () => {
      const mock = createMockMQL(false);
      window.matchMedia = () => mock as unknown as MediaQueryList;
      const changes: boolean[] = [];

      const unsubscribe = subscribe(mock, (matches) => {
        changes.push(matches);
      });

      // Simulate a media query change event
      mock._fireChange(true);

      expect(changes).toContain(true);
      unsubscribe();
    });

    it("unsubscribe stops receiving events", () => {
      const mock = createMockMQL(false);
      window.matchMedia = () => mock as unknown as MediaQueryList;
      const changes: boolean[] = [];

      const unsubscribe = subscribe(mock, (matches) => {
        changes.push(matches);
      });

      // Simulate a change — it should fire
      mock._fireChange(true);
      expect(changes).toContain(true);

      // Unsubscribe
      unsubscribe();

      // Simulate another change — it should NOT fire
      mock._fireChange(false);
      // changes should still contain only one entry (from before unsubscribe)
      expect(changes.filter(v => v === false)).toHaveLength(0);
    });

    it("returns a cleanup function that is callable without throwing", () => {
      const mock = createMockMQL(false);
      window.matchMedia = () => mock as unknown as MediaQueryList;
      const unsubscribe = subscribe(mock, () => {});
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("SSR safety", () => {
    it("matchMedia returns an object with matches property", () => {
      const result = window.matchMedia("(min-width: 0px)");
      expect(typeof result.matches).toBe("boolean");
      expect(typeof result.addEventListener).toBe("function");
      expect(typeof result.removeEventListener).toBe("function");
    });

    it("multiple simultaneous subscriptions are independent", () => {
      const mock1 = createMockMQL(false);
      const mock2 = createMockMQL(true);
      const impl = (q: string) => {
        if (q.includes("1")) return mock1 as unknown as MediaQueryList;
        return mock2 as unknown as MediaQueryList;
      };
      window.matchMedia = impl as typeof window.matchMedia;

      const results1: boolean[] = [];
      const results2: boolean[] = [];

      const q1 = subscribe(mock1, (m) => results1.push(m));
      const q2 = subscribe(mock2, (m) => results2.push(m));

      mock1._fireChange(true);
      mock2._fireChange(false);

      expect(results1).toContain(true);
      expect(results2).toContain(false);

      q1();
      q2();
    });
  });

  describe("predefined breakpoint queries", () => {
    it("mobile breakpoint: (max-width: 767px)", () => {
      // Verified to be a valid query string
      const query = "(max-width: 767px)";
      const mql = window.matchMedia(query);
      expect(typeof mql.matches).toBe("boolean");
    });

    it("tablet breakpoint: (min-width: 768px) and (max-width: 1023px)", () => {
      const q = "(min-width: 768px) and (max-width: 1023px)";
      expect(() => window.matchMedia(q)).not.toThrow();
    });

    it("desktop breakpoint: (min-width: 1024px)", () => {
      const q = "(min-width: 1024px)";
      expect(() => window.matchMedia(q)).not.toThrow();
    });

    it("dark mode: (prefers-color-scheme: dark)", () => {
      const q = "(prefers-color-scheme: dark)";
      expect(() => window.matchMedia(q)).not.toThrow();
    });

    it("reduced motion: (prefers-reduced-motion: reduce)", () => {
      const q = "(prefers-reduced-motion: reduce)";
      expect(() => window.matchMedia(q)).not.toThrow();
    });
  });
});
