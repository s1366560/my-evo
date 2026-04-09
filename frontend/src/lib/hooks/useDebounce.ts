"use client";

import { useEffect, useState } from "react";

/**
 * Debounces a value by the given delay (in ms).
 * Prevents excessive API calls on keystroke in search inputs.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
