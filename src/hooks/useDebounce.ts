import { useEffect, useRef } from "react";

/**
 * React hook for debouncing a value or callback.
 * @param callback Function to debounce
 * @param delay Delay in ms
 * @param deps Dependency array
 */
export function useDebounceEffect(callback: () => void, delay: number, deps: any[]) {
  const handler = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (handler.current) {
      clearTimeout(handler.current);
    }
    handler.current = setTimeout(() => {
      callback();
    }, delay);
    return () => {
      if (handler.current) {
        clearTimeout(handler.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
