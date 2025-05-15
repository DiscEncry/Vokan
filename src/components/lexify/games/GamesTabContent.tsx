
"use client";

import type { FC } from 'react';
import React, { useState } from 'react';
import ClozeGame from './ClozeGame';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Puzzle, PlayCircle, Info } from 'lucide-react';

const GamesTabContent: FC = () => {
  const [gameStarted, setGameStarted] = useState(false);

  const handleStartGame = () => {
    setGameStarted(true);
  };

  const handleStopGame = () => {
    setGameStarted(false);
  };

  if (!gameStarted) {
    return (
      <div className="p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Card className="w-full max-w-lg shadow-xl bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardHeader className="items-center text-center">
            <Puzzle className="h-12 w-12 text-primary mb-2" />
            <CardTitle className="text-3xl font-bold">
              Cloze Test Challenge
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-1">
              Test your vocabulary in context!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg shadow-inner">
                <Info className="inline-block h-5 w-5 mr-2 text-primary align-middle" />
                <span className="align-middle">Fill in the blanks in sentences using words from your library.</span>
            </div>
            <p className="text-sm text-foreground">
              The game will pick a word from your vocabulary, generate a sentence, and challenge you to choose the correct missing word from four options.
              After each correct answer, you'll get detailed insights about the word!
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button size="lg" onClick={handleStartGame} className="text-lg py-7 px-10">
              <PlayCircle className="mr-2 h-6 w-6" />
              Start Cloze Game
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-6">
      <ClozeGame onStopGame={handleStopGame} />
    </div>
  );
};

export default GamesTabContent;
