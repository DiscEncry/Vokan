
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Info, Loader2 } from 'lucide-react';
import type { GeneratedWordDetails } from '@/types';

interface WordDetailPanelProps {
  word: string; // The word being detailed
  generatedDetails: GeneratedWordDetails | null;
  isLoading: boolean;
}

const formatDetails = (detailsText: string): string => {
  // Basic markdown to HTML (supports newlines, bold, italic, lists)
  // Replace **text** with <strong>text</strong>
  let html = detailsText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Replace *text* or _text_ with <em>text</em>
  html = html.replace(/([*_])(.*?)\1/g, '<em>$2</em>');
  // Replace lists (- item or * item)
  html = html.replace(/^\s*[-*]\s+(.*)/gm, '<li>$1</li>');
  html = html.replace(/<\/li>\n<li>/g, '</li><li>'); // Remove newlines between li
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>'); // Wrap LIs in ULs
  // Replace newlines with <br />, but not inside <ul> or after <li> (handled by block nature)
  // This regex is a bit tricky; ensures we don't double-br inside lists.
  // A simple .replace(/\n/g, '<br />') might be okay if AI doesn't make complex lists.
  // For now, let's rely on whitespace-pre-line and careful AI formatting.
  return html; // The 'whitespace-pre-line' class will handle newlines mostly.
};


const WordDetailPanel: FC<WordDetailPanelProps> = ({ word, generatedDetails, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="shadow-lg w-full animate-pulse mt-6">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
            {word}
          </CardTitle>
           <div className="h-4 bg-muted rounded w-1/2 mt-1"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
             <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-20 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!generatedDetails || !generatedDetails.details) {
    // This case might occur if details are not yet loaded but isLoading is false
    // (e.g. initial state before any correct answer)
    return (
      <Card className="shadow-lg w-full mt-6">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Info className="mr-2 h-5 w-5 text-primary" />
            Word Details for {word}
          </CardTitle>
          <CardDescription>Details will appear here once generated.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No details available yet for "{word}".</p>
        </CardContent>
      </Card>
    );
  }
  
  // The AI response for `details` is expected to be a single string with markdown.
  // `wordDetails.word` from the AI response can be used if needed, but `word` prop is primary.
  const displayWord = generatedDetails.word || word; 

  return (
    <Card className="shadow-lg w-full mt-6">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Sparkles className="mr-2 h-6 w-6 text-primary" />
          {displayWord}
        </CardTitle>
        <CardDescription>AI-Generated Insights & Dictionary Information</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] md:h-[400px] pr-4">
          <div
            className="prose prose-sm dark:prose-invert max-w-none leading-relaxed whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: formatDetails(generatedDetails.details) }}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default WordDetailPanel;
