
"use client";

import type { FC } from 'react';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import { PlusCircle, Loader2, Search } from 'lucide-react';
import { useVocabulary, MAX_WORD_LENGTH } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';
import { useAutocomplete } from '@/hooks/useAutocomplete'; // New hook
import { cn } from '@/lib/utils';

const AddWordForm: FC = () => {
  const [newWord, setNewWord] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const { addWord, words: libraryWords } = useVocabulary();
  const { toast } = useToast();
  const { suggestions: autocompleteSuggestions, loading: suggestionsLoading, error: suggestionsError } = useAutocomplete(newWord);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewWord(value);
    if (value.trim()) {
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNewWord(suggestion);
    setIsPopoverOpen(false);
    inputRef.current?.focus();
  };
  
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
    
    try {
      const added = await addWord(trimmedWord);
      if (added) {
        toast({
          title: "Word Added",
          description: `"${trimmedWord}" has been added to your library.`,
        });
        setNewWord(''); // Clear input on successful addition
        setIsPopoverOpen(false);
      } else {
        // This case might be redundant if duplicate check is robust,
        // but good for other potential addWord failures.
         toast({
          title: "Could Not Add Word",
          description: `Failed to add "${trimmedWord}". It might already exist or an error occurred.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding word:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding the word.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Handle closing popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isPopoverOpen &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        popoverContentRef.current &&
        !popoverContentRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);


  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 items-start w-full">
      <Popover open={isPopoverOpen && newWord.trim().length > 0 && autocompleteSuggestions.length > 0} onOpenChange={setIsPopoverOpen}>
        <PopoverAnchor asChild>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="text"
              value={newWord}
              onChange={handleInputChange}
              onFocus={() => {
                if (newWord.trim() && autocompleteSuggestions.length > 0) setIsPopoverOpen(true);
              }}
              placeholder="Enter a new word or phrase"
              className="flex-grow w-full pl-10"
              aria-label="New word input"
              autoComplete="off"
              disabled={isAdding}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={popoverContentRef}
          className="w-[--radix-popover-trigger-width] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()} // Keep focus on input
          align="start"
        >
          {suggestionsLoading && (
            <div className="p-2 text-sm text-muted-foreground text-center">Loading suggestions...</div>
          )}
          {!suggestionsLoading && suggestionsError && (
            <div className="p-2 text-sm text-red-500 text-center">Error: {suggestionsError}</div>
          )}
          {!suggestionsLoading && !suggestionsError && autocompleteSuggestions.length === 0 && newWord.trim().length > 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">No suggestions found.</div>
          )}
          {!suggestionsLoading && !suggestionsError && autocompleteSuggestions.length > 0 && (
            <ScrollArea className="max-h-60">
              <ul className="py-1">
                {autocompleteSuggestions.map((suggestion, index) => (
                  <li key={`${suggestion}-${index}`}>
                    <button
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm hover:bg-accent focus:bg-accent focus:outline-none rounded-sm",
                      )}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSuggestionClick(suggestion);
                        }
                      }}
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>
       <Button type="submit" variant="default" size="lg" disabled={isAdding}>
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

// Helper component, can be moved to ui if reused
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { className?: string }
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("overflow-y-auto", className)}
    {...props}
  >
    {children}
  </div>
));
ScrollArea.displayName = 'ScrollArea';
