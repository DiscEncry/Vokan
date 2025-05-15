"use client";

import type { FC } from 'react';
import React, { useState, useMemo } from 'react';
import AddWordForm from './AddWordForm';
import ImportWordsSection from './ImportWordsSection';
import WordList from './WordList';
import WordFilters from './WordFilters';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, FamiliarityLevel } from '@/types';
import { Separator } from '@/components/ui/separator';

const LibraryTabContent: FC = () => {
  const { words, isLoading } = useVocabulary();
  const [searchTerm, setSearchTerm] = useState('');
  const [familiarityFilter, setFamiliarityFilter] = useState<FamiliarityLevel | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'dateAdded_desc' | 'dateAdded_asc' | 'alphabetical_asc' | 'alphabetical_desc'>('dateAdded_desc');

  const filteredAndSortedWords = useMemo(() => {
    let processedWords = [...words];

    // Filter by search term
    if (searchTerm) {
      processedWords = processedWords.filter(word =>
        word.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by familiarity
    if (familiarityFilter !== 'all') {
      processedWords = processedWords.filter(word => word.familiarity === familiarityFilter);
    }

    // Sort
    switch (sortOrder) {
      case 'dateAdded_asc':
        processedWords.sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
        break;
      case 'dateAdded_desc':
        processedWords.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
        break;
      case 'alphabetical_asc':
        processedWords.sort((a, b) => a.text.localeCompare(b.text));
        break;
      case 'alphabetical_desc':
        processedWords.sort((a, b) => b.text.localeCompare(a.text));
        break;
    }

    return processedWords;
  }, [words, searchTerm, familiarityFilter, sortOrder]);
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setFamiliarityFilter('all');
    setSortOrder('dateAdded_desc');
  };


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
          onSearchTermChange={setSearchTerm}
          familiarityFilter={familiarityFilter}
          onFamiliarityFilterChange={setFamiliarityFilter}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          onResetFilters={handleResetFilters}
        />
        <div className="mt-6">
          <WordList words={filteredAndSortedWords} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default LibraryTabContent;
