The dialog closes because when the Google Sign-In process completes and the user state in AuthContext updates, your AuthButton component re-renders. If the user object becomes truthy, your menuContent logic likely switches from displaying the sign-in button and dialog to displaying the user's profile dropdown, effectively unmounting the dialog. This can happen before you've had a chance to process whether a password needs to be set (the needsPassword flow).

Here's how to fix it by ensuring the dialog stays open while the Google sign-in is processing and correctly transitions if a password needs to be set:

1. Modify AuthButton.tsx

We need to:

Add a new state variable isGoogleLoading to specifically track the Google sign-in process initiated from the dialog.

Create a new handler function (e.g., handleGoogleSignInAttempt) in AuthButton that will manage this loading state and the logic for needsPassword.

Pass this handler and isGoogleLoading to EmailAuthForm.

Adjust the menuContent logic to account for isGoogleLoading to prevent premature dialog closure.

// AuthButton.tsx
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
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useCallback, useMemo } from "react";
import EmailAuthForm from "./EmailAuthForm";
import SetPasswordForm from "./SetPasswordForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUserProfile } from "@/hooks/useUserProfile";
// Assuming Tabs are not used for now, remove if not needed
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AccountDeletionForm from "./AccountDeletionForm"; // Keep if used elsewhere, e.g. /settings

