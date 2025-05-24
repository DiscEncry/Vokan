"use client";

import type { FC } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { useVocabulary, MAX_WORD_LENGTH } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { isValidWordLocally } from '@/lib/localWordValidator';
import { cn } from '@/lib/utils';

interface AddWordFormProps {
  disabled?: boolean;
}

const AddWordForm: FC<AddWordFormProps> = React.memo(({ disabled }) => {
  const [newWord, setNewWord] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isValidatingLocally, setIsValidatingLocally] = useState(false);
  
  // Autocomplete state
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [inputFocused, setInputFocused] = useState(false);
  const [selectionInProgress, setSelectionInProgress] = useState(false);
  const [justSelected, setJustSelected] = useState(false);

  const { addWord, words: libraryWords } = useVocabulary();
  const { toast } = useToast();
  const {
    suggestions: autocompleteSuggestions,
    loading: autocompleteLoading,
    error: autocompleteError,
    suggestionInput,
  } = useAutocomplete(newWord);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const suggestionsListRef = useRef<HTMLUListElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const lastSelectedWordRef = useRef<string>('');

  const isInitialDictionaryLoading = newWord.length === 0 && autocompleteLoading;
  const isLoadingUI = isAdding || isValidatingLocally || isInitialDictionaryLoading;

  // Effect to control Popover visibility based on focus and suggestions
  useEffect(() => {
    // Don't show popover if a selection is in progress or just happened
    if (selectionInProgress || justSelected) return;
    
    // Don't show popover if current word matches the last selected word
    if (newWord === lastSelectedWordRef.current && lastSelectedWordRef.current !== '') {
      return;
    }

    if (!inputFocused) {
      const timer = setTimeout(() => setIsPopoverOpen(false), 150);
      return () => clearTimeout(timer);
    }

    // Input is focused
    if (newWord.trim().length === 0 || autocompleteError) {
      setIsPopoverOpen(false);
      return;
    }

    if (autocompleteLoading || autocompleteSuggestions.length > 0) {
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
    }
  }, [inputFocused, newWord, autocompleteLoading, autocompleteSuggestions, autocompleteError, selectionInProgress, justSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewWord(value);
    setActiveSuggestionIndex(-1);
    setSelectionInProgress(false);
    setJustSelected(false);
    
    // If the value changes, it's no longer the selected word
    if (value !== lastSelectedWordRef.current) {
      lastSelectedWordRef.current = '';
    }
    
    if (!value.trim()) {
      setIsPopoverOpen(false);
    }
  }, []);

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    
    // Don't show popover if input matches the last selected word
    if (newWord === lastSelectedWordRef.current) {
      return;
    }
    
    // Only open popover if there's input and not in selection mode and not just selected
    if (newWord.trim() && !selectionInProgress && !justSelected && autocompleteSuggestions.length > 0) {
      setIsPopoverOpen(true);
    }
  }, [newWord, autocompleteSuggestions.length, selectionInProgress, justSelected]);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    // Flag that we're selecting to prevent popover from reopening
    setSelectionInProgress(true);
    setJustSelected(true);
    setNewWord(suggestion);
    setIsPopoverOpen(false);
    setActiveSuggestionIndex(-1);
    
    // Store the selected word to prevent reopening on the same word
    lastSelectedWordRef.current = suggestion;
    
    // Focus input after selection
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Clear selection flag after a small delay to allow focus to settle
        setTimeout(() => {
          setSelectionInProgress(false);
          // Keep justSelected true until user changes input
        }, 100);
      }
    }, 0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // If popover is closed or no suggestions, only prevent arrow events
    if (!isPopoverOpen || autocompleteSuggestions.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
        
      case 'Enter':
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < autocompleteSuggestions.length) {
          e.preventDefault();
          handleSuggestionClick(autocompleteSuggestions[activeSuggestionIndex]);
        }
        // If no suggestion is active, let the form submission handle it
        break;
        
      case 'Escape':
        e.preventDefault();
        setIsPopoverOpen(false);
        break;
        
      case 'Tab':
        // Close popover on Tab but allow normal focus navigation
        setIsPopoverOpen(false);
        break;
    }
  }, [isPopoverOpen, autocompleteSuggestions, activeSuggestionIndex, handleSuggestionClick]);

  // Scroll active suggestion into view
  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestionsListRef.current) {
      const activeElement = suggestionsListRef.current.children[activeSuggestionIndex] as HTMLElement;
      activeElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeSuggestionIndex]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoadingUI) return;

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
      setNewWord('');
      setJustSelected(false);
      lastSelectedWordRef.current = '';
      return;
    }

    setIsValidatingLocally(true);
    const isLocallyValid = await isValidWordLocally(trimmedWord);
    setIsValidatingLocally(false);

    if (!isLocallyValid) {
      toast({
        title: "Word Not Found",
        description: `"${trimmedWord}" was not found in our local dictionary. Please check the spelling.`,
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
        action: <CheckCircle className="text-green-500" />,
      });
      setNewWord('');
      setIsPopoverOpen(false);
      setActiveSuggestionIndex(-1);
      setJustSelected(false);
      lastSelectedWordRef.current = '';
    } else {
      toast({
        title: "Could Not Add Word",
        description: `Failed to add "${trimmedWord}".`,
        variant: "destructive",
      });
    }
  }, [newWord, addWord, libraryWords, toast, isLoadingUI]);

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
              placeholder={isInitialDictionaryLoading ? "Initializing dictionary..." : "Enter a new word or phrase"}
              className="flex-grow w-full pl-10"
              aria-label="New word input"
              aria-autocomplete="list"
              aria-controls={isPopoverOpen ? "autocomplete-suggestions-list" : undefined}
              aria-expanded={isPopoverOpen}
              aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : undefined}
              autoComplete="off"
              disabled={disabled || isLoadingUI}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={popoverContentRef}
          className="w-[--radix-popover-trigger-width] p-0"
          side="bottom"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {autocompleteError && (
            <div className="p-2 text-sm text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Error loading suggestions: {autocompleteError}
            </div>
          )}
          {!autocompleteError && (
            <>
              {autocompleteLoading && autocompleteSuggestions.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">Loading suggestions...</div>
              )}

              {autocompleteSuggestions.length > 0 && (
                <ScrollArea className="max-h-60">
                  <ul
                    ref={suggestionsListRef}
                    className="py-1"
                    role="listbox"
                    id="autocomplete-suggestions-list"
                  >
                    {autocompleteSuggestions.map((suggestion, index) => {
                      const suggestionTrimmed = suggestion.trim();
                      const inputTrimmed = newWord.trim();
                      let matchLength = 0;

                      // Find the length of the matching prefix, case-insensitively
                      for (let i = 0; i < inputTrimmed.length; i++) {
                          if (i < suggestionTrimmed.length && inputTrimmed[i].toLowerCase() === suggestionTrimmed[i].toLowerCase()) {
                              matchLength++;
                          } else {
                              break;
                          }
                      }
                      
                      const head = suggestionTrimmed.slice(0, matchLength);
                      const tail = suggestionTrimmed.slice(matchLength);

                      return (
                        <li key={`${suggestionTrimmed}-${index}`} role="option" aria-selected={activeSuggestionIndex === index}>
                          <Button
                            id={`suggestion-${index}`}
                            type="button"
                            variant="ghost"
                            className={cn(
                              "w-full justify-start text-left h-auto py-1.5 px-2 rounded-sm text-sm",
                              activeSuggestionIndex === index && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => handleSuggestionClick(suggestionTrimmed)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <span>
                              <strong className="font-bold">{head}</strong>
                              {tail}
                            </span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
               {!autocompleteLoading && newWord.trim() && autocompleteSuggestions.length === 0 && !autocompleteError && (
                <div className="p-2 text-sm text-muted-foreground">No suggestions found</div>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>

      <Button 
        ref={submitButtonRef} 
        type="submit" 
        variant="default" 
        size="lg" 
        disabled={disabled || isLoadingUI || !newWord.trim()} 
        className="mt-2"
      >
        {isAdding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 
         isValidatingLocally ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 
         isInitialDictionaryLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> :
         <PlusCircle className="mr-2 h-5 w-5" />}
        {isAdding ? "Adding..." : 
         isValidatingLocally ? "Validating..." : 
         isInitialDictionaryLoading ? "Loading List..." : 
         "Add Word"}
      </Button>
    </form>
  );
});

AddWordForm.displayName = 'AddWordForm';
export default AddWordForm;