"use client";

import React, { createContext, useContext, useEffect, useReducer, useMemo, ReactNode, useCallback } from 'react';
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
  sendEmailVerification,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/firebaseConfig';
import { createUserProfile, registerUserWithUsername, getUserProfile } from '@/lib/firebase/userProfile';
import { checkUsernameExists } from '@/lib/firebase/checkUsernameExists';
import type { UserProfile } from '@/types/userProfile';

function generateRandomUsername() {
  const random = Math.random().toString(36).substring(2, 8);
  return `user-${random}`;
}

// Auth state and action types
interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  pendingRequests: Set<string>;
}

type AuthAction =
  | { type: 'SET_USER'; user: User | null }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'ADD_PENDING_REQUEST'; requestId: string }
  | { type: 'REMOVE_PENDING_REQUEST'; requestId: string };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signInWithProvider: (provider: 'google', passwordToLink?: string) => Promise<User | null | { isNewUser?: boolean; showWelcome?: boolean; email?: string; error?: string; uid?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  registerWithEmail: (email: string, password: string, username?: string) => Promise<User | null | { error: string }>;
  clearError: () => void;
  signOut: () => Promise<void>;
}

/**
 * AuthContext provides authentication state and actions for the app.
 * Handles user sign-in, registration, provider login, and session management.
 * Uses reducer for predictable state updates and deduplication for concurrent requests.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Reducer for authentication state. Handles user, loading, error, and pending requests.
 */
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.user };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'ADD_PENDING_REQUEST':
      return {
        ...state,
        pendingRequests: new Set([...state.pendingRequests, action.requestId])
      };
    case 'REMOVE_PENDING_REQUEST': {
      const newRequests = new Set(state.pendingRequests);
      newRequests.delete(action.requestId);
      return { ...state, pendingRequests: newRequests };
    }
    default:
      return state;
  }
}

/**
 * Maps Firebase Auth errors to user-friendly messages.
 */
function mapAuthError(error: any): string {
  if (!error) return 'Unknown error.';
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in or use a different email.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/weak-password':
      return 'Password is too weak.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/account-exists-with-different-credential':
      return 'Account exists with a different sign-in method. Please use the correct provider.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    default:
      return error.message || 'Authentication failed.';
  }
}

/**
 * AuthProvider wraps the app and provides authentication context.
 * Handles auth state changes, sign-in, registration, and sign-out.
 * Uses deduplication to prevent duplicate requests.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isLoading: true,
    error: null,
    pendingRequests: new Set<string>()
  });

  const withRequestDeduplication = async <T,>(
    requestId: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    if (state.pendingRequests.has(requestId)) {
      throw new Error('Operation already in progress');
    }
    
    try {
      dispatch({ type: 'ADD_PENDING_REQUEST', requestId });
      dispatch({ type: 'SET_LOADING', isLoading: true });
      const result = await operation();
      return result;
    } finally {
      dispatch({ type: 'REMOVE_PENDING_REQUEST', requestId });
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  };

  useEffect(() => {
    if (!auth) {
      console.error('Firebase auth is not initialized');
      dispatch({ type: 'SET_LOADING', isLoading: false });
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      dispatch({ type: 'SET_USER', user });
      dispatch({ type: 'SET_LOADING', isLoading: false });
    });
    
    return () => unsubscribe();
  }, []);

  const signInWithProvider = useCallback(async (
    providerType: 'google',
    passwordToLink?: string
  ): Promise<User | null | { isNewUser?: boolean; showWelcome?: boolean; email?: string; error?: string; uid?: string }> => {
    return withRequestDeduplication(`signIn_${providerType}`, async () => {
      if (!auth) return { error: 'Internal error: Auth not initialized.' };
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const email = result.user.email!;
        const uid = result.user.uid;
        // Check if user profile exists
        let profile = await getUserProfile(uid);
        let isNewUser = false;
        if (!profile) {
          // New user: create random username and profile
          isNewUser = true;
          const username = generateRandomUsername();
          profile = {
            uid,
            email,
            username,
            createdAt: new Date().toISOString(),
            provider: 'google',
          };
          await createUserProfile(profile);
        }
        // Optionally link password if provided
        if (passwordToLink) {
          await linkWithCredential(result.user, EmailAuthProvider.credential(email, passwordToLink));
        }
        // Always return showWelcome for new users
        if (isNewUser) {
          return { isNewUser: true, showWelcome: true, email, uid };
        }
        return result.user;
      } catch (error: any) {
        if (error.code === 'auth/account-exists-with-different-credential') {
          const email = error.customData?.email || error.email;
          const pendingCred = GoogleAuthProvider.credentialFromError?.(error);
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('password') && pendingCred) {
            // Instead of returning an error, prompt for password and link automatically
            // We'll return a special object to trigger the password prompt in the UI
            return {
              error: undefined,
              requirePasswordToLink: true,
              email,
              pendingCred,
            };
          }
          return { error: 'This email is registered with another provider.' };
        }
        const mappedError = mapAuthError(error);
        dispatch({ type: 'SET_ERROR', error: mappedError });
        return { error: mappedError };
      }
    });
  }, [state, dispatch]);

  const signInWithEmail = useCallback(async (
    email: string,
    password: string
  ): Promise<User | null> => {
    return withRequestDeduplication(`signIn_email_${email}`, async () => {
      try {
        if (!auth) throw new Error('Internal error: Auth not initialized.');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        dispatch({ type: 'SET_USER', user: userCredential.user });
        dispatch({ type: 'SET_ERROR', error: null });
        return userCredential.user;
      } catch (error: any) {
        const mappedError = mapAuthError(error);
        dispatch({ type: 'SET_ERROR', error: mappedError });
        return null;
      }
    });
  }, [state, dispatch]);

  const registerWithEmail = useCallback(async (
    email: string,
    password: string,
    username?: string
  ): Promise<User | null | { error: string }> => {
    return withRequestDeduplication(`register_${email}`, async () => {
      if (!auth) return { error: 'Internal error: Auth not initialized.' };
      if (!username) return { error: 'Username is required.' };
      try {
        // Create Firebase Auth user first
        const result = await createUserWithEmailAndPassword(auth, email, password);
        // Call secure API route for atomic registration and rate limiting
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password, // Optionally send for server-side validation, or omit if not needed
            username,
            uid: result.user.uid,
            provider: 'password',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Optionally: delete the Firebase user if registration fails
          let errorMsg = 'Registration failed. Please try again.';
          if (data.error === 'Username already taken') {
            errorMsg = 'This username is already taken. Please choose another.';
          } else if (data.error) {
            errorMsg = data.error;
          }
          return { error: errorMsg };
        }
        dispatch({ type: 'SET_USER', user: result.user });
        dispatch({ type: 'SET_ERROR', error: null });
        return result.user;
      } catch (error: any) {
        const mappedError = mapAuthError(error);
        dispatch({ type: 'SET_ERROR', error: mappedError });
        return { error: mappedError };
      }
    });
  }, [state, dispatch]);

  const signOut = useCallback(async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    dispatch({ type: 'SET_USER', user: null });
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, [dispatch]);

  const value = useMemo(() => ({
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    signInWithProvider,
    signInWithEmail,
    registerWithEmail,
    clearError,
    signOut,
  }), [state.user, state.isLoading, state.error, signInWithProvider, signInWithEmail, registerWithEmail, clearError, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access AuthContext.
 * Throws if used outside AuthProvider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