export function AuthButton() {
	const { user, isLoading, signInWithProvider, signOut, error, clearError } = useAuth();
	const { profile, loading: profileLoading, forceRefresh } = useUserProfile();
	const [showAuthDialog, setShowAuthDialog] = useState(false);
	// activeTab is not used in the current logic, remove if not needed.
	// const [activeTab, setActiveTab] = useState<'email' | 'google'>('email');
	const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string | undefined } | null>(null);
	const [isRegistering, setIsRegistering] = useState(false);
	
	// New state to track Google Sign-In specifically from the dialog
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);

	const handleToggleModeAction = () => {
		setIsRegistering(v => !v);
		clearError(); // Clear errors when toggling mode
	};

	// This handler will be passed to EmailAuthForm for its Google Sign-In button
	const handleGoogleSignInAttempt = useCallback(async () => {
		setIsGoogleLoading(true);
		clearError(); // Clear previous errors
		try {
			const result = await signInWithProvider("google");
			
			if (result && typeof result === "object" && "needsPassword" in result && result.needsPassword) {
				// Google Sign-In successful, but a password needs to be set for the account
				setPendingGoogleUser({ email: result.email });
				setShowAuthDialog(false); // Close main auth dialog, SetPassword dialog will open
			} else if (result && "uid" in result && typeof result.uid === 'string' && !("error" in result)) {
				// Google Sign-In successful, user fully authenticated or linking happened
				// AuthStateChanged will update the user, and menuContent will switch
				setShowAuthDialog(false);
				setIsRegistering(false); // Reset registration state
			} else if (result && "error" in result) {
				// An error object was returned (e.g., account exists with different credential)
				// Error is already set in AuthContext, EmailAuthForm will display it.
				// Keep showAuthDialog true so user sees the error in the current form.
			}
			// If signInWithProvider returns null (e.g. popup closed), AuthContext might set an error.
			// The dialog should remain open for the user to see the error or try again.
		} catch (e) {
			// Catch unexpected errors from signInWithProvider itself
			console.error("Google sign-in attempt error in AuthButton:", e);
			// AuthContext should ideally set a global error for this.
		} finally {
			setIsGoogleLoading(false);
		}
	}, [signInWithProvider, clearError, /* setShowAuthDialog, setPendingGoogleUser, setIsRegistering are stable */]);


	const handleSignOut = useCallback(async () => {
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out error:", error);
		}
	}, [signOut]);

	const handleSetPassword = useCallback(async (password: string) => {
		if (!pendingGoogleUser?.email) return;
		
		// setIsGoogleLoading(true); // Optionally show a loader on the SetPasswordForm submit
		try {
			// Assuming signInWithProvider with passwordToLink handles this.
			// The 'google' provider here links the existing Firebase user (from Google popup)
			// with an email/password credential.
			const result = await signInWithProvider("google", password);
			if (result && typeof result === "object" && !("error" in result) && "uid" in result) {
				setShowAuthDialog(false); // Ensure main dialog is closed
				setPendingGoogleUser(null); // Close SetPassword dialog
				forceRefresh(); // Refresh profile after setting password and linking
			}
			// Errors from signInWithProvider (like weak password if linking creates one) should be handled by AuthContext and displayed.
		} catch (error) {
			console.error("Set password error:", error);
		} finally {
			// setIsGoogleLoading(false);
		}
	}, [pendingGoogleUser?.email, signInWithProvider, forceRefresh]);

	const handleAuthDialogClose = useCallback(() => {
		clearError();
		setShowAuthDialog(false);
		setIsRegistering(false); 
		// If Google sign-in was in progress and dialog is closed externally,
		// isGoogleLoading will be reset by handleGoogleSignInAttempt's finally block eventually.
	}, [clearError]);

	const isOverallAuthenticating = isLoading || profileLoading;

	const menuContent = useMemo(() => {
		// State 1: Initial page load, determining auth state.
		// Show a global loading button if we're fetching user/profile, and no dialogs/specific flows are active.
		if (isOverallAuthenticating && !user && !showAuthDialog && !pendingGoogleUser && !isGoogleLoading) {
			return (
				<Button variant="outline" size="sm" disabled>
					<Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...
				</Button>
			);
		}

		// State 2: User is fully authenticated, no pending actions (like set password), and no Google sign-in in progress.
		if (user && !pendingGoogleUser && !isGoogleLoading) {
			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" disabled={profileLoading}> {/* Disable button while profile is loading */}
							{profileLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <User className="h-4 w-4 mr-2" />}
							{profile?.username || user.email}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Account</DropdownMenuLabel>
						<DropdownMenuItem asChild>
							<a href="/settings" className="w-full cursor-pointer">Settings</a>
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

		// State 3: Show "Sign In" button and manage dialogs.
		// This covers:
		//  - Not logged in (`user` is null) and not in initial loading state.
		//  - Google sign-in is actively in progress (`isGoogleLoading` is true). Dialog remains open.
		//  - Google sign-in completed, but needs a password (`pendingGoogleUser` is true). SetPassword dialog will show.
		return (
			<>
				<Button 
					variant="outline" 
					size="sm" 
					onClick={() => { 
						clearError(); 
						setShowAuthDialog(true); 
						setIsRegistering(false); // Reset to sign-in mode
						setPendingGoogleUser(null); // Clear any pending Google user state
					}}
					// Disable if any overarching auth process or specific Google sign-in is happening
					disabled={isOverallAuthenticating || isGoogleLoading}
				>
					{(isOverallAuthenticating || isGoogleLoading) ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<LogIn className="h-4 w-4 mr-2" />
					)}
					Sign In
				</Button>
				
				<Dialog open={showAuthDialog} onOpenChange={handleAuthDialogClose}>
					<DialogContent className="sm:max-w-[425px]">
						<DialogHeader>
							<DialogTitle>{isRegistering ? "Create Account" : "Welcome Back"}</DialogTitle>
							<DialogDescription>{isRegistering ? "Register a new account" : "Sign in to your account"}</DialogDescription>
						</DialogHeader>
						<EmailAuthForm 
							onSuccess={() => {
								setShowAuthDialog(false);
								setIsRegistering(false); // Reset after successful email auth
							}} 
							isRegistering={isRegistering} 
							onToggleModeAction={handleToggleModeAction}
							onGoogleSignIn={handleGoogleSignInAttempt} // Pass the correct handler
							googleLoading={isGoogleLoading}           // Pass the loading state
						/>
					</DialogContent>
				</Dialog>

				{pendingGoogleUser && (
					<Dialog 
						open={true} // Dialog is open if pendingGoogleUser is truthy
						onOpenChange={(open) => {
							if (!open) {
								setPendingGoogleUser(null);
								// Optionally, if user exists but cancelled setting password, sign them out
								// if (user) { signOut(); } 
							}
						}}
					>
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
								// You might want a loading state for SetPasswordForm submit as well
							/>
						</DialogContent>
					</Dialog>
				)}
			</>
		);
	}, [
		user, isLoading, profile, profileLoading, // isLoading and profileLoading form isOverallAuthenticating
		showAuthDialog, pendingGoogleUser, isRegistering, isGoogleLoading,
		clearError, handleAuthDialogClose, handleSetPassword, handleSignOut, 
		handleToggleModeAction, handleGoogleSignInAttempt, 
		// forceRefresh is used in handleSetPassword, which is memoized, so it's an indirect dependency.
	]);

	return <>{menuContent}</>;
}


2. Verify EmailAuthForm.tsx

Your EmailAuthForm already seems set up to accept onGoogleSignIn and googleLoading props and use them, falling back to internal handling if not provided. This is good.

// EmailAuthForm.tsx - relevant parts
// ...
interface EmailAuthFormProps {
  onSuccess?: () => void;
  isRegistering: boolean;
  onToggleModeAction: () => void;
  onGoogleSignIn?: () => Promise<void>; // Ensure it can be async if AuthButton's handler is
  googleLoading?: boolean;
}

