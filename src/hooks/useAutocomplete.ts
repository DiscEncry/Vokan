// src/hooks/useAutocomplete.ts
import { useState, useEffect, useCallback } from 'react';
import { wordCache } from '@/lib/wordCache'; // Adjusted path

const MAX_SUGGESTIONS = 50;

export function useAutocomplete(input: string = '') {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async (currentInput: string) => {
    if (!currentInput.trim()) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const firstLetter = currentInput.charAt(0).toLowerCase();

    if (!/^[a-z]$/.test(firstLetter)) {
        setSuggestions([]);
        setLoading(false);
        setError("Word list is indexed by single letters a-z.");
        return;
    }
    
    let wordChunk: string[] | undefined;
    try {
      wordChunk = await wordCache.getChunk(firstLetter);

      if (!wordChunk) {
        console.log(`[useAutocomplete] Chunk for '${firstLetter}' not in cache. Fetching...`);
        const response = await fetch(`/wordlists/chunks/${firstLetter}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch word chunk for '${firstLetter}': ${response.status} ${response.statusText}`);
        }
        wordChunk = await response.json();
        if (!Array.isArray(wordChunk)) {
            throw new Error(`Fetched data for '${firstLetter}' is not an array.`);
        }
        await wordCache.saveChunk(firstLetter, wordChunk);
        console.log(`[useAutocomplete] Fetched and cached chunk for '${firstLetter}'.`);
      }

      if (wordChunk) {
        const matchedWords = wordChunk
          .filter(word => word.toLowerCase().startsWith(currentInput.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS);
        setSuggestions(matchedWords);
      } else {
        setSuggestions([]); // Should not happen if fetch is successful
      }
    } catch (err) {
      console.error('[useAutocomplete] Error fetching suggestions:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Debounce the fetch operation
    const debounceTimer = setTimeout(() => {
      fetchSuggestions(trimmedInput);
    }, 150); // Debounce time of 150ms

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [input, fetchSuggestions]);

  return { suggestions, loading, error };
}
