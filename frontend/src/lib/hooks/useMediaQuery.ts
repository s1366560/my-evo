import { useState, useEffect, useRef, useCallback } from 'react';

// ── useMediaQuery ─────────────────────────────────────────────────────────────

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ── usePrevious ────────────────────────────────────────────────────────────────

export function usePrevious<T>(value: T): T | undefined {
  const prevRef = useRef<T | undefined>(undefined);
  const curRef  = useRef<T | undefined>(undefined);
  // Return last render's curRef (which holds the value from before this render)
  const prev = curRef.current;
  // Update curRef for next render
  curRef.current = value;
  void prevRef; // reserved for future comparison use
  return prev;
}

// ── useClickOutside ───────────────────────────────────────────────────────────

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// ── useAsync ─────────────────────────────────────────────────────────────────

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = [],
): { state: AsyncState<T>; execute: () => Promise<T> } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const execute = useCallback(async () => {
    setState({ status: 'pending' });
    try {
      const data = await asyncFn();
      setState({ status: 'success', data });
      return data;
    } catch (error) {
      setState({ status: 'error', error: error as Error });
      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { state, execute };
}
