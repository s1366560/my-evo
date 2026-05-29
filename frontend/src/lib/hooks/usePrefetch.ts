"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * usePrefetch - Link prefetching for faster navigation
 *
 * Prefetches routes on hover to reduce perceived latency when clicking links.
 * Uses Next.js built-in prefetching via next/link.
 */

/**
 * Prefetch configuration for different page types
 */
const PREFETCH_CONFIG = {
  // Prefetch immediately when link becomes visible
  eager: ["browse", "marketplace", "arena", "bounty-hall"],
  // Prefetch only on hover
  lazy: ["bounty", "skills", "docs", "council"],
  // Never prefetch (rarely visited)
  never: [],
} as const;

type PrefetchStrategy = keyof typeof PREFETCH_CONFIG;

interface PrefetchOptions {
  /** Prefetch strategy */
  strategy?: PrefetchStrategy;
  /** Custom priority override */
  priority?: "high" | "low";
  /** Delay before prefetching (ms) */
  delay?: number;
}

/**
 * Hook for intelligent link prefetching
 */
export function usePrefetch(options: PrefetchOptions = {}) {
  const router = useRouter();
  const prefetchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * Determine prefetch strategy based on route
   */
  const getStrategy = useCallback(
    (route: string): PrefetchStrategy => {
      const baseRoute = route.split("/")[1]?.replace(/\[.*?\]/g, ":id") ?? "";

      for (const [strategy, routes] of Object.entries(PREFETCH_CONFIG)) {
        if (routes.includes(baseRoute as never)) {
          return strategy as PrefetchStrategy;
        }
      }
      return "lazy"; // Default to lazy
    },
    []
  );

  /**
   * Prefetch a route with optional delay
   */
  const prefetch = useCallback(
    (route: string) => {
      const delay = options.delay ?? 50;

      // Cancel any pending prefetch for this route
      const existing = prefetchTimers.current.get(route);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        try {
          router.prefetch(route);
        } catch (e) {
          // Prefetch errors are non-critical
          console.debug("[Prefetch] Failed for route:", route, e);
        } finally {
          prefetchTimers.current.delete(route);
        }
      }, delay);

      prefetchTimers.current.set(route, timer);
    },
    [options.delay, router]
  );

  /**
   * Prefetch multiple routes in parallel
   */
  const prefetchMultiple = useCallback(
    (routes: string[]) => {
      routes.forEach((route) => prefetch(route));
    },
    [prefetch]
  );

  /**
   * Cancel prefetch for a route
   */
  const cancelPrefetch = useCallback((route: string) => {
    const timer = prefetchTimers.current.get(route);
    if (timer) {
      clearTimeout(timer);
      prefetchTimers.current.delete(route);
    }
  }, []);

  /**
   * Cleanup all pending prefetches
   */
  const cleanup = useCallback(() => {
    prefetchTimers.current.forEach((timer) => clearTimeout(timer));
    prefetchTimers.current.clear();
  }, []);

  /**
   * Smart prefetch based on strategy
   */
  const smartPrefetch = useCallback(
    (route: string) => {
      const strategy = options.strategy ?? getStrategy(route);
      if (strategy === "never") return;

      if (strategy === "eager") {
        prefetch(route);
      } else {
        prefetch(route);
      }
    },
    [options.strategy, getStrategy, prefetch]
  );

  return {
    prefetch,
    prefetchMultiple,
    cancelPrefetch,
    cleanup,
    smartPrefetch,
    getStrategy,
  };
}

/**
 * useViewportPrefetch - Prefetch routes when they enter viewport
 *
 * Uses IntersectionObserver to detect when links become visible
 * and prefetches them proactively.
 */
export function useViewportPrefetch(
  options: {
    rootMargin?: string;
    threshold?: number;
    enabled?: boolean;
  } = {}
) {
  const { rootMargin = "200px", threshold = 0, enabled = true } = options;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const prefetchedRoutes = useRef<Set<string>>(new Set());

  const observe = useCallback(
    (element: HTMLElement, route: string) => {
      if (!enabled || prefetchedRoutes.current.has(route)) return;

      if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
        // Fallback for SSR or unsupported browsers
        try {
          const router = useRouter();
          router.prefetch(route);
          prefetchedRoutes.current.add(route);
        } catch {
          // Ignore
        }
        return;
      }

      observerRef.current?.observe(element);
    },
    [enabled]
  );

  const unobserve = useCallback((element: HTMLElement) => {
    observerRef.current?.unobserve(element);
  }, []);

  const initObserver = useCallback(
    (onPrefetch: (route: string) => void) => {
      if (observerRef.current) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const route = entry.target.getAttribute("data-route");
              if (route && !prefetchedRoutes.current.has(route)) {
                onPrefetch(route);
                prefetchedRoutes.current.add(route);
                observerRef.current?.unobserve(entry.target);
              }
            }
          });
        },
        { rootMargin, threshold }
      );
    },
    [rootMargin, threshold]
  );

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  return {
    observe,
    unobserve,
    initObserver,
    disconnect,
    isPrefetched: (route: string) => prefetchedRoutes.current.has(route),
  };
}
