"use client";
if (typeof window === 'undefined') {
  require('@/lib/sentry.server');
} else {
  require('@/lib/sentry.client');
}
import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { VocabularyProvider } from "@/context/VocabularyContext";
import { Toaster } from "@/components/ui/toaster";
import { GoogleAnalytics } from "@/components/ui/GoogleAnalytics";
import ClientRoot from "@/components/ui/ClientRoot";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <GoogleAnalytics />
      <AuthProvider>
        <VocabularyProvider>
          <ClientRoot>
            {children}
            <footer className="w-full text-center text-xs text-gray-500 py-4 border-t mt-8">
              <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline mx-2">Privacy Policy</a>
              |
              <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline mx-2">Terms of Service</a>
            </footer>
          </ClientRoot>
          <Toaster />
        </VocabularyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
