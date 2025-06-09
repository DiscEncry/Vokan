import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext';
import { VocabularyProvider } from '@/context/VocabularyContext';
import { ThemeProvider } from "next-themes"; // Added import
import { GlobalErrorBoundary } from '@/components/ui/GlobalErrorBoundary';
import { GoogleAnalytics } from '@/components/ui/GoogleAnalytics';
import AppShell from '@/components/ui/AppShell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthDialogProvider } from "@/context/AuthDialogContext";
import AuthDialog from "@/components/auth/AuthDialog";
import { ThemeProvider as CustomThemeProvider } from "@/context/ThemeContext";

// Use Inter as the default sans-serif font
const fontSans = FontSans({ 
  subsets: ['latin'], 
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Vokan - Vocabulary Learning',
  description: 'AI-powered vocabulary learning app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        'min-h-screen bg-background font-sans antialiased',
        fontSans.variable
      )}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <AuthDialogProvider>
              <AuthProvider>
                <CustomThemeProvider>
                  <AuthDialog />
                  <AppShell>
                    {children}
                  </AppShell>
                </CustomThemeProvider>
              </AuthProvider>
            </AuthDialogProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
