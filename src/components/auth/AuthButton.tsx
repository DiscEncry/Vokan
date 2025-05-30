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
import { useState, useCallback, useMemo, useEffect } from "react";
import EmailAuthForm from "./EmailAuthForm";
import SetPasswordForm from "./SetPasswordForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AccountDeletionForm from "./AccountDeletionForm";

export function AuthButton() {
	const { user, isLoading, signInWithProvider, signOut, error, clearError } = useAuth();
	const { profile, loading: profileLoading, forceRefresh } = useUserProfile();
	const [showAuthDialog, setShowAuthDialog] = useState(false);
	const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string | undefined } | null>(null);
	const [isRegistering, setIsRegistering] = useState(false);

	// New state to track Google Sign-In specifically from the dialog
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);

	const handleToggleModeAction = () => {
		setIsRegistering(v => !v);
		clearError();
	};

	// Handler for Google Sign-In with loading state
	const handleGoogleSignInAttempt = useCallback(async () => {
		console.debug('[AuthButton] handleGoogleSignInAttempt called');
		setIsGoogleLoading(true);
		clearError();
		try {
			const result = await signInWithProvider("google");
			console.debug('[AuthButton] signInWithProvider result:', result);
			if (result && typeof result === "object" && "needsPassword" in result && result.needsPassword) {
				setPendingGoogleUser({ email: result.email });
				setShowAuthDialog(false); // Close main auth dialog, SetPassword dialog will open
				setIsGoogleLoading(false); // Only stop loading after dialog state is handled
				return;
			} else if (result && "uid" in result && typeof result.uid === 'string' && !("error" in result)) {
				setShowAuthDialog(false);
				setIsRegistering(false);
				setIsGoogleLoading(false); // Only stop loading after dialog state is handled
				return;
			} else if (result && "error" in result) {
				// Error is handled by context, keep dialog open
				setIsGoogleLoading(false);
				return;
			}
		} catch (e) {
			console.error("Google sign-in attempt error in AuthButton:", e);
		} 
	}, [signInWithProvider, clearError]);

	const handleSignOut = useCallback(async () => {
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out error:", error);
		}
	}, [signOut]);

	const handleSetPassword = useCallback(async (password: string) => {
		if (!pendingGoogleUser?.email) return;
		try {
			const result = await signInWithProvider("google", password);
			if (result && typeof result === "object" && !("error" in result) && "uid" in result) {
				setShowAuthDialog(false);
				setPendingGoogleUser(null);
				forceRefresh();
			}
		} catch (error) {
			console.error("Set password error:", error);
		}
	}, [pendingGoogleUser?.email, signInWithProvider, forceRefresh]);

	const handleAuthDialogClose = useCallback(() => {
		clearError();
		setShowAuthDialog(false);
		setIsRegistering(false);
	}, [clearError]);

	const isOverallAuthenticating = isLoading || profileLoading;

	const menuContent = useMemo(() => {
		if (isOverallAuthenticating && !user && !showAuthDialog && !pendingGoogleUser && !isGoogleLoading) {
			return (
				<Button variant="outline" size="sm" disabled>
					<Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...
				</Button>
			);
		}

		if (user && !pendingGoogleUser && !isGoogleLoading) {
			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" disabled={profileLoading}>
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

		return (
			<>
				<Button 
					variant="outline" 
					size="sm" 
					onClick={() => { 
						clearError(); 
						setShowAuthDialog(true); 
						setIsRegistering(false); 
						setPendingGoogleUser(null); 
					}}
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
								setIsRegistering(false);
							}} 
							isRegistering={isRegistering} 
							onToggleModeAction={handleToggleModeAction}
							onGoogleSignIn={handleGoogleSignInAttempt}
							googleLoading={isGoogleLoading}
						/>
					</DialogContent>
				</Dialog>
				{pendingGoogleUser && (
					<Dialog 
						open={true}
						onOpenChange={(open) => {
							if (!open) {
								setPendingGoogleUser(null);
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
							/>
						</DialogContent>
					</Dialog>
				)}
			</>
		);
	}, [
		user, isLoading, profile, profileLoading, showAuthDialog, pendingGoogleUser, isRegistering, isGoogleLoading,
		clearError, handleAuthDialogClose, handleSetPassword, handleSignOut, handleToggleModeAction, handleGoogleSignInAttempt
	]);

	// Advanced debugging for dialog and loading state
	useEffect(() => {
		console.debug("[AuthButton] showAuthDialog:", showAuthDialog);
	}, [showAuthDialog]);
	useEffect(() => {
		console.debug("[AuthButton] isGoogleLoading:", isGoogleLoading);
	}, [isGoogleLoading]);
	useEffect(() => {
		console.debug("[AuthButton] user:", user);
	}, [user]);
	useEffect(() => {
		console.debug("[AuthButton] pendingGoogleUser:", pendingGoogleUser);
	}, [pendingGoogleUser]);
	useEffect(() => {
		console.debug("[AuthButton] isRegistering:", isRegistering);
	}, [isRegistering]);
	useEffect(() => {
		console.debug("[AuthButton] isLoading:", isLoading);
	}, [isLoading]);
	useEffect(() => {
		console.debug("[AuthButton] profileLoading:", profileLoading);
	}, [profileLoading]);
	useEffect(() => {
		console.debug("[AuthButton] menuContent rerender");
	}, [showAuthDialog, isGoogleLoading, user, pendingGoogleUser, isRegistering, isLoading, profileLoading]);

	return <>{menuContent}</>;
}
