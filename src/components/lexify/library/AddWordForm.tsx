"use client";

import type { FC } from 'react';
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useVocabulary } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';

const AddWordForm: FC = () => {
  const [newWord, setNewWord] = useState('');
  const { addWord, words } = useVocabulary();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) {
      toast({
        title: "Empty Word",
        description: "Please enter a word to add.",
        variant: "destructive",
      });
      return;
    }
    if (words.some(w => w.text.toLowerCase() === newWord.trim().toLowerCase())) {
      toast({
        title: "Duplicate Word",
        description: `The word "${newWord.trim()}" is already in your library.`,
        variant: "destructive",
      });
      return;
    }
    addWord(newWord);
    toast({
      title: "Word Added",
      description: `"${newWord.trim()}" has been added to your library.`,
    });
    setNewWord('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <Input
        type="text"
        value={newWord}
        onChange={(e) => setNewWord(e.target.value)}
        placeholder="Enter a new word or phrase"
        className="flex-grow"
        aria-label="New word input"
      />
      <Button type="submit" variant="default" size="lg">
        <PlusCircle className="mr-2 h-5 w-5" />
        Add Word
      </Button>
    </form>
  );
};

export default AddWordForm;
