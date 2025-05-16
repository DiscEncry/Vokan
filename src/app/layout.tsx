
import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext';
import { VocabularyProvider } from '@/context/VocabularyContext';
import { ThemeProvider } from "next-themes"; // Added import

// Use Inter as the default sans-serif font
const fontSans = FontSans({ 
  subsets: ['latin'], 
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Lexify - Vocabulary Learning',
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <VocabularyProvider>
              {children}
              <Toaster />
            </VocabularyProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
