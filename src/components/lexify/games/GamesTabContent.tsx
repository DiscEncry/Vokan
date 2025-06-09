"use client";

import type { FC } from 'react';
import { useState } from 'react';
import ClozeGame from './ClozeGame';
import TextInputGame from './TextInputGame';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Info, Edit3, ListChecks, ArrowRight } from 'lucide-react';
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
      <div className="p-4 sm:p-6 md:p-8 w-full flex flex-col items-center min-h-[calc(100vh-200px)]">
        {/* Games Grid */}
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Multiple Choice Game */}
          <Card className="group relative overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 flex flex-col h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100" />
            <CardHeader className="relative z-10 pb-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4 mx-auto group-hover:bg-primary/15">
                <ListChecks className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-semibold text-center mb-2">
                Multiple Choice
              </CardTitle>
              <CardDescription className="text-center text-base text-muted-foreground">
                Choosing the correct word in context
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 flex-1 flex flex-col px-6 pb-0">
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border/30 mb-4">
                  <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    Fill in the blanks in sentences using words from your library. Choose from four options to complete each sentence.
                  </p>
                </div>
                <ul className="space-y-2 mt-auto">
                  <li className="flex items-center gap-2 text-sm text-foreground/90">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Real-world sentence context
                  </li>
                  <li className="flex items-center gap-2 text-sm text-foreground/90">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Sharpen recognition skills
                  </li>
                  <li className="flex items-center gap-2 text-sm text-foreground/90">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Get familiar with word usage
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="relative z-10 pt-6 mt-auto">
              <Button 
                size="lg" 
                onClick={() => handleStartGame('multipleChoice')}
                className="w-full group/btn bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 hover:shadow-md"
              >
                <PlayCircle className="mr-2 h-5 w-5 group-hover/btn:scale-110" />
                Start Game
                <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1" />
              </Button>
            </CardFooter>
          </Card>

          {/* Text Input Game */}
          <Card className="group relative overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 flex flex-col h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100" />
            <CardHeader className="relative z-10 pb-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4 mx-auto group-hover:bg-primary/15">
                <Edit3 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-semibold text-center mb-2">
                Text Input Challenge
              </CardTitle>
              <CardDescription className="text-center text-base text-muted-foreground">
                Recall and type words from your vocabulary library
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 flex-1 flex flex-col px-6 pb-0">
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border/30 mb-4">
                  <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    Type the missing word with Vietnamese translation hints. Perfect for active recall and spelling practice.
                  </p>
                </div>
                <ul className="space-y-2 mt-auto">
                  <li className="flex items-center gap-2 text-sm text-foreground/90">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Boost recall and spelling
                  </li>
                  <li className="flex items-center gap-2 text-sm text-foreground/90">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Smart translation hints
                  </li>
                  <li className="flex items-center gap-2 text-sm text-foreground/90">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Master real-world usage
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="relative z-10 pt-6 mt-auto">
              <Button 
                size="lg" 
                onClick={() => handleStartGame('textInput')}
                className="w-full group/btn bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 hover:shadow-md"
              >
                <PlayCircle className="mr-2 h-5 w-5 group-hover/btn:scale-110" />
                Start Challenge
                <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Bottom accent */}
        <div className="mt-16 w-full max-w-3xl">
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default GamesTabContent;