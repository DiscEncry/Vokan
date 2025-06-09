"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, getFirestore, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

export interface UserPreferences {
  dailyReminders: boolean;
  soundEffects: boolean;
  shareProgress: boolean;
  reviewNotifications: boolean;
  loginNotifications: boolean;
  darkMode: 'light' | 'dark' | 'system';
}

export const defaultPreferences: UserPreferences = {
  dailyReminders: false,
  soundEffects: true,
  shareProgress: false,
  reviewNotifications: true,
  loginNotifications: true,
  darkMode: 'system'
};

async function initializeUserPreferences(user: User): Promise<void> {
  try {
    const db = getFirestore();
    const prefsDoc = doc(db, 'userPreferences', user.uid);
    const docSnap = await getDoc(prefsDoc);
    if (!docSnap.exists()) {
      await setDoc(prefsDoc, defaultPreferences);
    }
  } catch (error) {
    console.error('Error initializing user preferences:', error);
    throw error;
  }
}

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setPreferences(defaultPreferences);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupPreferences = async () => {
      try {
        const db = getFirestore();
        const prefsDoc = doc(db, 'userPreferences', user.uid);
        
        // First check if the document exists
        const docSnap = await getDoc(prefsDoc);
        if (!docSnap.exists()) {
          await setDoc(prefsDoc, defaultPreferences);
        }

        // Set up real-time listener
        unsubscribe = onSnapshot(
          prefsDoc,
          (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              // Validate and merge with defaults
              const validatedPrefs = Object.keys(defaultPreferences).reduce((acc, key) => {
                const k = key as keyof UserPreferences;
                if (k === 'darkMode') {
                  acc[k] = ['light', 'dark', 'system'].includes(data[k] as string)
                    ? (data[k] as 'light' | 'dark' | 'system')
                    : defaultPreferences[k];
                } else {
                  acc[k] = typeof data[k] === 'boolean' ? data[k] : defaultPreferences[k];
                }
                return acc;
              }, { ...defaultPreferences });

              setPreferences(validatedPrefs);
              setError(null);
            } else {
              setPreferences(defaultPreferences);
            }
            setLoading(false);
          },
          (err) => {
            console.error('Error fetching preferences:', err);
            setError(err as Error);
            setPreferences(defaultPreferences);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up preferences:', err);
        setError(err as Error);
        setPreferences(defaultPreferences);
        setLoading(false);
      }
    };

    setupPreferences();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> => {
    if (!user) return;

    try {
      const db = getFirestore();
      const prefsDoc = doc(db, 'userPreferences', user.uid);
      await updateDoc(prefsDoc, { [key]: value });
      setPreferences(prev => ({ ...prev, [key]: value }));
      setError(null);
    } catch (err) {
      console.error('Error updating preference:', err);
      setError(err as Error);
      throw err;
    }
  };

  return {
    preferences,
    loading,
    error,
    updatePreference
  };
}
