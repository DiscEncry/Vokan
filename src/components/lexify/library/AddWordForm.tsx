
"use client";

import type { FC } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2, Search, AlertCircle } from 'lucide-react';
import { useVocabulary, MAX_WORD_LENGTH } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { isValidWordLocally } from '@/lib/localWordValidator'; // Import new validator
import { cn } from '@/lib/utils';

const AddWordForm: FC = React.memo(() => {
  const [newWord, setNewWord] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isValidatingLocally, setIsValidatingLocally] = useState(false); // New state for local validation

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [inputFocused, setInputFocused] = useState(false);

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

  const isInitialDictionaryLoading = newWord.length === 0 && autocompleteLoading;
  const isLoadingUI = isAdding || isValidatingLocally || isInitialDictionaryLoading;

  // Effect to update suggestions based on autocomplete hook
  useEffect(() => {
    if (autocompleteError) {
      setSuggestions([]);
      // Keep popover open to show error if input is focused
      setIsPopoverOpen(inputFocused && newWord.trim().length > 0);
      return;
    }
    if (!autocompleteLoading) {
      setSuggestions(autocompleteSuggestions);
      if (inputFocused && newWord.trim().length > 0) {
        setIsPopoverOpen(autocompleteSuggestions.length > 0 || !!autocompleteError);
      }
    }
  }, [autocompleteSuggestions, autocompleteLoading, autocompleteError, inputFocused, newWord]);


  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewWord(value);
    setActiveSuggestionIndex(-1); // Reset active suggestion
    if (!value.trim()) {
      setSuggestions([]);
      setIsPopoverOpen(false);
    } else if (inputFocused) {
      // Trigger suggestion fetching which might re-open popover via useEffect
    }
  }, [inputFocused]);

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    if (newWord.trim().length > 0 && (suggestions.length > 0 || !!autocompleteError)) {
      setIsPopoverOpen(true);
    }
  }, [newWord, suggestions, autocompleteError]);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
    // Delay closing popover to allow click on suggestion or submit button
    setTimeout(() => {
      if (
        document.activeElement !== inputRef.current &&
        !popoverContentRef.current?.contains(document.activeElement) &&
        document.activeElement !== submitButtonRef.current
      ) {
        setIsPopoverOpen(false);
      }
    }, 150);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setNewWord(suggestion);
    setSuggestions([]); // Clear suggestions
    setIsPopoverOpen(false); // Close popover
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus(); // Re-focus input
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isPopoverOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault(); // Prevent cursor move if no suggestions
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
          e.preventDefault();
          handleSuggestionClick(suggestions[activeSuggestionIndex]);
        }
        // If no suggestion active, Enter key will submit the form by default
        break;
      case 'Escape':
        e.preventDefault();
        setIsPopoverOpen(false);
        setActiveSuggestionIndex(-1);
        break;
      case 'Tab': // Allow tabbing out, which will trigger blur
        setIsPopoverOpen(false);
        setActiveSuggestionIndex(-1);
        break;
    }
  }, [isPopoverOpen, suggestions, activeSuggestionIndex, handleSuggestionClick]);

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
      setIsPopoverOpen(false);
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
      // Optionally, clear the input or allow adding anyway based on future requirements
      // setNewWord(''); 
      return;
    }

    setIsAdding(true);
    const added = await addWord(trimmedWord);
    setIsAdding(false);

    if (added) {
      toast({
        title: "Word Added",
        description: `"${trimmedWord}" has been added to your library.`,
        // action: <CheckCircle className="text-green-500" />, // CheckCircle not imported
      });
      setNewWord('');
      setSuggestions([]);
      setIsPopoverOpen(false);
      setActiveSuggestionIndex(-1);
    } else {
      // This case is less likely now if duplicate check is robust and addWord mainly fails on internal errors
      toast({
        title: "Could Not Add Word",
        description: `Failed to add "${trimmedWord}". This might be due to a network issue or an internal error.`,
        variant: "destructive",
      });
    }
  }, [newWord, addWord, libraryWords, toast, isLoadingUI, suggestions, activeSuggestionIndex]);

  // Determine the prefix for highlighting based on the input that fetched the suggestions
  const highlightPrefix = (suggestionInput || '').trim().toLowerCase();

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
              aria-controls="autocomplete-suggestions-list"
              aria-expanded={isPopoverOpen}
              aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : undefined}
              autoComplete="off"
              disabled={isLoadingUI}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={popoverContentRef}
          className="w-[--radix-popover-trigger-width] p-0"
          side="bottom"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
             if (document.activeElement === submitButtonRef.current) {
                 e.preventDefault();
             }
          }}
        >
          {autocompleteError && (
            <div className="p-2 text-sm text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Error: {autocompleteError}
            </div>
          )}
          {!autocompleteError && (
            <>
              {autocompleteLoading && suggestions.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">Loading suggestions...</div>
              )}
              {!autocompleteLoading && newWord.trim() && suggestions.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">No suggestions found</div>
              )}
              {suggestions.length > 0 && (
                <ScrollArea className="max-h-60">
                  <ul
                    ref={suggestionsListRef}
                    className="py-1"
                    role="listbox"
                    id="autocomplete-suggestions-list"
                  >
                    {suggestions.map((suggestion, index) => {
                      const suggestionLower = suggestion.toLowerCase();
                      let head = "";
                      let tail = suggestion;

                      if (highlightPrefix && suggestionLower.startsWith(highlightPrefix)) {
                        head = suggestion.substring(0, highlightPrefix.length);
                        tail = suggestion.substring(highlightPrefix.length);
                      }
                      
                      return (
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
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <span>
                              {head && <strong>{head}</strong>}
                              {tail}
                            </span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
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
        disabled={isLoadingUI || !newWord.trim()}
        className="mt-2"
      >
        {isAdding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> :
         isValidatingLocally ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> :
         isInitialDictionaryLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> :
         <PlusCircle className="mr-2 h-5 w-5" />}
        {isAdding ? "Adding..." : 
         isValidatingLocally ? "Validating..." : 
         isInitialDictionaryLoading ? "Loading List..." : "Add Word"}
      </Button>
    </form>
  );
});

AddWordForm.displayName = 'AddWordForm';
export default AddWordForm;
