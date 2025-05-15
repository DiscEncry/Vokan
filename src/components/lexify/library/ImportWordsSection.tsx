"use client";

import type { FC } from 'react';
import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVocabulary } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';

const ImportWordsSection: FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addWordsBatch } = useVocabulary();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({
          title: "Empty File",
          description: "The selected file is empty or could not be read.",
          variant: "destructive",
        });
        return;
      }

      // Simple parser: handles one word per line, or comma-separated words
      // More robust CSV parsing would require a library like PapaParse
      const wordsArray = text
        .split(/[\n,]+/) // Split by newlines or commas
        .map(word => word.trim())
        .filter(word => word.length > 0);

      if (wordsArray.length === 0) {
        toast({
          title: "No Words Found",
          description: "No valid words found in the file.",
          variant: "destructive",
        });
        return;
      }
      
      addWordsBatch(wordsArray);
      toast({
        title: "Import Successful",
        description: `${wordsArray.length} words processed for import.`,
      });
      setSelectedFile(null); // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input element
      }
    };
    reader.onerror = () => {
       toast({
        title: "File Read Error",
        description: "Could not read the selected file.",
        variant: "destructive",
      });
    }
    reader.readAsText(selectedFile);
  };

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
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-shrink-0">
            <FileText className="mr-2 h-4 w-4" />
            Choose File
          </Button>
          {selectedFile && <span className="text-sm text-muted-foreground truncate">{selectedFile.name}</span>}
        </div>
        <Button onClick={handleImport} disabled={!selectedFile} className="w-full sm:w-auto">
          <UploadCloud className="mr-2 h-5 w-5" />
          Import Selected File
        </Button>
      </CardContent>
    </Card>
  );
};

export default ImportWordsSection;
