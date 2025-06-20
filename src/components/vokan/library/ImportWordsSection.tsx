"use client";

import type { FC } from 'react';
import React, { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVocabulary } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';
import { showStandardToast } from '@/lib/showStandardToast';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_WORDS_TO_PROCESS_AT_ONCE = 5000;
const MAX_WORD_LENGTH_IMPORT = 100;
const BATCH_SIZE = 200;

interface ImportWordsSectionProps {
  disabled?: boolean;
}

const ImportWordsSection: FC<ImportWordsSectionProps> = ({ disabled }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState(0); // Progress state (0-100)
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addWordsBatch, words: libraryWords } = useVocabulary();
  const { toast } = useToast();

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validTypes = ['text/plain', 'text/csv', 'application/csv'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please select a .txt or .csv file.",
        variant: "destructive",
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File Too Large",
        description: `Please select a file smaller than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        variant: "destructive",
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  }, [toast]);

  const parseWordsFromFile = useCallback((text: string): string[] => {
    const lines = text.split(/\r?\n/);
    let parsedWords: string[] = [];

    lines.forEach(line => {
      // Simple CSV detection: if it contains a comma, split by comma, otherwise treat as single word
      const potentialWords = line.includes(',') ? line.split(',') : [line];
      potentialWords.forEach(potentialWord => {
        // Remove quotes if they exist (e.g., "word" -> word)
        const cleanedWord = potentialWord.replace(/^"(.*)"$/, '$1').trim();
        if (cleanedWord && cleanedWord.length > 0 && cleanedWord.length <= MAX_WORD_LENGTH_IMPORT) {
          // Basic sanitization: allow letters, numbers, spaces, hyphens, apostrophes
          const sanitizedWord = cleanedWord.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim();
          if (sanitizedWord) {
            parsedWords.push(sanitizedWord);
          }
        }
      });
    });
    return Array.from(new Set(parsedWords)).slice(0, MAX_WORDS_TO_PROCESS_AT_ONCE); // Unique and limit
  }, []);


  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      showStandardToast(toast, 'error', 'No File Selected', 'Please select a file to import.');
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    setProgressInfo({ current: 0, total: 0 });
    let wordsToAdd: string[] = [];
    let processedCount = 0;
    let skippedDuplicateCount = 0;

    try {
      const text = await selectedFile.text();
      const parsedWords = parseWordsFromFile(text);
      processedCount = parsedWords.length;

      if (processedCount === 0) {
        showStandardToast(toast, 'error', 'No Valid Words Found', 'The file did not contain any processable words.');
        setIsProcessing(false);
        setProgress(0);
        setProgressInfo({ current: 0, total: 0 });
        return;
      }
      const existingLibraryTexts = new Set(libraryWords.map(w => w.text.toLowerCase()));
      wordsToAdd = parsedWords.filter(word => {
        const isDuplicate = existingLibraryTexts.has(word.toLowerCase());
        if (isDuplicate) skippedDuplicateCount++;
        return !isDuplicate;
      });

      let totalAdded = 0;
      setProgressInfo({ current: 0, total: wordsToAdd.length });
      for (let i = 0; i < wordsToAdd.length; i += BATCH_SIZE) {
        const batch = wordsToAdd.slice(i, i + BATCH_SIZE);
        totalAdded += await addWordsBatch(batch);
        const done = Math.min(i + batch.length, wordsToAdd.length);
        setProgress(Math.round((done / wordsToAdd.length) * 100));
        setProgressInfo({
          current: done,
          total: wordsToAdd.length
        });
      }
      setProgress(100);
      setProgressInfo({
        current: wordsToAdd.length,
        total: wordsToAdd.length
      });
      if (totalAdded > 0) {
        showStandardToast(toast, 'success', 'Words Imported', `${totalAdded} new word(s) added. ${skippedDuplicateCount} word(s) skipped as duplicates. ${processedCount - wordsToAdd.length - skippedDuplicateCount} word(s) were invalid or already duplicates within the file.`);
      } else {
        showStandardToast(toast, 'info', 'No New Words to Add');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred while processing the file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setTimeout(() => { setProgress(0); setProgressInfo({ current: 0, total: 0 }); }, 1200);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [selectedFile, toast, parseWordsFromFile, addWordsBatch, libraryWords]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Import Words</CardTitle>
        <CardDescription>Upload a .txt or .csv file. Words can be one per line or comma-separated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Input
            id="file-upload"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.txt"
            className="hidden"
            aria-label="Word import file chooser"
            disabled={isProcessing}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-full sm:w-auto"
            disabled={isProcessing}
          >
            <FileText className="mr-2 h-4 w-4" />
            Choose File
          </Button>
          {selectedFile && (
            <span className="text-sm text-muted-foreground truncate mt-2 sm:mt-0">
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>
        <Button
          onClick={handleImport}
          disabled={!selectedFile || isProcessing}
          className="w-full sm:w-auto"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-5 w-5" />
              Import Selected File
            </>
          )}
        </Button>
        {(isProcessing || progress > 0) && progressInfo.total > 0 ? (
          <div className="w-full mt-2">
            <div className="w-full bg-muted rounded h-4 overflow-hidden relative">
              <div
                className="bg-green-500 h-4 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-white drop-shadow">
                {progress < 100 ? `${progressInfo.current} / ${progressInfo.total}` : 'Done'}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default React.memo(ImportWordsSection);
