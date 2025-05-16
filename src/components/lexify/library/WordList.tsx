"use client";

import { memo, useMemo, useCallback, type FC } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Word, FamiliarityLevel } from '@/types';
import { Sparkles, Flame, ThumbsUp, BadgeCheck, HelpCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface WordListProps {
  words: Word[];
  isLoading?: boolean;
}

// Memoized to prevent unnecessary re-renders when parent components update
const FamiliarityIndicator: FC<{ level: FamiliarityLevel }> = memo(({ level }) => {
  switch (level) {
    case 'New':
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300"><Sparkles className="mr-1 h-3 w-3" />New</Badge>;
    case 'Learning':
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300"><Flame className="mr-1 h-3 w-3" />Learning</Badge>;
    case 'Familiar':
      return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300"><ThumbsUp className="mr-1 h-3 w-3" />Familiar</Badge>;
    case 'Mastered':
      return <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-300"><BadgeCheck className="mr-1 h-3 w-3" />Mastered</Badge>;
    default:
      return <Badge variant="secondary"><HelpCircle className="mr-1 h-3 w-3" />Unknown</Badge>;
  }
});

FamiliarityIndicator.displayName = 'FamiliarityIndicator';

// Memoized table row to prevent re-rendering all rows when only one changes
const WordRow: FC<{ word: Word }> = memo(({ word }) => (
  <TableRow key={word.id} className="hover:bg-muted/50 transition-colors">
    <TableCell className="font-medium text-base py-3">{word.text}</TableCell>
    <TableCell><FamiliarityIndicator level={word.familiarity} /></TableCell>
    <TableCell className="text-right text-sm text-muted-foreground py-3">
      {formatDistanceToNow(new Date(word.dateAdded), { addSuffix: true })}
    </TableCell>
  </TableRow>
));

WordRow.displayName = 'WordRow';

const LoadingSkeleton: FC = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <Skeleton key={i} className="h-12 rounded animate-pulse" />
    ))}
  </div>
);

const EmptyState: FC = () => (
  <div className="text-center py-10 text-muted-foreground">
    <HelpCircle className="mx-auto h-12 w-12 mb-2" />
    <p className="text-lg">Your vocabulary library is empty.</p>
    <p>Add some words or import a list to get started!</p>
  </div>
);

const WordList: FC<WordListProps> = ({ words, isLoading }) => {
  // Early return for loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Early return for empty state
  if (words.length === 0) {
    return <EmptyState />;
  }

  // Virtualize the list if it's very large (future enhancement)
  return (
    <ScrollArea className="h-[400px] md:h-[500px] rounded-md border shadow-inner">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="w-[60%]">Word</TableHead>
            <TableHead>Familiarity</TableHead>
            <TableHead className="text-right">Date Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {words.map((word) => (
            <WordRow key={word.id} word={word} />
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
};

export default memo(WordList);
