"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Loader2, LogIn, LogOut, User } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import EmailAuthForm from "./EmailAuthForm";
import SetPasswordForm from "./SetPasswordForm";
import GoogleUsernameForm from "./GoogleUsernameForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { checkUsernameExists } from "@/lib/firebase/checkUsernameExists";
import { createUserProfile } from "@/lib/firebase/userProfile";
import type { UserProfile } from "@/types/userProfile";

export function AuthButton() {
  const { user, isLoading, signInWithProvider, signOut } = useAuth();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [showGoogleUsernameDialog, setShowGoogleUsernameDialog] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string } | null>(null);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<{ email: string; uid: string } | null>(null);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState<string | null>(null);
  const [googleUsernameLoading, setGoogleUsernameLoading] = useState(false);
  const [googleUsernameError, setGoogleUsernameError] = useState<string | null>(null);

  // Handler for Google sign-in with linking logic
  const handleProviderSignIn = async (provider: 'google') => {
    const result = await signInWithProvider(provider);
    if (result && typeof result === 'object' && 'needsPassword' in result && result.needsPassword && result.email) {
      setPendingGoogleUser({ email: result.email });
      setShowSetPasswordDialog(true);
    } else if (result && typeof result === 'object' && 'uid' in result && result.email && result.uid) {
      // New Google user, prompt for username/password
      setPendingGoogleProfile({ email: result.email, uid: result.uid });
      setShowGoogleUsernameDialog(true);
    }
  };

  // Handle Google username/password form submit
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
    // Link password to Google account
    const result = await signInWithProvider('google', password);
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      setGoogleUsernameError(result.error);
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
    setShowGoogleUsernameDialog(false);
    setPendingGoogleProfile(null);
    setGoogleUsernameLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSetPassword = async (password: string) => {
    if (!pendingGoogleUser?.email) return;
    setSetPasswordLoading(true);
    setSetPasswordError(null);
    // Call signInWithProvider with passwordToLink to link email/password
    const result = await signInWithProvider('google', password);
    setSetPasswordLoading(false);
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      setSetPasswordError(result.error);
    } else {
      setShowSetPasswordDialog(false);
      setPendingGoogleUser(null);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (!user) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sign in with</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleProviderSignIn('google')}>
              <LogIn className="h-4 w-4 mr-2 text-blue-500" />Google
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowEmailDialog(true)}>
              <LogIn className="h-4 w-4 mr-2 text-gray-500" />Email / Password
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email Sign In / Register</DialogTitle>
              <DialogDescription>Sign in or create an account with your email address.</DialogDescription>
            </DialogHeader>
            <EmailAuthForm onAuthSuccess={() => setShowEmailDialog(false)} />
          </DialogContent>
        </Dialog>
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
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <User className="h-4 w-4 mr-2" />
          {user.displayName || 'User'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          {user.email}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
