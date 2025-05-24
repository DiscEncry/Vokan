"use client";

import type { FC } from 'react';
import React, { useState } from 'react';
import ClozeGame from './ClozeGame';
import TextInputGame from './TextInputGame'; // Import the new game component
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Puzzle, PlayCircle, Info, Edit3, ListChecks } from 'lucide-react'; // Added Edit3 for Text Input
import { TooltipProvider } from '@/components/ui/tooltip';

type ActiveGame = 'multipleChoice' | 'textInput' | null;

const GamesTabContent: FC = () => {
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);

  const handleStartGame = (gameType: ActiveGame) => {
    setActiveGame(gameType);
  };

  const handleStopGame = () => {
    setActiveGame(null);
  };

  if (activeGame === 'multipleChoice') {
    return (
      <TooltipProvider>
        <div className="p-2 sm:p-4 md:p-6 space-y-6">
          <ClozeGame onStopGame={handleStopGame} />
        </div>
      </TooltipProvider>
    );
  }

  if (activeGame === 'textInput') {
    return (
      <TooltipProvider>
        <div className="p-2 sm:p-4 md:p-6 space-y-6">
          <TextInputGame onStopGame={handleStopGame} />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-2 sm:p-4 md:p-6 w-full flex flex-col items-center min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch justify-center">
          <Card className="shadow-xl bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 flex flex-col justify-between">
            <CardHeader className="items-center text-center">
              <ListChecks className="h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-3xl font-bold">
                Multiple Choice
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground mt-1">
                Test your vocabulary by choosing the correct word in context!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center flex-1 flex flex-col justify-center">
              <div className="p-4 bg-muted/50 rounded-lg shadow-inner">
                <Info className="inline-block h-5 w-5 mr-2 text-primary align-middle" />
                <span className="align-middle">Fill in the blanks in sentences using words from your library.</span>
              </div>
              <p className="text-sm text-foreground">
                The game picks a word, generates a sentence, and challenges you to choose the correct missing word from four options.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button size="lg" onClick={() => handleStartGame('multipleChoice')} className="text-lg py-7 px-10">
                <PlayCircle className="mr-2 h-6 w-6" />
                Start Multiple Choice
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-xl bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 flex flex-col justify-between">
            <CardHeader className="items-center text-center">
              <Edit3 className="h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-3xl font-bold">
                Text Input Challenge
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground mt-1">
                Recall and type words from your vocabulary library!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center flex-1 flex flex-col justify-center">
              <div className="p-4 bg-muted/50 rounded-lg shadow-inner">
                <Info className="inline-block h-5 w-5 mr-2 text-primary align-middle" />
                <span className="align-middle">Type the missing word. A Vietnamese translation of the sentence is provided as a hint.</span>
              </div>
              <p className="text-sm text-foreground">
                This game focuses on words you are actively learning. You'll see a sentence with a blank, its Vietnamese translation, and you type the missing English word. You can ask for a letter hint!
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button size="lg" onClick={() => handleStartGame('textInput')} className="text-lg py-7 px-10">
                <PlayCircle className="mr-2 h-6 w-6" />
                Start Text Input
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default GamesTabContent;
