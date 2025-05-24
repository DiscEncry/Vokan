"use client";

import type { Word, FSRSCard } from '@/types';
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is consistently imported
import { useAuth } from './AuthContext';
import { firestore } from '@/lib/firebase/firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Unsubscribe,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { FSRS, createEmptyCard, Rating } from 'ts-fsrs';
import { useToast } from '@/hooks/use-toast';

// Note: Trie and common word list logic (getCommonWordData, CommonWordData, getWordSuggestionsFromLoader)
// are removed as autocomplete is now handled by useAutocomplete hook.

const STORAGE_KEY = 'lexify-vocabulary';
export const MAX_WORD_LENGTH = 100; // Exporting for use in AddWordForm

const initialFSRSCard = (): FSRSCard => {
  // Use createEmptyCard from ts-fsrs v6 and convert Date fields to ISO string
  const card = createEmptyCard();
  return {
    ...card,
    due: new Date().toISOString(),
    last_review: undefined,
    state: typeof card.state === 'number' ? ['New', 'Learning', 'Review', 'Relearning'][card.state] as FSRSCard['state'] : card.state,
  };
};

interface VocabularyContextType {
  words: Word[];
  addWord: (text: string) => Promise<boolean>;
  addWordsBatch: (texts: string[]) => Promise<number>;
  updateWordSRS: (wordId: string, rating: number) => Promise<boolean>;
  deleteWord: (wordId: string) => Promise<boolean>;
  getWordById: (wordId: string) => Word | undefined;
  getDecoyWords: (targetWordId: string, count: number) => Word[];
  isLoading: boolean;
  isSyncing: boolean;
  isLocalOnly: boolean;
}

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

const initialWords: Word[] = [];

const loadFromStorage = (): Word[] => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      if (Array.isArray(parsedData) && parsedData.every(item =>
        typeof item === 'object' && 'id' in item && 'text' in item && 'dateAdded' in item && 'fsrsCard' in item
      )) {
        return parsedData;
      }
    }
    console.warn("[VocabularyContext] Invalid data structure in localStorage, using initial words.");
    return initialWords;
  } catch (error) {
    console.error("[VocabularyContext] Failed to load words from localStorage:", error);
    return initialWords;
  }
};

const saveToStorage = (data: Word[]): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("[VocabularyContext] Failed to save words to localStorage:", error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn("[VocabularyContext] LocalStorage quota exceeded. Cannot save words locally.");
    }
    return false;
  }
};

