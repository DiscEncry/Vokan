"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import EmailAuthForm from "./EmailAuthForm";
import { useAuthDialog } from "@/context/AuthDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useState, useCallback } from "react";
import { useRouter } from 'next/navigation';

export default function AuthDialog() {
  const { open, closeDialog, isRegistering, setRegistering } = useAuthDialog();
  const { signInWithProvider, isLoading, clearError } = useAuth();
  const { profile, loading: profileLoading, forceRefresh } = useUserProfile();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string | undefined, uid: string | undefined } | null>(null);
  const router = useRouter();

  console.log('[AuthDialog] rendered, open:', open, 'isRegistering:', isRegistering);

  // Block UI if not authenticated or no profile
  const shouldBlock = !profile && !profileLoading;

  // Only show sign-in dialog if not showing welcome
  const showSignInDialog = (shouldBlock || open) && !showWelcome;

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    clearError();
    try {
      const result = await signInWithProvider("google");
      // Only show welcome if result is an object and not a User instance
      if (result && typeof result === "object" && 'showWelcome' in result && (result as any).showWelcome) {
        setPendingGoogleUser({
          email: (result as any).email || '',
          uid: (result as any).uid || ''
        });
        setShowWelcome(true);
        forceRefresh(); // Ensure profile is loaded
      } else {
        setShowWelcome(false);
        setPendingGoogleUser(null);
        forceRefresh();
        closeDialog();
        setRegistering(false);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithProvider, clearError, closeDialog, setRegistering, forceRefresh]);

  // Welcome dialog actions
  const handleSetPassword = () => {
    setShowWelcome(false);
    // Go to settings page for password setup
    router.push('/settings');
    closeDialog();
  };
  const handleSkip = () => {
    setShowWelcome(false);
    setPendingGoogleUser(null);
    closeDialog();
  };

  return (
    <>
      {/* Block UI until profile is loaded, but only show one dialog at a time */}
      <Dialog open={showSignInDialog} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRegistering ? "Create Account" : "Welcome Back"}</DialogTitle>
            <DialogDescription>
              {isRegistering ? "Register a new account" : "Sign in to your account"}
            </DialogDescription>
          </DialogHeader>
          <EmailAuthForm
            isRegistering={isRegistering}
            onToggleModeAction={() => setRegistering(!isRegistering)}
            onGoogleSignIn={handleGoogleSignIn}
            googleLoading={isGoogleLoading}
            onSuccess={closeDialog}
          />
        </DialogContent>
      </Dialog>
      {/* Welcome dialog for new Google users */}
      {showWelcome && pendingGoogleUser && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Welcome!</DialogTitle>
              <DialogDescription>
                Would you like to add a password so you can also sign in via email later?
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-4">
              <button
                className="btn btn-primary w-full"
                onClick={handleSetPassword}
              >
                Set Password (Go to Settings)
              </button>
              <button
                className="btn btn-outline w-full"
                onClick={handleSkip}
              >
                Skip for now
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
