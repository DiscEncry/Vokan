"use client";

import { ReactNode, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuthDialog } from "@/context/AuthDialogContext";

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="mb-2">An unexpected error occurred. Please refresh the page or try again later.</p>
      <pre className="text-xs text-red-500 overflow-x-auto max-w-full">{error.message}</pre>
    </div>
  );
}

export default function ClientRoot({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { loading: profileLoading } = useUserProfile();
  const { openDialog } = useAuthDialog();

  useEffect(() => {
    if (!user) {
      openDialog(false);
    }
  }, [user, openDialog]);

  if (isLoading || profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}