"use client";
import { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

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
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}
