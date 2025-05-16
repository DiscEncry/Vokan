
"use client";

import { memo, useState, useCallback, type FC } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Word, FamiliarityLevel } from '@/types';
import { Sparkles, Flame, ThumbsUp, BadgeCheck, HelpCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button'; // Added buttonVariants import
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useVocabulary } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';

interface WordListProps {
  words: Word[];
  isLoading?: boolean;
}

const FamiliarityIndicator: FC<{ level: FamiliarityLevel }> = memo(({ level }) => {
  switch (level) {
    case 'New':
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700"><Sparkles className="mr-1 h-3 w-3" />New</Badge>;
    case 'Learning':
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700"><Flame className="mr-1 h-3 w-3" />Learning</Badge>;
    case 'Familiar':
      return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700"><ThumbsUp className="mr-1 h-3 w-3" />Familiar</Badge>;
    case 'Mastered':
      return <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700"><BadgeCheck className="mr-1 h-3 w-3" />Mastered</Badge>;
    default:
      return <Badge variant="secondary"><HelpCircle className="mr-1 h-3 w-3" />Unknown</Badge>;
  }
});
FamiliarityIndicator.displayName = 'FamiliarityIndicator';

interface WordRowProps {
  word: Word;
  onDeleteRequest: (wordId: string, wordText: string) => void;
}

const WordRow: FC<WordRowProps> = memo(({ word, onDeleteRequest }) => (
  <TableRow key={word.id} className="hover:bg-muted/50 transition-colors">
    <TableCell className="font-medium text-base py-3">{word.text}</TableCell>
    <TableCell><FamiliarityIndicator level={word.familiarity} /></TableCell>
    <TableCell className="text-muted-foreground py-3 text-xs">
      {formatDistanceToNow(new Date(word.dateAdded), { addSuffix: true })}
    </TableCell>
    <TableCell className="text-right py-3">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => onDeleteRequest(word.id, word.text)}
        aria-label={`Delete word ${word.text}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
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

const EmptyState: FC<{ message?: string }> = ({ message }) => (
  <div className="text-center py-10 text-muted-foreground">
    <HelpCircle className="mx-auto h-12 w-12 mb-2" />
    <p className="text-lg">{message || "Your vocabulary library is empty."}</p>
    {!message && <p>Add some words or import a list to get started!</p>}
  </div>
);

const WordList: FC<WordListProps> = ({ words, isLoading }) => {
  const { deleteWord } = useVocabulary();
  const { toast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [wordToDelete, setWordToDelete] = useState<{ id: string; text: string } | null>(null);

  const handleDeleteRequest = useCallback((wordId: string, wordText: string) => {
    setWordToDelete({ id: wordId, text: wordText });
    setIsAlertOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (wordToDelete) {
      const success = await deleteWord(wordToDelete.id);
      if (success) {
        toast({
          title: "Word Deleted",
          description: `"${wordToDelete.text}" has been removed from your library.`,
        });
      } else {
        toast({
          title: "Error Deleting Word",
          description: `Could not delete "${wordToDelete.text}". Please try again.`,
          variant: "destructive",
        });
      }
      setWordToDelete(null);
      setIsAlertOpen(false);
    }
  }, [wordToDelete, deleteWord, toast]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (words.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <ScrollArea className="h-[400px] md:h-[500px] rounded-md border shadow-inner">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[50%]">Word</TableHead>
              <TableHead>Familiarity</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead className="text-right w-[10%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {words.map((word) => (
              <WordRow key={word.id} word={word} onDeleteRequest={handleDeleteRequest} />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this word?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The word <strong className="text-foreground">{wordToDelete?.text}</strong> will be permanently removed from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWordToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({variant: "destructive"})}>
              Delete Word
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(WordList);
