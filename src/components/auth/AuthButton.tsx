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
import dynamic from "next/dynamic";

const AccountDeletionForm = dynamic(() => import("./AccountDeletionForm"), { ssr: false });
const DevDeleteAllAccountsButton = dynamic(() => import("./DevDeleteAllAccountsButton"), { ssr: false });

export default function Auth() {
	const { user, logout } = useAuth();
	const [open, setOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("login");
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const handleTabChange = useCallback((value: string) => {
		setActiveTab(value);
	}, []);

	const userProfile = useUserProfile();

	const renderContent = useMemo(() => {
		if (!isMounted) return null;

		if (activeTab === "login") {
			return <EmailAuthForm />;
		}

		if (activeTab === "register") {
			return <SetPasswordForm />;
		}

		if (activeTab === "account") {
			return <AccountDeletionForm />;
		}

		return null;
	}, [activeTab, isMounted]);

	return (
		<>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Welcome back</DialogTitle>
						<DialogDescription>
							{user ? "You are signed in as" : "Sign in to your account"}
						</DialogDescription>
					</DialogHeader>
					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<TabsList>
							<TabsTrigger value="login">Login</TabsTrigger>
							<TabsTrigger value="register">Register</TabsTrigger>
							{user && <TabsTrigger value="account">Account</TabsTrigger>}
						</TabsList>
						<TabsContent value="login">
							{renderContent}
							<Button
								variant="outline"
								className="w-full"
								onClick={() => {
									if (user) {
										logout();
									} else {
										setOpen(false);
									}
								}}
							>
								{user ? "Logout" : "Continue with Email"}
							</Button>
						</TabsContent>
						<TabsContent value="register">
							{renderContent}
							<Button
								variant="outline"
								className="w-full"
								onClick={() => setOpen(false)}
							>
								Continue with Email
							</Button>
						</TabsContent>
						<TabsContent value="account">
							{renderContent}
							<DevDeleteAllAccountsButton />
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>
		</>
	);
}
