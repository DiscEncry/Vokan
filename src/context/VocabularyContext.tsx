
"use client";

import type { Word, FamiliarityLevel } from '@/types';
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
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
// Note: Trie and common word list logic (getCommonWordData, CommonWordData, getWordSuggestionsFromLoader)
// are removed as autocomplete is now handled by useAutocomplete hook.

const STORAGE_KEY = 'lexify-vocabulary';
export const MAX_WORD_LENGTH = 100; // Exporting for use in AddWordForm

interface VocabularyContextType {
  words: Word[];
  addWord: (text: string) => Promise<boolean>;
  addWordsBatch: (texts: string[]) => Promise<number>;
  updateWordFamiliarity: (wordId: string, familiarity: FamiliarityLevel) => Promise<boolean>;
  deleteWord: (wordId: string) => Promise<boolean>;
  getWordById: (wordId: string) => Word | undefined;
  getDecoyWords: (targetWordId: string, count: number) => Word[];
  getWordsWithFamiliarity: (familiarity: FamiliarityLevel | FamiliarityLevel[]) => Word[];
  isLoading: boolean;
  isSyncing: boolean;
  isLocalOnly: boolean;
}

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

const initialWords: Word[] = [
  { id: uuidv4(), text: "ephemeral", dateAdded: new Date().toISOString(), familiarity: "New" },
  { id: uuidv4(), text: "ubiquitous", dateAdded: new Date().toISOString(), familiarity: "Learning" },
  { id: uuidv4(), text: "serendipity", dateAdded: new Date().toISOString(), familiarity: "Familiar" },
  { id: uuidv4(), text: "eloquent", dateAdded: new Date().toISOString(), familiarity: "Mastered" },
  { id: uuidv4(), text: "resilient", dateAdded: new Date().toISOString(), familiarity: "New" },
];

