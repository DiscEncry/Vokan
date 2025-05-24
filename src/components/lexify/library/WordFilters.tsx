"use client";

import type { FC } from 'react';
import React, { useMemo, useRef, useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowDownUp, RotateCcw } from 'lucide-react';

interface WordFiltersProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  stageFilter: 'New' | 'Learning' | 'Review' | 'Relearning' | 'all';
  onStageFilterChange: (filter: 'New' | 'Learning' | 'Review' | 'Relearning' | 'all') => void;
  sortOrder: 'dateAdded_asc' | 'dateAdded_desc' | 'alphabetical_asc' | 'alphabetical_desc';
  onSortOrderChange: (order: 'dateAdded_asc' | 'dateAdded_desc' | 'alphabetical_asc' | 'alphabetical_desc') => void;
  onResetFilters: () => void;
  multiStageFilter: Array<'New' | 'Learning' | 'Review' | 'Relearning'>;
  onMultiStageChange: (stage: 'New' | 'Learning' | 'Review' | 'Relearning', checked: boolean) => void;
  reviewDueOnly: boolean;
  onReviewDueChange: (checked: boolean) => void;
}

const WordFilters: FC<WordFiltersProps> = ({
  searchTerm,
  onSearchTermChange,
  stageFilter,
  onStageFilterChange,
  sortOrder,
  onSortOrderChange,
  onResetFilters,
  multiStageFilter,
  onMultiStageChange,
  reviewDueOnly,
  onReviewDueChange,
}) => {
  const stageOptions: { value: 'all' | 'New' | 'Learning' | 'Review' | 'Relearning'; label: string }[] = [
    { value: 'all', label: 'All Stages' },
    { value: 'New', label: 'New' },
    { value: 'Learning', label: 'Learning' },
    { value: 'Review', label: 'Review' },
    { value: 'Relearning', label: 'Relearning' },
  ];

  const sortOptions = [
    { value: 'dateAdded_desc', label: 'Date Added (Newest)' },
    { value: 'dateAdded_asc', label: 'Date Added (Oldest)' },
    { value: 'alphabetical_asc', label: 'Alphabetical (A-Z)' },
    { value: 'alphabetical_desc', label: 'Alphabetical (Z-A)' },
  ];

  // Debounced search input for performance
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounce handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      onSearchTermChange(value);
    }, 350);
  }, [onSearchTermChange]);

  // Keep local input in sync if searchTerm is reset externally
  React.useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  return (
    <div className="p-5 bg-card border rounded-xl shadow-md space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Search Input */}
        <div className="space-y-2">
          <label htmlFor="search-word" className="text-sm font-medium text-muted-foreground">Search Word</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-word"
              type="text"
              placeholder="Search your library..."
              value={localSearch}
              onChange={handleInputChange}
              className="pl-10 bg-background border-input focus:ring-2 focus:ring-ring focus:ring-offset-1"
              aria-label="Search words"
            />
          </div>
        </div>

        {/* Multi-Stage Filter (Checkboxes) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Filter by Stages</label>
          <div className="flex flex-wrap gap-3 mt-2">
            {['New', 'Learning', 'Review', 'Relearning'].map(stage => (
              <label key={stage} className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={multiStageFilter.includes(stage as any)}
                    onChange={e => onMultiStageChange(stage as any, e.target.checked)}
                    className="peer sr-only"
                    aria-label={`Filter by ${stage}`}
                  />
                  <div className="w-4 h-4 border rounded border-muted-foreground peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-all">
                    {multiStageFilter.includes(stage as any) && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm group-hover:text-primary transition-colors">{stage}</span>
              </label>
            ))}
            
            {/* Review Due Option */}
            <label className="flex items-center gap-2 cursor-pointer group mt-2 w-full">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={reviewDueOnly}
                  onChange={e => onReviewDueChange(e.target.checked)}
                  className="peer sr-only"
                  aria-label="Show only review due words"
                />
                <div className="w-4 h-4 border rounded border-muted-foreground peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-all">
                  {reviewDueOnly && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm group-hover:text-primary transition-colors">Due for review</span>
            </label>
          </div>
        </div>

        {/* Sort Order */}
        <div className="space-y-2">
          <label htmlFor="sort-order" className="text-sm font-medium text-muted-foreground">Sort by</label>
          <Select
            value={sortOrder}
            onValueChange={(value) => onSortOrderChange(value as 'dateAdded_asc' | 'dateAdded_desc' | 'alphabetical_asc' | 'alphabetical_desc')}
          >
            <SelectTrigger id="sort-order" aria-label="Sort order" className="bg-background w-full">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button 
          onClick={onResetFilters} 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2 hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset Filters
        </Button>
      </div>
    </div>
  );
};

export default WordFilters;