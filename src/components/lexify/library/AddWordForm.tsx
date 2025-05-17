
"use client";

import type { FC } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { useVocabulary, MAX_WORD_LENGTH } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { cn } from '@/lib/utils';
import { validateWord } from '@/app/actions/validate-word-action';
import type { ValidateWordResult } from '@/types';


const AddWordForm: FC = () => {
  const [newWord, setNewWord] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isVerifyingWithAPI, setIsVerifyingWithAPI] = useState(false); // New state for API validation

  // Autocomplete state
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [inputFocused, setInputFocused] = useState(false);

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


  // Effect to control Popover visibility based on focus and suggestions
 useEffect(() => {
    if (!inputFocused) {
      // If input is not focused, ensure popover is closed after a short delay
      // This allows clicks on suggestions to register if popover was open
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
      // Not loading, no error, input has text, but no suggestions found
      setIsPopoverOpen(false);
    }
  }, [inputFocused, newWord, autocompleteLoading, autocompleteSuggestions, autocompleteError]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewWord(value);
    setActiveSuggestionIndex(-1);
    if (!value.trim()) {
      setIsPopoverOpen(false);
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    // Popover visibility is handled by the useEffect
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    // Delay closing to allow click events on suggestions or submit
    // The useEffect will handle the actual closing if focus truly moved away
    setTimeout(() => {
      if (
        document.activeElement === inputRef.current ||
        (popoverContentRef.current && popoverContentRef.current.contains(document.activeElement)) ||
        (submitButtonRef.current && submitButtonRef.current.contains(document.activeElement))
      ) {
        return;
      }
      // If focus moved elsewhere, and conditions in useEffect aren't met, it will close
    }, 150);
  };


  const handleSuggestionClick = (suggestion: string) => {
    setNewWord(suggestion);
    setIsPopoverOpen(false);
    setActiveSuggestionIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isPopoverOpen || autocompleteSuggestions.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
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
          // Allow form submission if Enter is pressed in input and no suggestion is active
           // The form's onSubmit will handle this
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
    if (isAdding || isVerifyingWithAPI) return;

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
      setNewWord(''); // Clear input for duplicate
      return;
    }

    setIsVerifyingWithAPI(true);
    let validationResult: ValidateWordResult | null = null;
    try {
      validationResult = await validateWord(trimmedWord);
    } catch (error) {
      console.error("Error calling validateWord server action:", error);
      toast({
        title: "Validation Error",
        description: "Could not verify the word. Please try again.",
        variant: "destructive",
      });
      setIsVerifyingWithAPI(false);
      return;
    }
    setIsVerifyingWithAPI(false);

    if (validationResult.status === 'valid') {
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
      } else {
        // This case might occur if addWord itself has some internal failure,
        // though duplicate check is done above.
        toast({
          title: "Could Not Add Word",
          description: `Failed to add "${trimmedWord}".`,
          variant: "destructive",
        });
      }
    } else if (validationResult.status === 'not_found') {
      toast({
        title: "Word Not Found",
        description: validationResult.message,
        variant: "destructive",
      });
      // Optionally clear input or keep it for correction
      // setNewWord('');
    } else if (validationResult.status === 'invalid_input') {
       toast({
        title: "Invalid Input",
        description: validationResult.message,
        variant: "destructive",
      });
    } else { // api_error
      toast({
        title: "Validation API Error",
        description: validationResult.message || "An error occurred validating the word with the dictionary API.",
        variant: "destructive",
      });
    }
  };

  const isLoadingUI = isAdding || isVerifyingWithAPI;

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
        {isPopoverOpen && (
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
        )}
      </Popover>

      <Button ref={submitButtonRef} type="submit" variant="default" size="lg" disabled={isLoadingUI || !newWord.trim()} className="mt-2">
        {isAdding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 
         isVerifyingWithAPI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 
         <PlusCircle className="mr-2 h-5 w-5" />}
        {isAdding ? "Adding..." : isVerifyingWithAPI ? "Verifying..." : "Add Word"}
      </Button>
    </form>
  );
};

export default AddWordForm;
