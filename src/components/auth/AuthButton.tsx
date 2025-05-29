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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AccountDeletionForm from "./AccountDeletionForm";

export function AuthButton() {
	const { user, isLoading, signInWithProvider, signOut, error, clearError } = useAuth();
	const { profile, loading: profileLoading, forceRefresh } = useUserProfile();
	const [showAuthDialog, setShowAuthDialog] = useState(false);
	const [activeTab, setActiveTab] = useState<'email' | 'google'>('email');
	const [pendingGoogleUser, setPendingGoogleUser] = useState<{ email: string | undefined } | null>(null);
	const [isRegistering, setIsRegistering] = useState(false);
	const handleToggleModeAction = () => setIsRegistering(v => !v);

	const handleProviderSignIn = useCallback(async () => {
		try {
			const result = await signInWithProvider("google");
			if (result && typeof result === "object" && "needsPassword" in result && result.needsPassword) {
				setPendingGoogleUser({ email: result.email });
			} else {
				setShowAuthDialog(false);
				setIsRegistering(false); // Reset registration state after Google sign-in
			}
		} catch (error) {
			// Error is handled by context
			console.error("Provider sign-in error:", error);
		}
	}, [signInWithProvider]);

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
			if (result && typeof result === "object" && !("error" in result)) {
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
		setIsRegistering(false); // Always reset registration state when dialog closes
	}, [clearError]);

	const isAuthenticating = isLoading || profileLoading;

	const menuContent = useMemo(() => {
		if (isAuthenticating) {
			return (
				<Button variant="outline" size="sm" disabled>
					<Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...
				</Button>
			);
		}

		if (!user) {
			return (
				<>
					<Button 
						variant="outline" 
						size="sm" 
						onClick={() => { clearError(); setShowAuthDialog(true); }}
					>
						<LogIn className="h-4 w-4 mr-2" />Sign In
					</Button>
					
					<Dialog open={showAuthDialog} onOpenChange={handleAuthDialogClose}>
						<DialogContent className="sm:max-w-[425px]">
							<DialogHeader>
								<DialogTitle>{isRegistering ? "Create Account" : "Welcome Back"}</DialogTitle>
								<DialogDescription>{isRegistering ? "Register a new account" : "Sign in to your account"}</DialogDescription>
							</DialogHeader>
							<EmailAuthForm onSuccess={() => setShowAuthDialog(false)} isRegistering={isRegistering} onToggleModeAction={handleToggleModeAction} />
						</DialogContent>
					</Dialog>

					{pendingGoogleUser && (
						<Dialog 
							open={true} 
							onOpenChange={(open) => !open && setPendingGoogleUser(null)}
						>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Set Password</DialogTitle>
									<DialogDescription>
										Please set a password for your account
									</DialogDescription>
								</DialogHeader>
								<SetPasswordForm
									email={pendingGoogleUser.email ? pendingGoogleUser.email : ""}
									onSubmitAction={handleSetPassword}
								/>
							</DialogContent>
						</Dialog>
					)}
				</>
			);
		}

		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm">
						<User className="h-4 w-4 mr-2" />
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
	}, [user, profile, isAuthenticating, showAuthDialog, pendingGoogleUser, clearError, handleAuthDialogClose, handleSetPassword, handleSignOut]);

	return (
		<>
			{menuContent}
			

		</>
	);
}
