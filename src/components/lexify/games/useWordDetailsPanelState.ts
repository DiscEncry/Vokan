import { useState, useCallback } from 'react';

/**
 * Shared hook for managing word details panel state in both games.
 * Handles which word's details to show and when to show the panel.
 */
export function useWordDetailsPanelState() {
  const [showDetails, setShowDetails] = useState(false);
  const [detailsWord, setDetailsWord] = useState<string | null>(null);

  // Call this after an answer is submitted
  const showPanelForWord = useCallback((word: string) => {
    setDetailsWord(word);
    setShowDetails(true);
  }, []);

  // Call this when loading a new question
  const resetPanel = useCallback(() => {
    setShowDetails(false);
    setDetailsWord(null);
  }, []);

  return { showDetails, detailsWord, showPanelForWord, resetPanel };
}
