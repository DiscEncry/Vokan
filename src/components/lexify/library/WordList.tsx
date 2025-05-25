"use client";

import React, { memo, useState, useCallback, type FC } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Word } from '@/types';
import { Sparkles, Flame, ThumbsUp, BadgeCheck, HelpCircle, Trash2, CalendarClock } from 'lucide-react';
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
import { EmptyState } from "@/components/ui/EmptyState";
import { isDue } from '@/lib/utils';
import { Due } from './Due';
import { WordStageIndicator } from '../games/WordStageIndicator';

interface WordListProps {
  words: Word[];
  isLoading?: boolean;
  emptyMessage?: string; // Optional custom empty state message
}

const LoadingSkeleton: FC = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <Skeleton key={i} className="h-12 rounded animate-pulse" />
    ))}
  </div>
);

const ROW_HEIGHT = 56; // px, adjust as needed for your row height
const VISIBLE_COUNT = 9; // Number of rows visible at once (for 500px container)
const PAGE_SIZE = 50;

const WordList: FC<WordListProps> = ({ words, isLoading, emptyMessage }) => {
  const { deleteWord, isLocalOnly } = useVocabulary();
  const { toast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [wordToDelete, setWordToDelete] = useState<{ id: string; text: string } | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(words.length / PAGE_SIZE);
  const pagedWords = words.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  // Delete all words handler
  const handleDeleteAll = useCallback(async () => {
    setIsDeletingAll(true);
    try {
      if (isLocalOnly) {
        localStorage.removeItem('lexify-vocabulary');
        toast({ title: 'All Words Deleted', description: 'All words have been removed from your library.' });
        window.location.reload();
      } else {
        // Cloud: delete all words in parallel for performance
        const results = await Promise.allSettled(words.map(word => deleteWord(word.id)));
        const failed = results.filter(r => r.status === 'rejected').length;
        toast({
          title: 'All Words Deleted',
          description: failed === 0
            ? 'All words have been removed from your library.'
            : `Some words could not be deleted (${failed} failed). Please refresh and try again if needed.`,
          variant: failed === 0 ? undefined : 'destructive',
        });
      }
    } catch (e) {
      toast({ title: 'Error Deleting All Words', description: 'Could not delete all words. Please try again.', variant: 'destructive' });
    } finally {
      setIsDeletingAll(false);
      setIsDeleteAllOpen(false);
    }
  }, [isLocalOnly, words, deleteWord, toast]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!words || words.length === 0) {
    return <EmptyState 
      title="Your vocabulary library is empty."
      description={emptyMessage || "Add some words or import a list to get started!"}
      icon={undefined}
    />;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <Button variant="destructive" size="sm" onClick={() => setIsDeleteAllOpen(true)} disabled={words.length === 0}>
          Delete All Words
        </Button>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
            <span className="text-sm">Page {page + 1} of {pageCount}</span>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page === pageCount - 1}>Next</Button>
          </div>
        )}
      </div>
      <ScrollArea className="h-[400px] md:h-[500px] rounded-md border shadow-inner">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[50%]">Word</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead className="text-right w-[10%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedWords.map((word) => (
              <TableRow key={word.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium text-base py-3 flex items-center gap-2">
                  {word.text}
                  <Due isDue={isDue(word.fsrsCard.due)} />
                </TableCell>
                <TableCell><WordStageIndicator state={word.fsrsCard.state} /></TableCell>
                <TableCell className="text-muted-foreground py-3 text-xs">
                  {formatDistanceToNow(new Date(word.dateAdded), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right py-3">
                  <Button 
                    variant="ghost"
                    size="sm" 
                    onClick={() => handleDeleteRequest(word.id, word.text)}
                    aria-label={`Delete word ${word.text}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
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

      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ALL words?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{words.length}</strong> words from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteAllOpen(false)} disabled={isDeletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className={buttonVariants({variant: "destructive"})} disabled={isDeletingAll}>
              {isDeletingAll ? 'Deleting...' : 'Delete All Words'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(WordList);
