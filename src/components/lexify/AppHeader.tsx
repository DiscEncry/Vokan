"use client";

import { ModeToggle } from "@/components/ui/mode-toggle";
import { AuthButton } from "@/components/auth/AuthButton";
import { useVocabulary } from "@/context/VocabularyContext";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export function AppHeader() {
  const { isLocalOnly, isSyncing } = useVocabulary();
  const { user } = useAuth();

  return (
    <header className="flex justify-between items-center py-4 px-6 border-b">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold mr-2">Lexify</h1>
        {isSyncing && (
          <div className="flex items-center text-xs text-muted-foreground ml-2">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Syncing...
          </div>
        )}
        {isLocalOnly && user === null && (
          <span className="text-xs bg-yellow-200 dark:bg-yellow-900 px-2 py-0.5 rounded-full ml-2 text-yellow-900 dark:text-yellow-200">
            Local Only
          </span>
        )}
        {user && (
          <span className="text-xs bg-green-200 dark:bg-green-900 px-2 py-0.5 rounded-full ml-2 text-green-900 dark:text-green-200">
            Cloud Sync
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <AuthButton />
        <ModeToggle />
      </div>
    </header>
  );
}
