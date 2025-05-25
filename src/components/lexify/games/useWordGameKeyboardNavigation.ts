import { useEffect } from 'react';

/**
 * Shared hook for keyboard navigation and answer submission in word games.
 * Accepts a handler for keydown events and dependencies.
 */
export function useWordGameKeyboardNavigation(handleKeyDown: (e: KeyboardEvent) => void, deps: any[] = []) {
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
