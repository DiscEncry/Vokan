"use client";

import type { FC } from 'react';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, ArrowDownUp, RotateCcw } from 'lucide-react';
import type { FamiliarityLevel } from '@/types';

interface WordFiltersProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  familiarityFilter: FamiliarityLevel | 'all';
  onFamiliarityFilterChange: (filter: FamiliarityLevel | 'all') => void;
  sortOrder: 'dateAdded_asc' | 'dateAdded_desc' | 'alphabetical_asc' | 'alphabetical_desc';
  onSortOrderChange: (order: 'dateAdded_asc' | 'dateAdded_desc' | 'alphabetical_asc' | 'alphabetical_desc') => void;
  onResetFilters: () => void;
}

const WordFilters: FC<WordFiltersProps> = ({
  searchTerm,
  onSearchTermChange,
  familiarityFilter,
  onFamiliarityFilterChange,
  sortOrder,
  onSortOrderChange,
  onResetFilters,
}) => {
  const familiarityOptions: { value: FamiliarityLevel | 'all'; label: string }[] = [
    { value: 'all', label: 'All Familiarities' },
    { value: 'New', label: 'New' },
    { value: 'Learning', label: 'Learning' },
    { value: 'Familiar', label: 'Familiar' },
    { value: 'Mastered', label: 'Mastered' },
  ];

  const sortOptions = [
    { value: 'dateAdded_desc', label: 'Date Added (Newest)' },
    { value: 'dateAdded_asc', label: 'Date Added (Oldest)' },
    { value: 'alphabetical_asc', label: 'Alphabetical (A-Z)' },
    { value: 'alphabetical_desc', label: 'Alphabetical (Z-A)' },
  ];

  return (
    <div className="p-4 bg-card border rounded-lg shadow space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        {/* Search Input */}
        <div className="space-y-1">
          <label htmlFor="search-word" className="text-sm font-medium text-muted-foreground">Search Word</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-word"
              type="text"
              placeholder="Search your library..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10"
              aria-label="Search words"
            />
          </div>
        </div>

        {/* Familiarity Filter */}
        <div className="space-y-1">
          <label htmlFor="familiarity-filter" className="text-sm font-medium text-muted-foreground">Filter by Familiarity</label>
          <Select
            value={familiarityFilter}
            onValueChange={(value) => onFamiliarityFilterChange(value as FamiliarityLevel | 'all')}
          >
            <SelectTrigger id="familiarity-filter" aria-label="Filter by familiarity">
              <Filter className="h-4 w-4 text-muted-foreground mr-2" />
              <SelectValue placeholder="Filter by familiarity" />
            </SelectTrigger>
            <SelectContent>
              {familiarityOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Order */}
        <div className="space-y-1">
          <label htmlFor="sort-order" className="text-sm font-medium text-muted-foreground">Sort by</label>
          <Select
            value={sortOrder}
            onValueChange={(value) => onSortOrderChange(value as 'dateAdded_asc' | 'dateAdded_desc' | 'alphabetical_asc' | 'alphabetical_desc')}
          >
            <SelectTrigger id="sort-order" aria-label="Sort order">
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
       <Button onClick={onResetFilters} variant="outline" size="sm" className="mt-2">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
    </div>
  );
};

export default WordFilters;
