"use client";
declare global {
  interface Window {
    __showingGoogleUsernameDialog?: boolean;
  }
}

import { ReactNode, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import GoogleUsernameForm from "@/components/auth/GoogleUsernameForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { checkUsernameExists } from "@/lib/firebase/checkUsernameExists";
import { createUserProfile } from "@/lib/firebase/userProfile";
import { auth } from '@/lib/firebase/firebaseConfig';
import { EmailAuthProvider, linkWithCredential, User } from 'firebase/auth';
import type { UserProfile } from '@/types/userProfile';
import { useUserProfile } from "@/hooks/useUserProfile";

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="mb-2">An unexpected error occurred. Please refresh the page or try again later.</p>
      <pre className="text-xs text-red-500 overflow-x-auto max-w-full">{error.message}</pre>
    </div>
  );
}

// Utility to delete the current Firebase Auth user (for canceling incomplete Google registration)
async function deleteCurrentUser() {
  if (auth?.currentUser) {
    try {
      await auth.currentUser.delete();
    } catch (err: any) {
      // If requires recent login, fallback to signOut
      await auth.signOut();
    }
  }
}

export default function ClientRoot({ children }: { children: ReactNode }) {
  // Global Google username dialog state
  const { user, isLoading, signInWithProvider, signOut } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [showGoogleUsernameDialog, setShowGoogleUsernameDialog] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<{ email: string; uid: string } | null>(null);
  const [googleUsernameLoading, setGoogleUsernameLoading] = useState(false);
  const [googleUsernameError, setGoogleUsernameError] = useState<string | null>(null);

  // Handler for Google username/password form submit
  const handleGoogleUsernameSubmit = async (username: string, password: string, confirm: string) => {
    if (!pendingGoogleProfile) return;
    setGoogleUsernameLoading(true);
    setGoogleUsernameError(null);
    // Check for duplicate username
    const exists = await checkUsernameExists(username);
    if (exists) {
      setGoogleUsernameError("Username is already taken.");
      setGoogleUsernameLoading(false);
      return;
    }
    // Link password to the current Google user
    try {
      if (!auth?.currentUser || !pendingGoogleProfile.email) {
        setGoogleUsernameError("No authenticated user found.");
        setGoogleUsernameLoading(false);
        return;
      }
      const cred = EmailAuthProvider.credential(pendingGoogleProfile.email, password);
      await linkWithCredential(auth.currentUser, cred);
    } catch (err: any) {
      setGoogleUsernameError(err.message || "Failed to link password to Google account.");
      setGoogleUsernameLoading(false);
      return;
    }    try {
      // Create user profile in Firestore
      const profile: UserProfile = {
        uid: pendingGoogleProfile.uid,
        email: pendingGoogleProfile.email,
        username,
        createdAt: new Date().toISOString(),
        provider: 'google',
      };
      await createUserProfile(profile);
      
      // Mark registration as completed
      localStorage.setItem(`registration-completed-${pendingGoogleProfile.uid}`, 'true');
      
      // Dispatch event to force profile refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('user-profile-updated'));
      }
      
      // Wait briefly for profile to be available
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setShowGoogleUsernameDialog(false);
      setPendingGoogleProfile(null);
      setGoogleUsernameLoading(false);
    } catch (err: any) {
      setGoogleUsernameError(err.message || "Failed to create user profile. Please try again.");
      setGoogleUsernameLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && e.detail.email && e.detail.uid) {
        setPendingGoogleProfile({ email: e.detail.email, uid: e.detail.uid });
        setShowGoogleUsernameDialog(true);
      }
    };
    window.addEventListener('show-google-username-dialog', handler);
    return () => window.removeEventListener('show-google-username-dialog', handler);
  }, []);

  useEffect(() => {
    // Set a global flag when the dialog is open
    if (showGoogleUsernameDialog) {
      window.__showingGoogleUsernameDialog = true;
    } else {
      window.__showingGoogleUsernameDialog = false;
    }
  }, [showGoogleUsernameDialog]);

  // After Google username dialog closes, trigger a global event to re-check migration
  useEffect(() => {
    if (!showGoogleUsernameDialog && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('check-migration-dialog'));
    }
  }, [showGoogleUsernameDialog]);
  // Only show GoogleUsernameDialog for initial registration
  useEffect(() => {
    // Don't show dialog if registration was already completed (check both localStorage and Firestore profile)
    const registrationCompleted = user && localStorage.getItem(`registration-completed-${user.uid}`);
    if (registrationCompleted || (user && profile && profile.username)) {
      setShowGoogleUsernameDialog(false);
      setPendingGoogleProfile(null);
      return;
    }

    // Show dialog ONLY for new Google users without a username
    if (
      user &&
      user.providerData.some(p => p.providerId === "google.com") &&
      !profileLoading &&
      (!profile || !profile.username) &&
      user.metadata.creationTime === user.metadata.lastSignInTime // Only new users
    ) {
      setPendingGoogleProfile({ email: user.email || "", uid: user.uid });
      setShowGoogleUsernameDialog(true);
    }
  }, [user, profile, profileLoading]);
  // Handle dialog close: only delete user if registration wasn't completed
  const handleDialogOpenChange = async (open: boolean) => {
    if (!open) {
      // Only delete the user if they haven't completed registration
      if (pendingGoogleProfile && (!user || !profile?.username)) {
        await deleteCurrentUser();
      }
      setShowGoogleUsernameDialog(false);
      setPendingGoogleProfile(null);
    }
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
      <Dialog open={showGoogleUsernameDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Google Registration</DialogTitle>
            <DialogDescription>Choose a username and password to finish creating your account.</DialogDescription>
          </DialogHeader>
          <GoogleUsernameForm
            email={pendingGoogleProfile?.email || ''}
            onSubmitAction={handleGoogleUsernameSubmit}
            isLoading={googleUsernameLoading}
            error={googleUsernameError}
          />
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
