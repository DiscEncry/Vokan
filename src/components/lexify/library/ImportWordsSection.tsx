"use client";

import type { FC } from 'react';
import React, { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVocabulary } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';

// Maximum file size: 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Maximum words to process at once
const MAX_WORDS = 5000;

const ImportWordsSection: FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addWordsBatch } = useVocabulary();
  const { toast } = useToast();

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    
    if (!file) {
      setSelectedFile(null);
      return;
    }
    
    // Validate file type
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
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 5MB.",
        variant: "destructive",
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    
    setSelectedFile(file);
  }, [toast]);

  const parseWords = useCallback((text: string): string[] => {
    // Detect format - CSV or simple text
    const isCSV = text.includes(',');
    let words: string[] = [];
    
    if (isCSV) {
      // Handle CSV with possible quotes
      const rows = text.split(/\r?\n/);
      for (const row of rows) {
        // Basic CSV parsing (handles simple quotes)
        const matches = row.match(/(?:"([^"]*)")|([^,]+)/g);
        if (matches) {
          words.push(...matches.map(m => 
            m.startsWith('"') && m.endsWith('"') 
              ? m.slice(1, -1).trim() 
              : m.trim()
          ));
        }
      }
    } else {
      // Handle simple newline-separated list
      words = text.split(/\r?\n/).map(word => word.trim());
    }
    
    // Filter empty words and sanitize input
    return words
      .filter(word => word && word.length > 0 && word.length <= 100) // Reasonable max word length
      .map(word => word.replace(/[^\p{L}\p{N}\s'-]/gu, '')) // Keep only letters, numbers, spaces, hyphens and apostrophes
      .slice(0, MAX_WORDS); // Limit max words
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string || '');
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(selectedFile);
      });

      if (!text) {
        throw new Error('Empty file');
      }

      const wordsArray = parseWords(text);

      if (wordsArray.length === 0) {
        toast({
          title: "No Words Found",
          description: "No valid words found in the file.",
          variant: "destructive",
        });
        return;
      }
      
      // Process words in smaller batches if large file
      const BATCH_SIZE = 500;
      if (wordsArray.length > BATCH_SIZE) {
        // Process in chunks to avoid UI freezing
        for (let i = 0; i < wordsArray.length; i += BATCH_SIZE) {
          const chunk = wordsArray.slice(i, i + BATCH_SIZE);
          await new Promise<void>(resolve => {
            setTimeout(() => {
              addWordsBatch(chunk);
              resolve();
            }, 0);
          });
        }
      } else {
        addWordsBatch(wordsArray);
      }
      
      toast({
        title: "Import Successful",
        description: `${wordsArray.length} words processed for import.`,
      });
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to process file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [selectedFile, toast, parseWords, addWordsBatch]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Import Words</CardTitle>
        <CardDescription>Upload a .txt or .csv file with words (one per line or comma-separated).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
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
            className="flex-shrink-0"
            disabled={isProcessing}
          >
            <FileText className="mr-2 h-4 w-4" />
            Choose File
          </Button>
          {selectedFile && (
            <span className="text-sm text-muted-foreground truncate">
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
      </CardContent>
    </Card>
  );
};

export default ImportWordsSection;