export const VocabularyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const isLocalOnly = !user;

  // Abuse prevention: simple in-memory rate limit for addWord
  const addWordTimestamps = useRef<number[]>([]);

  const addWord = useCallback(async (text: string): Promise<boolean> => {
    // Abuse prevention: limit to 10 adds per minute
    const now = Date.now();
    addWordTimestamps.current = addWordTimestamps.current.filter(ts => now - ts < 60000);
    if (addWordTimestamps.current.length >= 10) {
      toast({ title: 'Rate limit', description: 'You are adding words too quickly. Please wait a moment.', variant: 'destructive' });
      return false;
    }
    addWordTimestamps.current.push(now);
    if (!text?.trim() || text.trim().length > MAX_WORD_LENGTH) return false;
    const normalizedText = text.trim();
    if (words.some(w => w.text.toLowerCase() === normalizedText.toLowerCase())) return false;
    const newWord: Word = {
      id: uuidv4(),
      text: normalizedText,
      dateAdded: new Date().toISOString(),
      fsrsCard: initialFSRSCard(),
    };
    try {
      if (user && firestore) {
        setIsSyncing(true);
        const wordDoc = firestore ? doc(firestore, `users/${user.uid}/words/${newWord.id}`) : null;
        if (wordDoc) await setDoc(wordDoc, newWord);
      } else {
        setWords(prevWords => [newWord, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return true;
    } catch (error) {
      console.error("[VocabularyContext] Error adding word:", error);
      toast({ title: 'Error', description: 'Failed to add word. Please try again.', variant: 'destructive' });
      if (!user) {
        setWords(prevWords => [newWord, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return false;
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [words, user, toast]);

  const addWordsBatch = useCallback(async (texts: string[]): Promise<number> => {
    if (!texts?.length) return 0;
    const newWords: Word[] = texts
      .map(text => text.trim())
      .filter(text => text && !words.some(w => w.text.toLowerCase() === text.toLowerCase()))
      .map(text => ({
        id: uuidv4(),
        text,
        dateAdded: new Date().toISOString(),
        fsrsCard: initialFSRSCard(),
      }));
    try {
      if (user && firestore) {
        setIsSyncing(true);
        const promises = newWords.map(word => {
          const wordDoc = firestore ? doc(firestore, `users/${user.uid}/words/${word.id}`) : null;
          return wordDoc ? setDoc(wordDoc, word) : Promise.resolve();
        });
        await Promise.all(promises);
      } else {
        setWords(prevWords => [...newWords, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return newWords.length;
    } catch (error) {
      console.error("[VocabularyContext] Error adding words batch:", error);
      toast({ title: 'Error', description: 'Failed to add some words. Please try again.', variant: 'destructive' });
      if (!user) {
        setWords(prevWords => [...newWords, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return 0;
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [words, user, toast]);

  // Update SRS state for a word after a review
  const updateWordSRS = useCallback(async (wordId: string, rating: number) => {
    // Guard: FSRS rating 0 (Manual) is invalid for review. Coerce to 1 (Again).
    let safeRating = rating;
    if (rating === 0) safeRating = 1; // 1 = Again
    const targetWord = words.find(word => word.id === wordId);
    if (!targetWord) return false;
    // Use FSRS v6 recommended parameters
    const scheduler = new FSRS({
      request_retention: 0.9,
      maximum_interval: 36500,
      enable_fuzz: true,
      enable_short_term: true,
      // v6: learning_steps and relearning_steps can be in hours/minutes
      learning_steps: ['5m', '30m', '12h'],
      relearning_steps: ['10m', '1h'],
      // v6: w, b, d, r, s, lapse, recall, forget, etc. can be tuned or left as default
      // If you want to tune, add them here
    });
    const now = new Date();
    // v6: scheduler.next returns { card, log }
    const { card: updatedCard } = scheduler.next({ ...targetWord.fsrsCard, due: new Date(targetWord.fsrsCard.due) }, now, safeRating);
    // Determine reviewChange direction
    let reviewChange: 'up' | 'down' | 'none' = 'none';
    const prevState = targetWord.fsrsCard.state;
    const newState = typeof updatedCard.state === 'number'
      ? ['New', 'Learning', 'Review', 'Relearning'][updatedCard.state] as FSRSCard['state']
      : updatedCard.state;
    // Only count transitions between main states (not learning_steps)
    const stateOrder = ['New', 'Learning', 'Review', 'Relearning'];
    const prevIdx = stateOrder.indexOf(prevState);
    const newIdx = stateOrder.indexOf(newState);
    if (prevIdx !== -1 && newIdx !== -1) {
      if (newIdx > prevIdx) reviewChange = 'up';
      else if (newIdx < prevIdx) reviewChange = 'down';
    }
    // Convert Date fields to ISO string for storage and ensure state is string union
    const fsrsCard: FSRSCard = {
      ...updatedCard,
      due: updatedCard.due instanceof Date ? updatedCard.due.toISOString() : String(updatedCard.due),
      last_review: updatedCard.last_review instanceof Date ? updatedCard.last_review.toISOString() : (updatedCard.last_review ? String(updatedCard.last_review) : undefined),
      state: newState,
      reviewChange,
    };
    try {
      if (user && firestore) {
        setIsSyncing(true);
        const wordDoc = firestore ? doc(firestore, `users/${user.uid}/words/${wordId}`) : null;
        if (wordDoc) await updateDoc(wordDoc, { fsrsCard });
      } else {
        setWords(prevWords => prevWords.map(w => w.id === wordId ? { ...w, fsrsCard } : w));
      }
      return true;
    } catch (error) {
      console.error("[VocabularyContext] Error updating SRS:", error);
      toast({ title: 'Error', description: 'Failed to update review state. Please try again.', variant: 'destructive' });
      if (!user) {
        setWords(prevWords => prevWords.map(w => w.id === wordId ? { ...w, fsrsCard: (w.fsrsCard || {}) } : w));
      }
      return false;
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [words, user, toast]);

  const deleteWord = useCallback(async (wordId: string): Promise<boolean> => {
    try {
      if (user && firestore) {
        setIsSyncing(true);
        const wordDoc = firestore ? doc(firestore, `users/${user.uid}/words/${wordId}`) : null;
        if (wordDoc) await deleteDoc(wordDoc);
      } else {
        setWords(prevWords => prevWords.filter(word => word.id !== wordId));
      }
      return true;
    } catch (error) {
      console.error("[VocabularyContext] Error deleting word:", error);
      toast({ title: 'Error', description: 'Failed to delete word. Please try again.', variant: 'destructive' });
      if (!user) {
        setWords(prevWords => prevWords.filter(word => word.id !== wordId));
      }
      return false;
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [words, user, toast]);

  const getWordById = useCallback((wordId: string): Word | undefined => {
    return words.find(word => word.id === wordId);
  }, [words]);

  const getDecoyWords = useCallback((targetWordId: string, count: number): Word[] => {
    const availableCount = Math.min(count, words.length > 0 ? words.length - 1 : 0);
    if (availableCount <= 0) return [];
    return words.filter(word => word.id !== targetWordId).sort(() => 0.5 - Math.random()).slice(0, availableCount);
  }, [words]);

  const contextValue = {
    words,
    addWord,
    addWordsBatch,
    updateWordSRS,
    deleteWord,
    getWordById,
    getDecoyWords,
    isLoading,
    isSyncing,
    isLocalOnly,
  };

  // Load words from localStorage on mount (if not using Firestore)
  useEffect(() => {
    if (!user) {
      const loaded = loadFromStorage();
      setWords(loaded);
      setIsLoading(false);
    }
  }, [user]);

  // Save words to localStorage whenever they change (if not using Firestore)
  useEffect(() => {
    if (!user) {
      saveToStorage(words);
    }
  }, [words, user]);

  return (
    <VocabularyContext.Provider value={contextValue}>
      {children}
    </VocabularyContext.Provider>
  );
};

export const useVocabulary = (): VocabularyContextType => {
  const context = useContext(VocabularyContext);
  if (context === undefined) {
    throw new Error('useVocabulary must be used within a VocabularyProvider');
  }
  return context;
};

// Selector hook for words (prevents unnecessary re-renders)
export function useWordsSelector<T>(selector: (words: Word[]) => T): T {
  const { words } = useVocabulary();
  const selected = useMemo(() => selector(words), [words, selector]);
  return selected;
}
