"use client";

import type { Word, FamiliarityLevel } from '@/types';
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { firestore } from '@/lib/firebase/firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Unsubscribe
} from 'firebase/firestore';

// Define storage key constant to avoid repetition and typos
const STORAGE_KEY = 'lexify-vocabulary';

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

/**
 * Safely loads data from localStorage with error handling
 */
const loadFromStorage = (): Word[] => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      // Validate data structure
      if (Array.isArray(parsedData) && parsedData.every(item => 
        typeof item === 'object' && 
        'id' in item && 
        'text' in item && 
        'dateAdded' in item && 
        'familiarity' in item
      )) {
        return parsedData;
      }
      console.warn("Invalid data structure in localStorage, using initial words");
    }
    return initialWords;
  } catch (error) {
    console.error("Failed to load words from localStorage:", error);
    return initialWords;
  }
};

/**
 * Safely saves data to localStorage with error handling
 */
const saveToStorage = (data: Word[]): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Failed to save words to localStorage:", error);
    
    // Handle quota exceeded errors specifically
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn("LocalStorage quota exceeded. Attempting to save only essential data.");
      try {
        // Try saving without lastReviewed data to reduce size
        const essentialData = data.map(({id, text, dateAdded, familiarity}) => ({
          id, text, dateAdded, familiarity
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialData));
        return true;
      } catch (innerError) {
        console.error("Still failed to save essential data:", innerError);
      }
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

  // Load words based on authentication state
  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;
    
    const loadWords = async () => {
      setIsLoading(true);
      
      try {
        // If user is authenticated and Firestore is available, load from cloud
        if (user && firestore) {
          const wordsCollection = collection(firestore, `users/${user.uid}/words`);
          const wordsQuery = query(wordsCollection, orderBy('dateAdded', 'desc'));
          
          // Setup real-time listener
          unsubscribe = onSnapshot(wordsQuery, (snapshot) => {
            const cloudWords: Word[] = [];
            snapshot.forEach((doc) => {
              cloudWords.push({ id: doc.id, ...doc.data() } as Word);
            });
            setWords(cloudWords);
            setIsLoading(false);
          }, (error) => {
            console.error("Error fetching words from Firestore:", error);
            // Fall back to localStorage if Firestore fails
            const localWords = loadFromStorage();
            setWords(localWords);
            setIsLoading(false);
          });
        } else {
          // Load from localStorage for anonymous users
          const localWords = loadFromStorage();
          setWords(localWords);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading words:", error);
        // Always fall back to localStorage in case of errors
        const localWords = loadFromStorage();
        setWords(localWords);
        setIsLoading(false);
      }
    };

    loadWords();
    
    // Clean up listener on unmount or when authentication state changes
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Save words to localStorage (as backup) whenever they change, if not loading
  useEffect(() => {
    if (!isLoading && words.length > 0) {
      saveToStorage(words);
    }
  }, [words, isLoading]);

  /**
   * Add a single word to vocabulary
   * @returns Promise<boolean> indicating success
   */
  const addWord = useCallback(async (text: string): Promise<boolean> => {
    if (!text?.trim()) return false;
    
    const normalizedText = text.trim();
    
    // Check for duplicates (case-insensitive)
    if (words.some(w => w.text.toLowerCase() === normalizedText.toLowerCase())) {
      return false;
    }
    
    const newWord: Word = {
      id: uuidv4(), // We'll use this as the doc ID for Firestore as well
      text: normalizedText,
      dateAdded: new Date().toISOString(),
      familiarity: 'New',
    };
    
    try {
      // If user is authenticated and Firestore is available, save to cloud
      if (user && firestore) {
        setIsSyncing(true);
        
        // Use the generated ID as the document ID in Firestore
        const wordDoc = doc(firestore, `users/${user.uid}/words/${newWord.id}`);
        await setDoc(wordDoc, newWord);
        
        // Firestore onSnapshot will update local state
        setIsSyncing(false);
        return true;
      } else {
        // For anonymous users, update state directly
        setWords(prevWords => [newWord, ...prevWords]);
        return true;
      }
    } catch (error) {
      console.error("Error adding word:", error);
      
      // Add to local state even if cloud sync fails
      setWords(prevWords => [newWord, ...prevWords]);
      setIsSyncing(false);
      return true;
    }
  }, [words, user]);

  /**
   * Add multiple words at once
   * @returns Promise<number> of words successfully added
   */
  const addWordsBatch = useCallback(async (texts: string[]): Promise<number> => {
    if (!texts?.length) return 0;
    
    const existingTexts = new Set(words.map(w => w.text.toLowerCase()));
    
    const newWords: Word[] = texts
      .map(text => text?.trim())
      .filter(Boolean)
      .filter(text => !existingTexts.has(text.toLowerCase()))
      .map(text => ({
        id: uuidv4(),
        text: text,
        dateAdded: new Date().toISOString(),
        familiarity: 'New' as FamiliarityLevel,
      }));
    
    if (newWords.length === 0) return 0;
    
    try {
      // If user is authenticated and Firestore is available, save to cloud
      if (user && firestore) {
        setIsSyncing(true);
        
        // Create a batch of promises for all the words
        const promises = newWords.map(word => {
          const wordDoc = doc(firestore, `users/${user.uid}/words/${word.id}`);
          return setDoc(wordDoc, word);
        });
        
        await Promise.all(promises);
        
        // Firestore onSnapshot will update local state
        setIsSyncing(false);
        return newWords.length;
      } else {
        // For anonymous users, update state directly
        setWords(prevWords => [...newWords, ...prevWords]);
        return newWords.length;
      }
    } catch (error) {
      console.error("Error adding words batch:", error);
      
      // Add to local state even if cloud sync fails
      setWords(prevWords => [...newWords, ...prevWords]);
      setIsSyncing(false);
      return newWords.length;
    }
  }, [words, user]);

  /**
   * Update a word's familiarity level
   * @returns Promise<boolean> indicating success
   */
  const updateWordFamiliarity = useCallback(async (wordId: string, familiarity: FamiliarityLevel): Promise<boolean> => {
    const targetWord = words.find(word => word.id === wordId);
    if (!targetWord) return false;
    
    const updatedFields = { 
      familiarity, 
      lastReviewed: new Date().toISOString() 
    };
    
    try {
      // If user is authenticated and Firestore is available, update in cloud
      if (user && firestore) {
        setIsSyncing(true);
        
        const wordDoc = doc(firestore, `users/${user.uid}/words/${wordId}`);
        await updateDoc(wordDoc, updatedFields);
        
        // Firestore onSnapshot will update local state
        setIsSyncing(false);
        return true;
      } else {
        // For anonymous users, update state directly
        setWords(prevWords => {
          return prevWords.map(word => {
            if (word.id === wordId) {
              return { ...word, ...updatedFields };
            }
            return word;
          });
        });
        return true;
      }
    } catch (error) {
      console.error("Error updating word familiarity:", error);
      
      // Update local state even if cloud sync fails
      setWords(prevWords => {
        return prevWords.map(word => {
          if (word.id === wordId) {
            return { ...word, ...updatedFields };
          }
          return word;
        });
      });
      setIsSyncing(false);
      return true;
    }
  }, [words, user]);

  /**
   * Delete a word
   * @returns Promise<boolean> indicating success
   */
  const deleteWord = useCallback(async (wordId: string): Promise<boolean> => {
    try {
      // If user is authenticated and Firestore is available, delete from cloud
      if (user && firestore) {
        setIsSyncing(true);
        
        const wordDoc = doc(firestore, `users/${user.uid}/words/${wordId}`);
        await deleteDoc(wordDoc);
        
        // Firestore onSnapshot will update local state
        setIsSyncing(false);
        return true;
      } else {
        // For anonymous users, update state directly
        setWords(prevWords => prevWords.filter(word => word.id !== wordId));
        return true;
      }
    } catch (error) {
      console.error("Error deleting word:", error);
      
      // Delete from local state even if cloud sync fails
      setWords(prevWords => prevWords.filter(word => word.id !== wordId));
      setIsSyncing(false);
      return true;
    }
  }, [user]);

  /**
   * Get a word by ID
   */
  const getWordById = useCallback((wordId: string): Word | undefined => {
    return words.find(word => word.id === wordId);
  }, [words]);

  /**
   * Get random decoy words (excluding the target word)
   */
  const getDecoyWords = useCallback((targetWordId: string, count: number): Word[] => {
    // Ensure we don't try to get more decoys than available
    const availableCount = Math.min(count, words.length - 1);
    
    if (availableCount <= 0) return [];
    
    return words
      .filter(word => word.id !== targetWordId)
      .sort(() => 0.5 - Math.random()) // Shuffle
      .slice(0, availableCount);
  }, [words]);

  /**
   * Get words with specified familiarity level(s)
   */
  const getWordsWithFamiliarity = useCallback((familiarity: FamiliarityLevel | FamiliarityLevel[]): Word[] => {
    const familiaritySet = Array.isArray(familiarity) 
      ? new Set(familiarity)
      : new Set([familiarity]);
    
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
    isLocalOnly
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
