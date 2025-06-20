"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from '@/components/ui/FormStatusMessage';

import EmailAuthForm from "./EmailAuthForm";
import PasswordResetForm from "./PasswordResetForm";
import { useAuthDialog } from "@/context/AuthDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useState, useCallback } from "react";
import { useRouter } from 'next/navigation';
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { auth } from '@/lib/firebase/firebaseConfig';
import { linkWithCredential } from 'firebase/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

export default function AuthDialog() {
  const { open, closeDialog, isRegistering, setRegistering } = useAuthDialog();
  const { signInWithProvider, signInWithEmail, isLoading: authLoading, clearError } = useAuth();
  const { profile, loading: profileLoading, error: profileError, forceRefresh } = useUserProfile();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string | undefined, uid: string | undefined } | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [pendingGoogleLink, setPendingGoogleLink] = useState<null | { email: string, pendingCred: any }>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Block UI if not authenticated or no profile
  const shouldBlock = !profile && !profileLoading;

  // Only show sign-in dialog if not showing welcome
  const showSignInDialog = (shouldBlock || open) && !showWelcome;

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    clearError();
    setLinkError(null);
    try {
      const result = await signInWithProvider("google");
      if (
        result &&
        typeof result === "object" &&
        'requirePasswordToLink' in result &&
        result.requirePasswordToLink &&
        typeof result.email === 'string' &&
        result.email &&
        'pendingCred' in result &&
        result.pendingCred
      ) {
        // Show password prompt for seamless linking
        setPendingGoogleLink({ email: result.email, pendingCred: result.pendingCred });
        return;
      }
      if (result && typeof result === "object" && 'showWelcome' in result && result.showWelcome) {
        setPendingGoogleUser({
          email: result.email || '',
          uid: result.uid || ''
        });
        setShowWelcome(true);
        forceRefresh();
      } else {
        setShowWelcome(false);
        setPendingGoogleUser(null);
        forceRefresh();
        closeDialog();
        setRegistering(false);
      }
    } catch (e: any) {
      setLinkError(e?.message || 'Google sign-in failed. Please try again.');
      toast({ title: 'Google sign-in failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithProvider, clearError, closeDialog, setRegistering, forceRefresh, toast]);

  // Handler for password entry to link Google
  const handleLinkGoogleWithPassword = async (password: string) => {
    if (!pendingGoogleLink) return;
    setIsGoogleLoading(true);
    clearError();
    setLinkError(null);
    try {
      // Sign in with email/password
      const user = await signInWithEmail(pendingGoogleLink.email, password);
      if (user && auth && pendingGoogleLink.pendingCred) {
        // Link Google credential
        await linkWithCredential(user, pendingGoogleLink.pendingCred);
        setPendingGoogleLink(null);
        closeDialog();
        forceRefresh();
        toast({ title: 'Google account linked', description: 'You can now sign in with Google or email/password.', variant: 'success' });
      } else {
        throw new Error('Failed to sign in or link Google account.');
      }
    } catch (e: any) {
      setLinkError(e?.message || 'Failed to link Google account.');
      toast({ title: 'Linking failed', description: e?.message || 'Please check your password and try again.', variant: 'destructive' });
    } finally {
      setIsGoogleLoading(false);
    }
  };

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

  // Hide dialog completely if user is authenticated or still loading
  if ((authLoading || profileLoading) && !open && !showWelcome) {
    return null;
  }
  // Show error if profile failed to load, but do NOT show if showWelcome is about to be shown
  // FIX: Do not show Profile Error dialog if registering (registration handles its own errors)
  if (profileError && !profile && !profileLoading && !showWelcome && !pendingGoogleUser && !isRegistering) {
    return (
      <Dialog open={true} onOpenChange={forceRefresh}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile Error</DialogTitle>
            <DialogDescription>{profileError}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button onClick={forceRefresh}>Retry</Button>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Block UI until profile is loaded, but only show one dialog at a time */}
      <Dialog open={showSignInDialog && !showPasswordReset} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRegistering ? "Create Account" : "Welcome Back V2"}</DialogTitle>
            <DialogDescription>
              {isRegistering ? "Register a new account" : "Sign in to your account"}
            </DialogDescription>
          </DialogHeader>
          {isRegistering ? (
            <RegisterForm
              onSuccess={closeDialog}
              onGoogleSignIn={handleGoogleSignIn}
              googleLoading={isGoogleLoading}
              onShowLogin={() => { clearError(); setRegistering(false); }}
            />
          ) : (
            <LoginForm
              onSuccess={closeDialog}
              onShowPasswordReset={() => setShowPasswordReset(true)}
              onGoogleSignIn={handleGoogleSignIn}
              googleLoading={isGoogleLoading}
              onShowRegister={() => { clearError(); setRegistering(true); }}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Password reset dialog */}
      <Dialog open={showPasswordReset} onOpenChange={() => setShowPasswordReset(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter your email to receive a password reset link.</DialogDescription>
          </DialogHeader>
          <PasswordResetForm />
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
      {/* Password prompt for seamless Google linking */}
      {pendingGoogleLink && (
        <Dialog open={true} onOpenChange={() => setPendingGoogleLink(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link Google Account</DialogTitle>
              <DialogDescription>
                Enter your password to link your Google account to your existing account.<br />
                <span className="text-xs text-gray-500">If you forgot your password, <a href="#" onClick={() => { setPendingGoogleLink(null); setShowPasswordReset(true); }} className="underline">reset it here</a>.</span>
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const pw = (form.elements.namedItem('password') as HTMLInputElement).value;
                handleLinkGoogleWithPassword(pw);
              }}
            >
              <input
                type="password"
                name="password"
                placeholder="Password"
                className="input input-bordered w-full mb-4"
                required
                autoFocus
                aria-label="Password"
                aria-required="true"
                style={isMobile ? { fontSize: '1.2em' } : {}}
                disabled={isGoogleLoading}
              />
              <FormStatusMessage message={linkError} type="error" />
              <Button
                type="submit"
                className="w-full"
                disabled={isGoogleLoading}
                aria-busy={isGoogleLoading}
              >
                {isGoogleLoading ? 'Linking...' : 'Link Account'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
