"use client";

import type { FC } from 'react';
import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import AddWordForm from './AddWordForm';
import WordFilters from './WordFilters';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, FamiliarityLevel } from '@/types';
import { Separator } from '@/components/ui/separator';

// Dynamic imports with loading fallbacks
const ImportWordsSection = dynamic(() => import('./ImportWordsSection'), {
  loading: () => <div className="h-36 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground">Loading import section...</div>,
  ssr: false // Disable SSR since this component likely handles file uploads
});

const WordList = dynamic(() => import('./WordList'), {
  loading: () => <div className="h-24 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground">Loading word list...</div>
});

// Type definition for sort options
type SortOption = 'dateAdded_desc' | 'dateAdded_asc' | 'alphabetical_asc' | 'alphabetical_desc';

// Memoized sort functions to avoid recreating functions on each render
const sortFunctions = {
  dateAdded_asc: (a: Word, b: Word) => {
    const dateA = new Date(a.dateAdded).getTime();
    const dateB = new Date(b.dateAdded).getTime();
    return dateA - dateB;
  },
  dateAdded_desc: (a: Word, b: Word) => {
    const dateA = new Date(a.dateAdded).getTime();
    const dateB = new Date(b.dateAdded).getTime();
    return dateB - dateA;
  },
  alphabetical_asc: (a: Word, b: Word) => a.text.localeCompare(b.text),
  alphabetical_desc: (a: Word, b: Word) => b.text.localeCompare(a.text)
};

const LibraryTabContent: FC = () => {
  const { words, isLoading } = useVocabulary();
  const [searchTerm, setSearchTerm] = useState('');
  const [familiarityFilter, setFamiliarityFilter] = useState<FamiliarityLevel | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOption>('dateAdded_desc');

  // Memoized filter function
  const filterBySearchAndFamiliarity = useCallback((word: Word) => {
    // Skip search filtering if no search term
    const matchesSearch = !searchTerm || 
      word.text.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Skip familiarity filtering if set to 'all'
    const matchesFamiliarity = familiarityFilter === 'all' || 
      word.familiarity === familiarityFilter;
    
    return matchesSearch && matchesFamiliarity;
  }, [searchTerm, familiarityFilter]);

  // Optimized memoized processing of words
  const filteredAndSortedWords = useMemo(() => {
    // Early return if no words or still loading
    if (!words.length || isLoading) return [];
    
    // Apply filtering first to reduce the dataset before sorting
    const filteredWords = words.filter(filterBySearchAndFamiliarity);
    
    // Apply sorting using pre-defined sort functions
    return [...filteredWords].sort(sortFunctions[sortOrder]);
  }, [words, filterBySearchAndFamiliarity, sortOrder, isLoading]);
  
  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setFamiliarityFilter('all');
    setSortOrder('dateAdded_desc');
  }, []);

  // Memoize handlers for filter changes
  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleFamiliarityFilterChange = useCallback((value: FamiliarityLevel | 'all') => {
    setFamiliarityFilter(value);
  }, []);

  const handleSortOrderChange = useCallback((value: SortOption) => {
    setSortOrder(value);
  }, []);

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
           <h2 className="text-2xl font-semibold">Add New Word</h2>
           <AddWordForm />
        </div>
        <ImportWordsSection />
      </div>
      
      <Separator className="my-8" />

      <div>
        <h2 className="text-2xl font-semibold mb-4">My Vocabulary Library</h2>
        <WordFilters
          searchTerm={searchTerm}
          onSearchTermChange={handleSearchTermChange}
          familiarityFilter={familiarityFilter}
          onFamiliarityFilterChange={handleFamiliarityFilterChange}
          sortOrder={sortOrder}
          onSortOrderChange={handleSortOrderChange}
          onResetFilters={handleResetFilters}
        />
        <div className="mt-6">
          <WordList
            words={filteredAndSortedWords}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(LibraryTabContent);
