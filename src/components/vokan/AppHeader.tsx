"use client";

import { ModeToggle } from "@/components/ui/mode-toggle";
import { useVocabulary } from "@/context/VocabularyContext";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import GuideDialog from "@/components/vokan/library/GuideDialog";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/context/AuthDialogContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function AppHeader() {
  const { isSyncing } = useVocabulary();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { openDialog } = useAuthDialog();
  const router = useRouter();

  return (
    <header
      className="flex flex-col sm:flex-row justify-between items-center py-4 px-4 sm:px-6 border-b gap-2 sm:gap-0"
      aria-label="App header"
    >
      <div className="flex items-center w-full sm:w-auto">
        <h1 className="text-2xl font-bold mr-2" tabIndex={0} aria-label="Vokan Home">Vokan</h1>
        {user && (
          <span className="text-xs bg-green-200 dark:bg-green-900 px-2 py-0.5 rounded-full ml-2 text-green-900 dark:text-green-200 flex items-center gap-1" aria-label="Cloud Sync enabled">
            Cloud Sync
            {isSyncing && (
              <span className="ml-1 inline-block w-2 h-2 rounded-full bg-primary animate-pulse" title="Syncing" />
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <GuideDialog />
        <ModeToggle />
        {/* Profile/User menu */}
        {user && profile && !profileLoading && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <UserIcon className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm max-w-[120px] truncate">{profile.username || user.email}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href="/settings" className="w-full cursor-pointer">Settings</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
