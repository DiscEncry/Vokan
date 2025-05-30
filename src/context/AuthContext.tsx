"use client";

import React, { createContext, useContext, useEffect, useReducer, useMemo, ReactNode } from 'react';
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
import { createUserProfile, registerUserWithUsername } from '@/lib/firebase/userProfile';
import { checkUsernameExists } from '@/lib/firebase/checkUsernameExists';
import type { UserProfile } from '@/types/userProfile';
import { checkAndUpdateRateLimit } from "@/ai/flows/rateLimitFirestore";
import { getUserProfile } from '@/lib/firebase/userProfile';

function generateRandomUsername() {
  const random = Math.random().toString(36).substring(2, 8);
  return `user-${random}`;
}

// In-memory brute-force protection (per session, per email)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 5 * 60 * 1000; // 5 minutes
const failedAttempts: Record<string, { count: number; lastFailed: number; lockedUntil?: number }> = {};

function isLockedOut(email: string) {
  const entry = failedAttempts[email];
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  return false;
}

function recordFailedAttempt(email: string) {
  const now = Date.now();
  if (!failedAttempts[email]) {
    failedAttempts[email] = { count: 1, lastFailed: now };
  } else {
    failedAttempts[email].count += 1;
    failedAttempts[email].lastFailed = now;
    if (failedAttempts[email].count >= MAX_FAILED_ATTEMPTS) {
      failedAttempts[email].lockedUntil = now + LOCKOUT_TIME_MS;
    }
  }
}

function resetFailedAttempts(email: string) {
  delete failedAttempts[email];
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    default:
      return error.message || 'Authentication failed.';
  }
}

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

  const signInWithProvider = async (
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
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('password')) {
            return {
              error: 'This email is registered with a password. Please sign in with your password, then link Google in your account settings.'
            };
          }
          return { error: 'This email is registered with another provider.' };
        }
        const mappedError = mapAuthError(error);
        dispatch({ type: 'SET_ERROR', error: mappedError });
        return { error: mappedError };
      }
    });
  };

  const RATE_LIMIT_ATTEMPTS = 10;
  const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<User | null> => {
    if (isLockedOut(email)) {
      dispatch({ type: 'SET_ERROR', error: `Too many failed attempts. Try again in 5 minutes.` });
      return null;
    }
    // Server-side rate limit check
    const rateLimitKey = `signin_${email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    // Placeholder: get user IP (should be set server-side or via trusted header)
    let userIp: string | undefined = undefined;
    // Example: if using Next.js API route, get from req.headers['x-forwarded-for']
    try {
      const rateLimit = await checkAndUpdateRateLimit({
        key: rateLimitKey,
        limit: RATE_LIMIT_ATTEMPTS,
        windowMs: RATE_LIMIT_WINDOW_MS,
        ip: userIp,
      });
      if (!rateLimit.allowed) {
        const retrySec = Math.ceil((rateLimit.retryAfter || 0) / 1000);
        dispatch({ type: 'SET_ERROR', error: `Too many sign-in attempts. Try again in ${retrySec} seconds.` });
        return null;
      }
    } catch (e) {
      // If rate limit check fails, fail safe (allow sign-in, but log error)
      console.error('Rate limit check failed', e);
    }
    return withRequestDeduplication(`signIn_email_${email}`, async () => {
      try {      if (!auth) throw new Error('Internal error: Auth not initialized.');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      resetFailedAttempts(email);
        dispatch({ type: 'SET_USER', user: userCredential.user });
        dispatch({ type: 'SET_ERROR', error: null });
        return userCredential.user;
      } catch (error: any) {
        recordFailedAttempt(email);
        const mappedError = mapAuthError(error);
        dispatch({ type: 'SET_ERROR', error: mappedError });
        return null;
      }
    });
  };

  const registerWithEmail = async (
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
          if (result.user) await result.user.delete();
          return { error: data.error || 'Registration failed.' };
        }
        return result.user;
      } catch (error: any) {
        const mappedError = mapAuthError(error);
        dispatch({ type: 'SET_ERROR', error: mappedError });
        return { error: mappedError };
      }
    }) as Promise<User | null | { error: string }>;
  };

  const clearError = () => dispatch({ type: 'SET_ERROR', error: null });

  const signOut = async (): Promise<void> => {
    return withRequestDeduplication('signOut', async () => {
      if (!auth) return;
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        console.error('Error signing out:', error);
        const mappedError = mapAuthError(error);
        dispatch({ type: 'SET_ERROR', error: mappedError });
      }
    });
  };

  const value = useMemo(
    () => ({
      user: state.user,
      isLoading: state.isLoading,
      error: state.error,
      signInWithProvider,
      signInWithEmail,
      registerWithEmail,
      clearError,
      signOut,
    }),
    [state.user, state.isLoading, state.error]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
