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

// DEPRECATED: This component is no longer used. All authentication dialogs are now managed globally via AuthDialogContext and AuthDialog.
// If you need a sign-in/register button, use the context's openDialog method from useAuthDialog instead.

export function AuthButton() {
	return null;
}
