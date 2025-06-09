import { useState, useRef, useCallback } from 'react';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import type { GeneratedWordDetails } from '@/types';

/**
 * Hook for fetching and caching word details.
 */
export function useWordDetails() {
  const cache = useRef<Map<string, GeneratedWordDetails>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [details, setDetails] = useState<GeneratedWordDetails | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const fetchDetails = useCallback(async (word: string) => {
    setCurrentWord(word);
    if (cache.current.has(word)) {
      setDetails(cache.current.get(word)!);
      return;
    }
    setIsLoading(true);
    abortController.current?.abort();
    abortController.current = new AbortController();
    try {
      const result = await generateWordDetails({ word });
      cache.current.set(word, result);
      setDetails(result);
    } catch (e) {
      if ((e as any).name !== 'AbortError') {
        setDetails(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setDetails(null);
    setCurrentWord(null);
  }, []);

  // Only expose details if they match the current word
  const getDetails = (word: string) => {
    return currentWord === word ? details : null;
  };

  return { details, isLoading, fetchDetails, clear, getDetails, currentWord };
}
