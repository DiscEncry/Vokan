import { useState, useEffect, useCallback, useRef } from 'react';
import type { Word } from '@/types';
import { useVocabulary } from '@/context/VocabularyContext';
import { isDue } from '@/lib/utils';

/**
 * Shared game engine hook for word-based games (Cloze, TextInput, etc).
 * Handles lifecycle, abort controllers, safe state, and word selection.
 */
export function useGameEngine({ minWords = 1, excludeWordIds = [] }: { minWords?: number; excludeWordIds?: string[] }) {
  const { words: libraryWords, isLoading: vocabLoading } = useVocabulary();
  const isMounted = useRef(true);
  const [gameInitialized, setGameInitialized] = useState(false);

  // Helper for safe state updates
  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T | ((prev: T) => T)) => {
    if (isMounted.current) setter(value);
  }, []);

  // Mount/unmount effect
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Word selection logic
  const hasEnoughWords = libraryWords.length >= minWords;
  
  const selectTargetWord = useCallback((excludeIds: string[] = []) => {
    if (!hasEnoughWords) return null;
    let eligible = libraryWords.filter(w => !excludeIds.includes(w.id));
    if (eligible.length === 0) return null;
    // Prioritize due words
    const dueWords = eligible.filter(w => isDue(w.fsrsCard.due));
    if (dueWords.length > 0) {
      return dueWords[Math.floor(Math.random() * dueWords.length)];
    }
    return eligible[Math.floor(Math.random() * eligible.length)];
  }, [libraryWords, hasEnoughWords]);

  return {
    libraryWords,
    isMounted,
    gameInitialized,
    setGameInitialized,
    safeSetState,
    hasEnoughWords,
    selectTargetWord,
    vocabLoading,
  };
}
