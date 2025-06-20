"use client";
import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { VocabularyProvider } from "@/context/VocabularyContext";
import { Toaster } from "@/components/ui/toaster";
import { GoogleAnalytics } from "@/components/ui/GoogleAnalytics";
import ClientRoot from "@/components/ui/ClientRoot";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <GoogleAnalytics />
      <AuthProvider>
        <VocabularyProvider>
          <ClientRoot>
            {children}
            {/* Footer removed: compliance links will be shown in auth forms instead */}
          </ClientRoot>
          <Toaster />
        </VocabularyProvider>
      </AuthProvider>
    </>
  );
}