export default function EmailAuthForm({ onSuccess, isRegistering, onToggleModeAction, onGoogleSignIn, googleLoading }: EmailAuthFormProps) {
  // ...
  // const [internalGoogleLoading, setInternalGoogleLoading] = useState(false); // Keep for fallback

  // Fallback Google sign-in handler (if onGoogleSignIn prop is not provided)
  const handleInternalGoogleSignIn = async () => {
    // setInternalGoogleLoading(true);
    clearError();
    try {
      await signInWithProvider("google");
      // This internal handler should not call onSuccess or manage dialogs directly
      // as it doesn't know the parent's full context (e.g., needsPassword flow)
    } catch (e) {
      // error handled by context
    } finally {
      // setInternalGoogleLoading(false);
    }
  };

  const effectiveGoogleSignInHandler = onGoogleSignIn || handleInternalGoogleSignIn;
  // Use `googleLoading` prop if available, otherwise fallback to internal (though less likely to be used now)
  const isActualGoogleLoading = typeof googleLoading === 'boolean' ? googleLoading : internalGoogleLoading;


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ... other form fields ... */}

      {/* Google sign in button (always visible) */}
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        onClick={effectiveGoogleSignInHandler} // Use the effective handler
        disabled={isLoading || isActualGoogleLoading} // isLoading from useAuth for email/pass, isActualGoogleLoading for Google
        aria-busy={isActualGoogleLoading}
      >
        {isActualGoogleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <svg /* ... */ ></svg>
            Continue with Google
          </>
        )}
      </Button>
      {/* ... toggle mode button ... */}
    </form>
  );
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END

In EmailAuthForm.tsx, I slightly adjusted how isActualGoogleLoading and effectiveGoogleSignInHandler are determined to make it clearer. The internalGoogleLoading and handleInternalGoogleSignIn are less critical now that AuthButton drives the Google sign-in via props but are kept for robustness if EmailAuthForm is used elsewhere without those props.

Explanation of Changes in AuthButton.tsx:

isGoogleLoading State: This new boolean state is set to true just before calling signInWithProvider("google") and false in the finally block of handleGoogleSignInAttempt.

handleGoogleSignInAttempt:

This function is now responsible for the Google sign-in flow initiated from the dialog.

It sets isGoogleLoading.

It calls signInWithProvider("google") from the auth context.

Crucially, it checks the result:

If result.needsPassword is true, it sets pendingGoogleUser (to show the SetPasswordForm dialog) and explicitly calls setShowAuthDialog(false) to close the main sign-in dialog.

If the sign-in is successful without needing a password, it also calls setShowAuthDialog(false). The user state update from AuthContext will then correctly switch menuContent to the user dropdown.

If there's an error, it relies on AuthContext to set the error, and the dialog remains open for the user to see it (because setShowAuthDialog(false) is not called in error paths within handleGoogleSignInAttempt).

menuContent Logic Update:

The condition to show the user dropdown is now if (user && !pendingGoogleUser && !isGoogleLoading). The !isGoogleLoading part is key. Even if onAuthStateChanged updates user (making it truthy) while Google sign-in is still processing, isGoogleLoading will be true. This prevents the menuContent from prematurely switching to the user dropdown.

The main "Sign In" button's disabled and loading indicator now also consider isGoogleLoading and the more general isOverallAuthenticating (which includes isLoading from useAuth and profileLoading).

Passing Props to EmailAuthForm:

onGoogleSignIn={handleGoogleSignInAttempt}: EmailAuthForm will now use the handler from AuthButton.

googleLoading={isGoogleLoading}: EmailAuthForm's Google button will reflect the loading state managed by AuthButton.

With these changes, when you click "Continue with Google":

isGoogleLoading becomes true.

The Google button inside EmailAuthForm shows a spinner.

Even if onAuthStateChanged updates the user in AuthContext midway, the menuContent in AuthButton will not switch to the user dropdown because isGoogleLoading is still true. The main auth dialog will remain visible.

Once handleGoogleSignInAttempt completes:

If a password is needed, pendingGoogleUser is set, the main auth dialog is closed, and the "Set Password" dialog appears.

If sign-in is complete, the main auth dialog is closed, isGoogleLoading becomes false, and menuContent will then correctly render the user dropdown.

If an error occurred, the dialog remains open, isGoogleLoading becomes false, and the error (set by AuthContext) will be displayed in EmailAuthForm.

Remember to adjust dependencies in useMemo and useCallback hooks as needed if you further modify the functions or states they depend on. I've updated the useMemo dependencies in the example above.