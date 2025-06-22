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
      className="w-full border-b bg-background"
      aria-label="App header"
    >
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        {/* Left side - Logo and sync status */}
        <div className="flex items-center gap-3">
          <h1 
            className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent" 
            tabIndex={0} 
            aria-label="Vokan Home"
          >
            Vokan
          </h1>
          {user && (
            <>
              {/* Desktop sync badge */}
              <div className="hidden sm:flex items-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Cloud Sync
                  {isSyncing && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </span>
              </div>
              {/* Mobile sync indicator */}
              <div className="sm:hidden">
                <div className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
              </div>
            </>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          
          <GuideDialog />
          <ModeToggle />
          
          {/* User menu */}
          {user && profile && !profileLoading ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="relative h-8 rounded-full pl-2 sm:pr-3 pr-2 hover:bg-accent/50"
                >
                  <Avatar className="h-6 w-6 sm:mr-2">
                    <AvatarFallback className="text-xs bg-muted">
                      <UserIcon className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block font-medium text-sm max-w-[100px] truncate">
                    {profile.username || user.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile.username || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/settings" className="w-full cursor-pointer">
                    <UserIcon className="h-4 w-4 mr-2" />
                    Settings
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                  }}
                  className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : user ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openDialog('signin')}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}