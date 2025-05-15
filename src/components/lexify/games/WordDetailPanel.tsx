"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Info } from 'lucide-react';
import type { GeneratedWordDetails } from '@/types';

interface WordDetailPanelProps {
  wordDetails: GeneratedWordDetails | null;
  isLoading: boolean;
}

// Basic markdown to HTML (supports newlines, bold, italic)
// A more robust solution would use a library like 'marked' or 'react-markdown'
// but avoiding new dependencies as per instruction.
const formatDetails = (details: string): string => {
  return details
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>')     // Italic
    .replace(/\n/g, '<br />');                 // Newlines
};


const WordDetailPanel: FC<WordDetailPanelProps> = ({ wordDetails, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="shadow-lg w-full animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mt-1"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-20 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!wordDetails) {
    return (
      <Card className="shadow-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-6 w-6 text-primary" />
            Word Details
          </CardTitle>
          <CardDescription>Details will appear here once you answer correctly.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No word selected or details available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Sparkles className="mr-2 h-6 w-6 text-primary" />
          {wordDetails.word}
        </CardTitle>
        <CardDescription>AI-Generated Insights</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] md:h-[400px] pr-4">
          {/* Using dangerouslySetInnerHTML to render basic HTML from AI response. 
              Ensure AI output is trusted or sanitized if it can include complex HTML/scripts.
              For this project, assuming AI output is safe text with basic formatting. */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none leading-relaxed whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: formatDetails(wordDetails.details) }}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default WordDetailPanel;
