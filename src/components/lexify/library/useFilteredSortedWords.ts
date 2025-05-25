import { useMemo, useCallback } from 'react';
import { isDue } from '@/lib/utils';
import type { Word } from '@/types';

export type SortOption = 'dateAdded_desc' | 'dateAdded_asc' | 'alphabetical_asc' | 'alphabetical_desc';

const sortFunctions = {
  dateAdded_asc: (a: Word, b: Word) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime(),
  dateAdded_desc: (a: Word, b: Word) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
  alphabetical_asc: (a: Word, b: Word) => a.text.localeCompare(b.text),
  alphabetical_desc: (a: Word, b: Word) => b.text.localeCompare(a.text),
};

export function useFilteredSortedWords({
  words,
  searchTerm,
  stageFilter,
  multiStageFilter,
  reviewDueOnly,
  sortOrder,
  isLoading,
}: {
  words: Word[];
  searchTerm: string;
  stageFilter: 'New' | 'Learning' | 'Review' | 'Relearning' | 'all';
  multiStageFilter: Array<'New' | 'Learning' | 'Review' | 'Relearning'>;
  reviewDueOnly: boolean;
  sortOrder: SortOption;
  isLoading: boolean;
}) {
  const filterBySearchAndStage = useCallback((word: Word) => {
    const matchesSearch = !searchTerm || word.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = multiStageFilter.length > 0
      ? multiStageFilter.includes(word.fsrsCard.state)
      : (stageFilter === 'all' || word.fsrsCard.state === stageFilter);
    const matchesReviewDue = !reviewDueOnly || isDue(word.fsrsCard.due);
    return matchesSearch && matchesStage && matchesReviewDue;
  }, [searchTerm, stageFilter, multiStageFilter, reviewDueOnly]);

  const filteredAndSortedWords = useMemo(() => {
    if (!words.length || isLoading) return [];
    const filteredWords = words.filter(filterBySearchAndStage);
    return [...filteredWords].sort(sortFunctions[sortOrder]);
  }, [words, filterBySearchAndStage, sortOrder, isLoading]);

  return {
    filteredAndSortedWords,
    filteredCount: filteredAndSortedWords.length,
    totalCount: words.length,
  };
}
