"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import EmailAuthForm from "./EmailAuthForm";
import SetPasswordForm from "./SetPasswordForm";
import { useAuthDialog } from "@/context/AuthDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useState, useCallback } from "react";

export default function AuthDialog() {
  const { open, closeDialog, isRegistering, setRegistering } = useAuthDialog();
  const { signInWithProvider, isLoading, clearError } = useAuth();
  const { loading: profileLoading } = useUserProfile();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string | undefined } | null>(null);

  console.log('[AuthDialog] rendered, open:', open, 'isRegistering:', isRegistering);

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    clearError();
    try {
      const result = await signInWithProvider("google");
      if (result && typeof result === "object" && "needsPassword" in result && result.needsPassword) {
        setPendingGoogleUser({ email: result.email });
        closeDialog();
      } else {
        closeDialog();
        setRegistering(false);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithProvider, clearError, closeDialog, setRegistering]);

  const handleSetPassword = useCallback(async (password: string) => {
    if (!pendingGoogleUser?.email) return;
    try {
      // You may want to use your existing signInWithProvider logic for password linking
      await signInWithProvider("google", password);
      setPendingGoogleUser(null);
    } catch (error) {
      // Handle error as needed
    }
  }, [pendingGoogleUser?.email, signInWithProvider]);

  return (
    <>
      <Dialog open={open} onOpenChange={closeDialog}>
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
      {pendingGoogleUser && (
        <Dialog open={true} onOpenChange={() => setPendingGoogleUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Password</DialogTitle>
              <DialogDescription>
                This account requires a password. Please set one to continue.
              </DialogDescription>
            </DialogHeader>
            <SetPasswordForm
              email={pendingGoogleUser.email || ""}
              onSubmitAction={handleSetPassword}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
