"use client";

import type { FC } from 'react';
import ClozeGame from './ClozeGame';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Puzzle } from 'lucide-react';

const GamesTabContent: FC = () => {
  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-6">
      <Card className="bg-gradient-to-br from-primary/10 via-background to-background shadow-sm border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">
            Vocabulary Games
          </CardTitle>
          <Puzzle className="h-8 w-8 text-primary" />
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base">
            Sharpen your vocabulary skills with interactive exercises. 
            The Cloze Test below will help you learn words in context.
          </CardDescription>
        </CardContent>
      </Card>
      
      <ClozeGame />

      {/* Placeholder for future games */}
      {/* 
      <div className="mt-12">
        <h3 className="text-xl font-semibold mb-4 text-muted-foreground">More Games Coming Soon!</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="opacity-50">
            <CardHeader>
              <CardTitle>Flashcards</CardTitle>
              <CardDescription>Classic flashcard practice.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="opacity-50">
            <CardHeader>
              <CardTitle>Matching Pairs</CardTitle>
              <CardDescription>Match words with definitions.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
      */}
    </div>
  );
};

export default GamesTabContent;
