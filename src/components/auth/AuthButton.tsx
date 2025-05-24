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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function AuthButton() {
  const { user, isLoading, signInWithProvider, signOut } = useAuth();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string } | null>(null);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState<string | null>(null);

  // Handler for Google sign-in with linking logic
  const handleProviderSignIn = async (provider: 'google') => {
    const result = await signInWithProvider(provider);
    if (result && typeof result === 'object' && 'needsPassword' in result && result.needsPassword && result.email) {
      setPendingGoogleUser({ email: result.email });
      setShowSetPasswordDialog(true);
    }
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
