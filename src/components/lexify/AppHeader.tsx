"use client";

import { ModeToggle } from "@/components/ui/mode-toggle";
import { AuthButton } from "@/components/auth/AuthButton";
import { useVocabulary } from "@/context/VocabularyContext";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import GuideDialog from "@/components/lexify/library/GuideDialog";
import Link from 'next/link';

export function AppHeader() {
  const { isSyncing } = useVocabulary();
  const { user } = useAuth();

  return (
    <header
      className="flex flex-col sm:flex-row justify-between items-center py-4 px-4 sm:px-6 border-b gap-2 sm:gap-0"
      aria-label="App header"
    >
      <div className="flex items-center w-full sm:w-auto">
        <h1 className="text-2xl font-bold mr-2" tabIndex={0} aria-label="Lexify Home">Lexify</h1>
        {isSyncing && (
          <div className="flex items-center text-base font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg ml-4 animate-pulse shadow border border-primary gap-2" aria-live="polite" aria-label="Syncing">
            <Loader2 className="h-5 w-5 mr-2 animate-spin text-primary" aria-hidden="true" />
            <span>Syncing...</span>
          </div>
        )}
        {/* Remove Local Only badge, only show Cloud Sync for authenticated users */}
        {user && (
          <span className="text-xs bg-green-200 dark:bg-green-900 px-2 py-0.5 rounded-full ml-2 text-green-900 dark:text-green-200" aria-label="Cloud Sync enabled">
            Cloud Sync
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <GuideDialog />
        <AuthButton />
        <ModeToggle />
      </div>
    </header>
  );
}
