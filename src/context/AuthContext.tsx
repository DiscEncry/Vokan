"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  GoogleAuthProvider,
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/firebaseConfig';

// Update AuthContextType to match new signInWithProvider signature
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithProvider: (provider: 'google', passwordToLink?: string) => Promise<User | null | { needsPassword?: boolean; email?: string; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  registerWithEmail: (email: string, password: string) => Promise<User | null | { error: string }>;
  signOut: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) {
      console.error('Firebase auth is not initialized');
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Enhanced Google sign-in with account linking
  const signInWithProvider = async (
    providerType: 'google',
    passwordToLink?: string // Optional: for linking password after Google sign-in
  ): Promise<User | null | { needsPassword?: boolean; email?: string; error?: string }> => {
    try {
      if (!auth) {
        console.error('Firebase auth is not initialized');
        return { error: 'Internal error: Auth not initialized.' };
      }
      setIsLoading(true);
      let provider;
      if (providerType === 'google') {
        provider = new GoogleAuthProvider();
      } else {
        throw new Error('Unsupported provider');
      }
      let result;
      try {
        result = await signInWithPopup(auth, provider);
        // Check if user has a password sign-in method
        const email = result.user.email!;
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (!methods.includes('password') && !passwordToLink) {
          // Prompt user to set a password
          return { needsPassword: true, email };
        }
        // If passwordToLink is provided, link email/password to Google account
        if (passwordToLink) {
          const cred = EmailAuthProvider.credential(email, passwordToLink);
          await linkWithCredential(result.user, cred);
        }
        return result.user;
      } catch (error: any) {
        // Handle account-exists-with-different-credential
        if (error.code === 'auth/account-exists-with-different-credential') {
          const email = error.customData?.email || error.email;
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('password')) {
            // User registered with email/password, prompt to sign in with password and then link Google
            return { error: 'This email is registered with a password. Please sign in with your password, then link Google in your account settings.' };
          } else {
            // Other provider, handle as needed
            return { error: 'This email is registered with another provider.' };
          }
        }
        throw error;
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return { error: 'Google sign-in was cancelled.' };
      }
      return { error: error.message || 'Google sign-in failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in with email/password
  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<User | null> => {
    try {
      if (!auth) {
        console.error('Firebase auth is not initialized');
        return null;
      }
      setIsLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Error signing in with email:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Register with email/password
  const registerWithEmail = async (
    email: string,
    password: string
  ): Promise<User | null | { error: string }> => {
    try {
      if (!auth) {
        console.error('Firebase auth is not initialized');
        return { error: 'Internal error: Auth not initialized.' };
      }
      setIsLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error: any) {
      let errorMsg = 'Registration failed.';
      if (error?.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered. Please sign in or use a different email.';
      } else if (error?.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address.';
      } else if (error?.code === 'auth/weak-password') {
        errorMsg = 'Password is too weak.';
      }
      return { error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      if (!auth) {
        console.error('Firebase auth is not initialized');
        return;
      }

      setIsLoading(true);
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithProvider, signInWithEmail, registerWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
