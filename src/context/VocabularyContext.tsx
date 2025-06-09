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
  Timestamp,
  writeBatch,
  limit,
  getDocs,
  QueryDocumentSnapshot,
  Firestore // <-- Add this import for type casting
} from 'firebase/firestore';
import { FSRS, createEmptyCard, Rating } from 'ts-fsrs';
import { useToast } from '@/hooks/use-toast';
import { generateDecoyWords } from '@/lib/generateDecoyWords';
import { showStandardToast } from '@/lib/showStandardToast';

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
    last_review: null, // Use null instead of undefined for Firestore compatibility
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
}

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

// Remove all localStorage logic and local-only state

export const VocabularyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Abuse prevention: simple in-memory rate limit for addWord
  const addWordTimestamps = useRef<number[]>([]);

  const addWord = useCallback(async (text: string): Promise<boolean> => {
    const normalizedText = text.trim();
    if (!normalizedText || normalizedText.length > MAX_WORD_LENGTH) return false;
    // Prevent duplicate by text (case-insensitive)
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
        const wordDoc = doc(firestore as Firestore, `users/${user.uid}/words/${newWord.id}`);
        await setDoc(wordDoc, newWord);
        // No local setWords: Firestore onSnapshot will update state
      }
      return true;
    } catch (error) {
      console.error("[VocabularyContext] Error adding word:", error);
      showStandardToast(toast, 'error', 'Error', 'Failed to add word. Please try again.');
      return false;
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [words, user, toast]);

  const addWordsBatch = useCallback(async (texts: string[]): Promise<number> => {
    if (!texts?.length) return 0;
    // Remove duplicates in batch and against existing words
    const uniqueTexts = Array.from(new Set(texts.map(t => t.trim().toLowerCase())));
    const newWords: Word[] = uniqueTexts
      .filter(text => text && !words.some(w => w.text.toLowerCase() === text))
      .map(text => ({
        id: uuidv4(),
        text,
        dateAdded: new Date().toISOString(),
        fsrsCard: initialFSRSCard(),
      }));
    try {
      if (user && firestore) {
        setIsSyncing(true);
        const batch = writeBatch(firestore);
        newWords.forEach(word => {
          const wordDoc = doc(firestore as Firestore, `users/${user.uid}/words/${word.id}`);
          batch.set(wordDoc, word);
        });
        await batch.commit();
        // No local setWords: Firestore onSnapshot will update state
      }
      return newWords.length;
    } catch (error) {
      console.error("[VocabularyContext] Error adding words batch:", error);
      showStandardToast(toast, 'error', 'Error', 'Failed to add some words. Please try again.');
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
      last_review: updatedCard.last_review instanceof Date
        ? updatedCard.last_review.toISOString()
        : (updatedCard.last_review ? String(updatedCard.last_review) : null), // Use null instead of undefined
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
      showStandardToast(toast, 'error', 'Error', 'Failed to update review state. Please try again.');
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
      showStandardToast(toast, 'error', 'Error', 'Failed to delete word. Please try again.');
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
    return generateDecoyWords(words, targetWordId, count);
  }, [words]);

  // Fetch all words on user login
  useEffect(() => {
    if (!user || !firestore) {
      setWords([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const q = query(collection(firestore, `users/${user.uid}/words`), orderBy('dateAdded', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wordsData: Word[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
      setWords(wordsData);
      setIsLoading(false);
    }, (error) => {
      console.error('[VocabularyContext] Firestore onSnapshot error:', error);
      setIsLoading(false);
      showStandardToast(toast, 'error', 'Error', 'Failed to load words from server.');
    });
    return () => unsubscribe();
  }, [user, firestore, toast]);

  const contextValue = useMemo(() => ({
    words,
    addWord,
    addWordsBatch,
    updateWordSRS,
    deleteWord,
    getWordById,
    getDecoyWords,
    isLoading,
    isSyncing,
  }), [words, addWord, addWordsBatch, updateWordSRS, deleteWord, getWordById, getDecoyWords, isLoading, isSyncing]);

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
