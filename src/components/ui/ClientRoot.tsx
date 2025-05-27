"use client";
import { ReactNode, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import GoogleUsernameForm from "@/components/auth/GoogleUsernameForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { checkUsernameExists } from "@/lib/firebase/checkUsernameExists";
import { createUserProfile } from "@/lib/firebase/userProfile";
import { auth } from '@/lib/firebase/firebaseConfig';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import type { UserProfile } from '@/types/userProfile';

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="mb-2">An unexpected error occurred. Please refresh the page or try again later.</p>
      <pre className="text-xs text-red-500 overflow-x-auto max-w-full">{error.message}</pre>
    </div>
  );
}

export default function ClientRoot({ children }: { children: ReactNode }) {
  // Global Google username dialog state
  const { user, isLoading, signInWithProvider } = useAuth();
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
    }
    // Create user profile in Firestore
    const profile: UserProfile = {
      uid: pendingGoogleProfile.uid,
      email: pendingGoogleProfile.email,
      username,
      createdAt: new Date().toISOString(),
      provider: 'google',
    };
    await createUserProfile(profile);
    // Dispatch global event to force profile refresh in UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('user-profile-updated'));
    }
    setShowGoogleUsernameDialog(false);
    setPendingGoogleProfile(null);
    setGoogleUsernameLoading(false);
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

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
      <Dialog open={showGoogleUsernameDialog} onOpenChange={setShowGoogleUsernameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Google Registration</DialogTitle>
            <DialogDescription>Choose a username and password to finish creating your account.</DialogDescription>
          </DialogHeader>
          <GoogleUsernameForm
            email={pendingGoogleProfile?.email || ''}
            onSubmit={handleGoogleUsernameSubmit}
            isLoading={googleUsernameLoading}
            error={googleUsernameError}
          />
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
