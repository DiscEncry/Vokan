"use client";

import type { FC } from 'react';
import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import AddWordForm from './AddWordForm';
import WordFilters from './WordFilters';
import { useVocabulary } from '@/context/VocabularyContext';
import { saveAs } from 'file-saver';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useFilteredSortedWords, SortOption } from './useFilteredSortedWords';
import { Separator } from '@/components/ui/separator';
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/firebase/userProfile";

// Dynamic imports with loading fallbacks
const ImportWordsSection = dynamic(() => import('./ImportWordsSection'), {
  loading: () => <div className="h-36 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground">Loading import section...</div>,
  ssr: false // Disable SSR since this component likely handles file uploads
});

const WordList = dynamic(() => import('./WordList'), {
  loading: () => <div className="h-24 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground">Loading word list...</div>
});

const LibraryTabContent = () => {
  const { words, isLoading, isSyncing } = useVocabulary();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<'New' | 'Learning' | 'Review' | 'Relearning' | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOption>('dateAdded_desc');
  const [multiStageFilter, setMultiStageFilter] = useState<Array<'New' | 'Learning' | 'Review' | 'Relearning'>>([]);
  const [reviewDueOnly, setReviewDueOnly] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Use shared hook for filtering/sorting
  const { filteredAndSortedWords, filteredCount, totalCount } = useFilteredSortedWords({
    words,
    searchTerm,
    stageFilter,
    multiStageFilter,
    reviewDueOnly,
    sortOrder,
    isLoading,
  });

  React.useEffect(() => {
    if (user) {
      setProfileLoading(true);
      getUserProfile(user.uid).then(p => {
        setProfile(p);
        setProfileLoading(false);
      });
    }
  }, [user]);

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setStageFilter('all');
    setSortOrder('dateAdded_desc');
  }, []);

  // Memoize handlers for filter changes
  const handleSearchTermChange = useCallback((value: string) => {
    // Only update filter if value actually changed
    setSearchTerm(prev => (prev === value ? prev : value));
  }, []);

  const handleStageFilterChange = useCallback((value: 'New' | 'Learning' | 'Review' | 'Relearning' | 'all') => {
    setStageFilter(value);
  }, []);

  const handleSortOrderChange = useCallback((value: SortOption) => {
    setSortOrder(value);
  }, []);

  // Handlers for multi-stage filter
  const handleMultiStageChange = useCallback((stage: 'New' | 'Learning' | 'Review' | 'Relearning', checked: boolean) => {
    setMultiStageFilter(prev => checked ? [...prev, stage] : prev.filter(s => s !== stage));
  }, []);

  // Export as CSV
  const handleExportCSV = useCallback(() => {
    if (!words.length) return;
    const header = 'Word,Stage,Date Added,Last Reviewed';
    const rows = words.map(w => [
      '"' + w.text.replace(/"/g, '""') + '"',
      w.fsrsCard.state,
      w.dateAdded,
      w.fsrsCard.last_review || ''
    ].join(','));
    const csvContent = [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `vokan-vocabulary-${new Date().toISOString().slice(0,10)}.csv`);
  }, [words]);

  // Export as JSON
  const handleExportJSON = useCallback(() => {
    if (!words.length) return;
    const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
    saveAs(blob, `vokan-vocabulary-${new Date().toISOString().slice(0,10)}.json`);
  }, [words]);

  // Export as TXT (words only)
  const handleExportTXT = useCallback(() => {
    if (!words.length) return;
    const txt = words.map(w => w.text).join('\r\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `vokan-words-${new Date().toISOString().slice(0,10)}.txt`);
  }, [words]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <div className="flex-1 flex items-center gap-2">
          {/* Other controls (filters, add, etc.) can go here */}
        </div>
        <div className="flex-shrink-0 flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading || !words.length}
                className="h-8 px-3"
              >
                <Download className="h-4 w-4" />
                <span className="ml-2">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>Export as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportTXT}>Export as .txt (only words)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
           <h2 className="text-xl sm:text-2xl font-semibold">Add New Word</h2>
           <AddWordForm disabled={isSyncing} />
        </div>
        <ImportWordsSection disabled={isSyncing} />
      </div>
      
      <Separator className="my-8" />

      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">My Vocabulary Library</h2>
        <WordFilters
          searchTerm={searchTerm}
          onSearchTermChange={handleSearchTermChange}
          stageFilter={stageFilter}
          onStageFilterChange={handleStageFilterChange}
          sortOrder={sortOrder}
          onSortOrderChange={handleSortOrderChange}
          onResetFilters={handleResetFilters}
          multiStageFilter={multiStageFilter}
          onMultiStageChange={handleMultiStageChange}
          reviewDueOnly={reviewDueOnly}
          onReviewDueChange={setReviewDueOnly}
        />
        <div className="mt-2 text-sm text-muted-foreground">
          Showing {filteredCount} of {totalCount} words
        </div>
        <div className="mt-6">
          <WordList
            words={filteredAndSortedWords}
            isLoading={isLoading}
            emptyMessage={
              !isLoading && totalCount > 0 && filteredCount === 0
                ? "No words found matching your search."
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(LibraryTabContent);
