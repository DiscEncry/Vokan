
"use client";

import type { FC } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2, Search, AlertCircle } from 'lucide-react';
import { useVocabulary, MAX_WORD_LENGTH } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { cn } from '@/lib/utils';

const AddWordForm: FC = () => {
  const [newWord, setNewWord] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const { addWord, words: libraryWords } = useVocabulary();
  const { toast } = useToast();
  const {
    suggestions: autocompleteSuggestions,
    loading: autocompleteLoading,
    error: autocompleteError,
  } = useAutocomplete(newWord);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const suggestionsListRef = useRef<HTMLUListElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Effect to control Popover visibility
  useEffect(() => {
    if (!inputFocused || newWord.trim().length === 0 || autocompleteError) {
      setIsPopoverOpen(false);
      return;
    }

    // Input is focused, has text, and no error from autocomplete hook
    if (autocompleteLoading || autocompleteSuggestions.length > 0) {
      // Open if we are loading OR if there are suggestions to show
      setIsPopoverOpen(true);
    } else {
      // Not loading, no error, input has text, but no suggestions found
      setIsPopoverOpen(false);
    }
  }, [
    inputFocused,
    newWord,
    autocompleteLoading,
    autocompleteSuggestions, // Re-evaluate when new suggestions arrive
    autocompleteError,
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewWord(value);
    setActiveSuggestionIndex(-1); // Reset active suggestion on new input
    if (!value.trim()) {
      setIsPopoverOpen(false); // Close if input is cleared
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    // Visibility is handled by the useEffect based on newWord and suggestions
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    // Delay closing to allow click events on suggestions or submit
    setTimeout(() => {
      if (
        document.activeElement === inputRef.current ||
        (popoverContentRef.current && popoverContentRef.current.contains(document.activeElement)) ||
        (submitButtonRef.current && submitButtonRef.current.contains(document.activeElement))
      ) {
        // Focus is still on input, or moved to popover, or submit button
        return;
      }
      // If focus moved elsewhere, the useEffect for isPopoverOpen will handle it due to inputFocused changing.
      // No need to setIsPopoverOpen(false) here, as the effect handles it.
    }, 150); // Adjusted delay
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNewWord(suggestion);
    setIsPopoverOpen(false);
    setActiveSuggestionIndex(-1);
    // Wait for state update before focusing, or focus directly if not causing issues
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isPopoverOpen || autocompleteSuggestions.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault(); // Prevent cursor move in input
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < autocompleteSuggestions.length) {
          e.preventDefault();
          handleSuggestionClick(autocompleteSuggestions[activeSuggestionIndex]);
        } else {
          // Allow form submission if no suggestion is selected
          // No e.preventDefault() here, form's onSubmit will handle it
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsPopoverOpen(false);
        break;
    }
  };

  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestionsListRef.current) {
      const activeElement = suggestionsListRef.current.children[activeSuggestionIndex] as HTMLElement;
      activeElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeSuggestionIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdding) return;

    const trimmedWord = newWord.trim();

    if (!trimmedWord) {
      toast({
        title: "Empty Word",
        description: "Please enter a word to add.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedWord.length > MAX_WORD_LENGTH) {
      toast({
        title: "Word Too Long",
        description: `Words cannot exceed ${MAX_WORD_LENGTH} characters.`,
        variant: "destructive",
      });
      return;
    }

    if (libraryWords.some(w => w.text.toLowerCase() === trimmedWord.toLowerCase())) {
      toast({
        title: "Duplicate Word",
        description: `The word "${trimmedWord}" is already in your library.`,
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    const added = await addWord(trimmedWord);
    setIsAdding(false);

    if (added) {
      toast({
        title: "Word Added",
        description: `"${trimmedWord}" has been added to your library.`,
      });
      setNewWord('');
      setIsPopoverOpen(false); // Close popover on successful add
      setActiveSuggestionIndex(-1);
    } else {
      toast({
        title: "Could Not Add Word",
        description: `Failed to add "${trimmedWord}". It might already exist or an error occurred.`,
        variant: "destructive",
      });
    }
  };

  const isLoadingUI = isAdding; // Simplified loading UI state

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 items-start w-full">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverAnchor asChild>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="text"
              value={newWord}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder="Enter a new word or phrase"
              className="flex-grow w-full pl-10"
              aria-label="New word input"
              aria-autocomplete="list"
              aria-controls={isPopoverOpen ? "autocomplete-suggestions-list" : undefined}
              aria-expanded={isPopoverOpen}
              aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : undefined}
              autoComplete="off"
              disabled={isLoadingUI}
            />
          </div>
        </PopoverAnchor>
        {isPopoverOpen && ( // Only render PopoverContent if isPopoverOpen is true
          <PopoverContent
            ref={popoverContentRef}
            className="w-[--radix-popover-trigger-width] p-0"
            side="bottom"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus grab
            onCloseAutoFocus={(e) => e.preventDefault()} // Prevent focus grab on close
          >
            {autocompleteError && (
              <div className="p-2 text-sm text-red-500 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Error loading suggestions.
              </div>
            )}
            {!autocompleteError && (
              <>
                {autocompleteLoading && autocompleteSuggestions.length === 0 && (
                  // Show "Loading..." ONLY if we're loading AND there are no suggestions (stale or new)
                  <div className="p-2 text-sm text-muted-foreground">Loading suggestions...</div>
                )}
                {/* Always render suggestions if available, even if loading new ones.
                    This shows stale suggestions during a load, providing a smoother feel. */}
                {autocompleteSuggestions.length > 0 && (
                  <ScrollArea className="max-h-60">
                    <ul
                      ref={suggestionsListRef}
                      className="py-1"
                      role="listbox"
                      id="autocomplete-suggestions-list"
                    >
                      {autocompleteSuggestions.map((suggestion, index) => (
                        <li key={`${suggestion}-${index}`} role="option" aria-selected={activeSuggestionIndex === index}>
                          <Button
                            id={`suggestion-${index}`}
                            type="button"
                            variant="ghost"
                            className={cn(
                              "w-full justify-start text-left h-auto py-1.5 px-2 rounded-sm text-sm",
                              activeSuggestionIndex === index && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => handleSuggestionClick(suggestion)}
                            onMouseDown={(e) => e.preventDefault()} // Prevent input blur before click
                          >
                            {suggestion}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
                {/* The "No suggestions found" case is handled by isPopoverOpen becoming false */}
              </>
            )}
          </PopoverContent>
        )}
      </Popover>

      <Button ref={submitButtonRef} type="submit" variant="default" size="lg" disabled={isLoadingUI || !newWord.trim()} className="mt-2">
        {isAdding ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <PlusCircle className="mr-2 h-5 w-5" />
        )}
        Add Word
      </Button>
    </form>
  );
};

export default AddWordForm;

