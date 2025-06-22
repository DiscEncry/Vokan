"use client";

import { memo, useState, useCallback, useRef, type FC } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Word } from '@/types';
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { showStandardToast } from '@/lib/showStandardToast';
import styles from './WordList.module.css';

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

const PAGE_SIZE = 15;
const DELETE_BATCH_SIZE = 200;

const WordList: FC<WordListProps> = ({ words: propWords, isLoading, emptyMessage }) => {
  const { deleteWord, deleteWordsBatch } = useVocabulary();
  const { toast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [wordToDelete, setWordToDelete] = useState<{ id: string; text: string } | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteProgressInfo, setDeleteProgressInfo] = useState({ current: 0, total: 0 });
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [page, setPage] = useState(0);
  const initialDeleteCountRef = useRef<number>(0);

  const pageCount = Math.ceil(propWords.length / PAGE_SIZE);
  const pagedWords = propWords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Remove confirm dialog for single delete, delete immediately
  const handleDeleteWord = useCallback(async (wordId: string, wordText: string) => {
    const success = await deleteWord(wordId);
    if (success) {
      showStandardToast(toast, 'success', 'Word Deleted', `"${wordText}" has been removed from your library.`);
    } else {
      showStandardToast(toast, 'error', 'Error Deleting Word', `Could not delete "${wordText}". Please try again.`);
    }
  }, [deleteWord, toast]);

  const openDeleteAllDialog = () => {
    initialDeleteCountRef.current = propWords.length;
    setIsDeleteAllOpen(true);
  };

  const startDeleteAll = useCallback(async () => {
    setIsDeletingAll(true);
    setDeleteProgress(0);
    setDeleteProgressInfo({ current: 0, total: propWords.length });
    try {
      for (let i = 0; i < propWords.length; i += DELETE_BATCH_SIZE) {
        const batch = propWords.slice(i, i + DELETE_BATCH_SIZE);
        const batchIds = batch.map(word => word.id);
        await deleteWordsBatch(batchIds);
        const done = Math.min(i + batch.length, propWords.length);
        setDeleteProgress(Math.round((done / propWords.length) * 100));
        setDeleteProgressInfo({ current: done, total: propWords.length });
      }
      setDeleteProgress(100);
      setDeleteProgressInfo({ current: propWords.length, total: propWords.length });
      showStandardToast(toast, 'success', 'All Words Deleted', 'All words have been removed from your library.');
    } catch (e) {
      showStandardToast(toast, 'error', 'Error Deleting All Words', 'Could not delete all words. Please try again.');
    } finally {
      setIsDeletingAll(false);
      setTimeout(() => {
        setDeleteProgress(0);
        setDeleteProgressInfo({ current: 0, total: 0 });
        setIsDeleteAllOpen(false);
      }, 800);
    }
  }, [propWords, deleteWordsBatch, toast]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!propWords || propWords.length === 0) {
    return <EmptyState 
      title="Your vocabulary library is empty."
      description={emptyMessage || "Add some words or import a list to get started!"}
      icon={undefined}
    />;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <Button variant="destructive" size="sm" onClick={openDeleteAllDialog} disabled={propWords.length === 0}>
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
      <div className="rounded-xl border shadow-md overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[50%] text-sm sm:text-base">Word</TableHead>
              <TableHead className="text-sm sm:text-base">Stage</TableHead>
              <TableHead className="hidden sm:table-cell text-sm sm:text-base">Date Added</TableHead>
              <TableHead className="text-right w-[10%] text-sm sm:text-base">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedWords.map((word) => (
              <TableRow key={word.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium text-base py-4 flex items-center gap-3 min-h-[4rem]">
                  {word.text}
                  <Due isDue={isDue(word.fsrsCard.due)} />
                </TableCell>
                <TableCell><WordStageIndicator state={word.fsrsCard.state} /></TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground py-3 text-xs">
                  {formatDistanceToNow(new Date(word.dateAdded), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right py-3">
                  <Button 
                    variant="ghost"
                    size="default"
                    className={`h-10 w-10 p-0 ${styles['wordlist-delete-btn']}`}
                    onClick={() => handleDeleteWord(word.id, word.text)}
                    aria-label={`Delete word ${word.text}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={isDeleteAllOpen || isDeletingAll}
        onOpenChange={open => {
          if (!isDeletingAll) setIsDeleteAllOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ALL words?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{initialDeleteCountRef.current}</strong> words from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!isDeletingAll && (
              <>
                <AlertDialogCancel onClick={() => setIsDeleteAllOpen(false)} disabled={isDeletingAll}>
                  Cancel
                </AlertDialogCancel>
                <button
                  type="button"
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={startDeleteAll}
                  disabled={isDeletingAll}
                >
                  Delete All Words
                </button>
              </>
            )}
          </AlertDialogFooter>
          {(isDeletingAll || deleteProgress > 0) && deleteProgressInfo.total > 0 ? (
            <div className="w-full mt-4">
              <div className="w-full bg-muted rounded h-4 overflow-hidden relative">
                <div
                  className="bg-red-500 h-4 transition-all duration-300"
                  style={{ width: `${deleteProgress}%` }}
                />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white drop-shadow">
                  {deleteProgress < 100 ? `${deleteProgressInfo.current} / ${deleteProgressInfo.total}` : 'Done'}
                </div>
              </div>
            </div>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(WordList);