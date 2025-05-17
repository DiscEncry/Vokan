
"use client";

import type { FC } from 'react';
import React, { useState } from 'react';
import ClozeGame from './ClozeGame';
import TextInputGame from './TextInputGame'; // Import the new game component
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Puzzle, PlayCircle, Info, Edit3, ListChecks } from 'lucide-react'; // Added Edit3 for Text Input

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
      <div className="p-2 sm:p-4 md:p-6 space-y-6">
        <ClozeGame onStopGame={handleStopGame} />
      </div>
    );
  }

  if (activeGame === 'textInput') {
    return (
      <div className="p-2 sm:p-4 md:p-6 space-y-6">
        <TextInputGame onStopGame={handleStopGame} />
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] space-y-8">
      <Card className="w-full max-w-lg shadow-xl bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
        <CardHeader className="items-center text-center">
          <ListChecks className="h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-3xl font-bold">
            Multiple Choice
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-1">
            Test your vocabulary by choosing the correct word in context!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
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

      <Card className="w-full max-w-lg shadow-xl bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
        <CardHeader className="items-center text-center">
          <Edit3 className="h-12 w-12 text-primary mb-2" /> {/* Changed text-accent to text-primary for icon color consistency with card theme */}
          <CardTitle className="text-3xl font-bold">
            Text Input Challenge
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-1">
            Recall and type words from your "Familiar" list!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="p-4 bg-muted/50 rounded-lg shadow-inner">
            <Info className="inline-block h-5 w-5 mr-2 text-primary align-middle" /> {/* Changed text-accent to text-primary */}
            <span className="align-middle">Type the missing word. A Vietnamese translation of the sentence is provided as a hint.</span>
          </div>
          <p className="text-sm text-foreground">
            This game focuses on words you are actively learning. You'll see a sentence with a blank, its Vietnamese translation, and you type the missing English word. You can ask for a letter hint!
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          {/* Button styling remains different to distinguish games, but card itself is uniform */}
          <Button size="lg" onClick={() => handleStartGame('textInput')} variant="outline" className="text-lg py-7 px-10 border-accent hover:bg-accent/10 text-accent-foreground hover:text-accent-foreground">
            <PlayCircle className="mr-2 h-6 w-6" />
            Start Text Input
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default GamesTabContent;