const loadFromStorage = (): Word[] => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      if (Array.isArray(parsedData) && parsedData.every(item =>
        typeof item === 'object' && 'id' in item && 'text' in item && 'dateAdded' in item && 'familiarity' in item
      )) {
        return parsedData;
      }
      console.warn("[VocabularyContext] Invalid data structure in localStorage, using initial words.");
    }
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
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const isLocalOnly = !user;

  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;
    const loadWords = async () => {
      setIsLoading(true);
      try {
        if (user && firestore) {
          const wordsCollection = collection(firestore, `users/${user.uid}/words`);
          const wordsQuery = query(wordsCollection, orderBy('dateAdded', 'desc'));
          unsubscribe = onSnapshot(wordsQuery, (snapshot) => {
            const cloudWords: Word[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
            setWords(cloudWords);
            setIsLoading(false);
          }, (error) => {
            console.error("[VocabularyContext] Error fetching words from Firestore:", error);
            setWords(loadFromStorage());
            setIsLoading(false);
          });
        } else {
          setWords(loadFromStorage());
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[VocabularyContext] Error in loadWords effect:", error);
        setWords(loadFromStorage());
        setIsLoading(false);
      }
    };
    loadWords();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!isLoading && isLocalOnly && words.length > 0) {
      saveToStorage(words);
    }
  }, [words, isLoading, isLocalOnly]);

  const addWord = useCallback(async (text: string): Promise<boolean> => {
    if (!text?.trim() || text.trim().length > MAX_WORD_LENGTH) return false;
    const normalizedText = text.trim();
    if (words.some(w => w.text.toLowerCase() === normalizedText.toLowerCase())) return false;

    const newWord: Word = {
      id: uuidv4(),
      text: normalizedText,
      dateAdded: new Date().toISOString(),
      familiarity: 'New',
    };

    try {
      if (user && firestore) {
        setIsSyncing(true);
        const wordDoc = doc(firestore, `users/${user.uid}/words/${newWord.id}`);
        await setDoc(wordDoc, newWord);
        // Firestore onSnapshot will update local state
      } else {
        setWords(prevWords => [newWord, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return true;
    } catch (error) {
      console.error("[VocabularyContext] Error adding word:", error);
      if (!user) { // If local, still add to local state on error
         setWords(prevWords => [newWord, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return false; // Indicate failure to cloud, but local might have updated
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [words, user]);

  const addWordsBatch = useCallback(async (texts: string[]): Promise<number> => {
    if (!texts?.length) return 0;
    const existingTexts = new Set(words.map(w => w.text.toLowerCase()));
    const newWords: Word[] = texts
      .map(text => text?.trim())
      .filter(Boolean)
      .filter(text => text.length <= MAX_WORD_LENGTH)
      .filter(text => !existingTexts.has(text.toLowerCase()))
      .map(text => ({
        id: uuidv4(),
        text: text,
        dateAdded: new Date().toISOString(),
        familiarity: 'New' as FamiliarityLevel,
      }));

    if (newWords.length === 0) return 0;

    try {
      if (user && firestore) {
        setIsSyncing(true);
        const promises = newWords.map(word => {
          const wordDoc = doc(firestore, `users/${user.uid}/words/${word.id}`);
          return setDoc(wordDoc, word);
        });
        await Promise.all(promises);
        // Firestore onSnapshot will update local state
      } else {
        setWords(prevWords => [...newWords, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return newWords.length;
    } catch (error) {
      console.error("[VocabularyContext] Error adding words batch:", error);
       if (!user) { // If local, still add to local state on error
        setWords(prevWords => [...newWords, ...prevWords].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()));
      }
      return 0; // Indicate failure count might be off
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [words, user]);

  const updateWordFamiliarity = useCallback(async (wordId: string, familiarity: FamiliarityLevel): Promise<boolean> => {
    const targetWord = words.find(word => word.id === wordId);
    if (!targetWord) return false;
    const updatedFields = { familiarity, lastReviewed: new Date().toISOString() };

    try {
      if (user && firestore) {
        setIsSyncing(true);
        const wordDoc = doc(firestore, `users/${user.uid}/words/${wordId}`);
        await updateDoc(wordDoc, updatedFields);
      } else {
        setWords(prevWords => prevWords.map(w => w.id === wordId ? { ...w, ...updatedFields } : w));
      }
      return true;
    } catch (error) {
      console.error("[VocabularyContext] Error updating word familiarity:", error);
      if(!user) {
         setWords(prevWords => prevWords.map(w => w.id === wordId ? { ...w, ...updatedFields } : w));
      }
      return false;
    } finally {
       if (user) setIsSyncing(false);
    }
  }, [words, user]);

  const deleteWord = useCallback(async (wordId: string): Promise<boolean> => {
    try {
      if (user && firestore) {
        setIsSyncing(true);
        const wordDoc = doc(firestore, `users/${user.uid}/words/${wordId}`);
        await deleteDoc(wordDoc);
      } else {
        setWords(prevWords => prevWords.filter(word => word.id !== wordId));
      }
      return true;
    } catch (error) {
      console.error("[VocabularyContext] Error deleting word:", error);
      if (!user) {
         setWords(prevWords => prevWords.filter(word => word.id !== wordId));
      }
      return false;
    } finally {
      if (user) setIsSyncing(false);
    }
  }, [user]); // Removed 'words' from deps as it causes re-renders affecting delete confirmation dialog

  const getWordById = useCallback((wordId: string): Word | undefined => {
    return words.find(word => word.id === wordId);
  }, [words]);

  const getDecoyWords = useCallback((targetWordId: string, count: number): Word[] => {
    const availableCount = Math.min(count, words.length > 0 ? words.length - 1 : 0);
    if (availableCount <= 0) return [];
    return words.filter(word => word.id !== targetWordId).sort(() => 0.5 - Math.random()).slice(0, availableCount);
  }, [words]);

  const getWordsWithFamiliarity = useCallback((familiarity: FamiliarityLevel | FamiliarityLevel[]): Word[] => {
    const familiaritySet = Array.isArray(familiarity) ? new Set(familiarity) : new Set([familiarity]);
    return words.filter(word => familiaritySet.has(word.familiarity));
  }, [words]);

  const contextValue = {
    words,
    addWord,
    addWordsBatch,
    updateWordFamiliarity,
    deleteWord,
    getWordById,
    getDecoyWords,
    getWordsWithFamiliarity,
    isLoading,
    isSyncing,
    isLocalOnly,
  };

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
