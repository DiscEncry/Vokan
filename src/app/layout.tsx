import type { Metadata } from 'next';
// Removed GeistSans import
// Removed GeistMono import: import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { VocabularyProvider } from '@/context/VocabularyContext';

export const metadata: Metadata = {
  title: 'Lexify - Contextual Vocabulary Learning',
  description: 'Learn vocabulary in context with AI-powered exercises and spaced repetition.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"> {/* Removed GeistSans.variable */}
        <VocabularyProvider>
          {children}
          <Toaster />
        </VocabularyProvider>
      </body>
    </html>
  );
}
