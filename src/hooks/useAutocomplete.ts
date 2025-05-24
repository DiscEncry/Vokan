
// src/hooks/useAutocomplete.ts
import { useState, useEffect, useCallback } from 'react';
import { wordCache } from '@/lib/wordCache'; // Ensure this path is correct

export function useAutocomplete(inputValue: string = '') {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // This state will hold the input value that directly corresponds to the current suggestions/loading/error states.
  // Initialize with the trimmed version of the initial inputValue.
  const [processedInput, setProcessedInput] = useState<string>(() => (inputValue || '').trim());

  const fetchSuggestionsCallback = useCallback(async (currentInputToFetch: string) => {
    // currentInputToFetch is expected to be already trimmed by the calling useEffect
    if (typeof window === 'undefined') {
      // SSR: Do not attempt to fetch or use IndexedDB.
      // Set to a state that reflects no operation was performed.
      setSuggestions([]);
      setLoading(false);
      setError(null);
      // processedInput is already set by useEffect to reflect currentInputToFetch
      return;
    }

    setLoading(true);
    setError(null);
    // processedInput is set by useEffect before this callback is invoked via setTimeout

    const firstLetter = currentInputToFetch.charAt(0).toLowerCase();

    if (!currentInputToFetch) {
        setSuggestions([]);
        setLoading(false);
        // No error state needed for empty input
        return;
    }

    if (!/^[a-z]$/.test(firstLetter) && currentInputToFetch.length > 0) {
        setSuggestions([]);
        setError("Word list is indexed by single letters a-z.");
        setLoading(false);
        return;
    }

    try {
      let wordChunk = await wordCache.getChunk(firstLetter);
      if (!wordChunk) {
        // console.log(`[useAutocomplete] Chunk for '${firstLetter}' not in cache. Fetching...`);
        const response = await fetch(`/wordlists/chunks/${firstLetter}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch word chunk for '${firstLetter}': ${response.statusText}`);
        }
        const jsonData = await response.json();
        if (!Array.isArray(jsonData)) { // Check if jsonData is an array
             throw new Error(`Fetched data for '${firstLetter}' is not an array.`);
        }
        wordChunk = jsonData as string[]; // Type assertion
        await wordCache.saveChunk(firstLetter, wordChunk);
        // console.log(`[useAutocomplete] Fetched and cached chunk for '${firstLetter}'.`);
      }

      const matchedWords = (wordChunk || [])
        .filter(word => typeof word === 'string' && word.trim().toLowerCase().startsWith(currentInputToFetch.toLowerCase()))
        .map(word => word.trim()) // Ensure suggestions are trimmed
        .slice(0, 50);
      
      setSuggestions(matchedWords);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred fetching suggestions.');
      setSuggestions([]); // Clear suggestions on error
      console.error('[useAutocomplete] Error fetching suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array as it doesn't depend on component state/props directly

  useEffect(() => {
    const trimmedInputValue = (inputValue || '').trim();
    
    // Synchronize processedInput with the current trimmedInputValue.
    // This ensures that the `suggestionInput` returned by the hook (which is `processedInput`)
    // always reflects the input that is about to be (or was just) processed.
    setProcessedInput(trimmedInputValue);

    if (typeof window === 'undefined') {
      // On SSR, after setting processedInput, clear other states as no fetch will occur.
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!trimmedInputValue) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    // Set loading to true before starting the debounce timer if we intend to fetch.
    // This gives immediate feedback that something is happening.
    setLoading(true); 
    setError(null); // Clear previous errors

    const debounceTimer = setTimeout(() => {
      fetchSuggestionsCallback(trimmedInputValue);
    }, 150);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [inputValue, fetchSuggestionsCallback]);

  // The hook returns `processedInput` as `suggestionInput`.
  // This `processedInput` is guaranteed to be a string.
  return {
    suggestions,
    loading,
    error,
    suggestionInput: processedInput
  };
}
