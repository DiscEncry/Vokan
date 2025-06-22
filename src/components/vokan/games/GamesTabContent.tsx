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
        <div className="p-3 sm:p-4 md:p-6 space-y-6">
          <ClozeGame onStopGame={handleStopGame} />
        </div>
      </TooltipProvider>
    );
  }

  if (activeGame === 'textInput') {
    return (
      <TooltipProvider>
        <div className="p-3 sm:p-4 md:p-6 space-y-6">
          <TextInputGame onStopGame={handleStopGame} />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 w-full flex flex-col items-center min-h-[50vh] sm:min-h-[calc(100vh-200px)]">
        {/* Games Grid */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Multiple Choice Game */}
          <Card className="group relative overflow-hidden border border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-primary/5 flex flex-col min-h-[320px] h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-primary/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardHeader className="relative z-10 pb-3 sm:pb-4 px-4 sm:px-6 pt-5 sm:pt-6">
              <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-primary/8 border border-primary/15 mb-3 sm:mb-4 mx-auto group-hover:bg-primary/12 group-hover:border-primary/25 transition-all duration-300 group-hover:scale-105">
                <ListChecks className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-semibold text-center mb-1 sm:mb-2 leading-tight">
                Multiple Choice
              </CardTitle>
              <CardDescription className="text-center text-sm sm:text-base text-muted-foreground leading-relaxed">
                Choose the correct word in context
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10 flex-1 flex flex-col px-4 sm:px-6 pb-0">
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/20 rounded-lg sm:rounded-xl border border-border/20 mb-3 sm:mb-4">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed">
                    Fill in blanks using words from your library. Choose from four options to complete each sentence.
                  </p>
                </div>
                
                <ul className="space-y-1.5 sm:space-y-2 mt-auto">
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80">
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-primary/70" />
                    Real-world sentence context
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80">
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-primary/70" />
                    Sharpen recognition skills
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80">
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-primary/70" />
                    Get familiar with word usage
                  </li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="relative z-10 pt-4 sm:pt-6 px-4 sm:px-6 pb-5 sm:pb-6 mt-auto">
              <Button 
                size="lg" 
                onClick={() => handleStartGame('multipleChoice')}
                className="w-full group/btn bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 sm:py-3 px-4 hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 text-sm sm:text-base touch-manipulation min-h-[44px]"
              >
                <PlayCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover/btn:scale-110 transition-transform duration-200" />
                Start Game
                <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4 group-hover/btn:translate-x-1 transition-transform duration-200" />
              </Button>
            </CardFooter>
          </Card>

          {/* Text Input Game */}
          <Card className="group relative overflow-hidden border border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-primary/5 flex flex-col min-h-[320px] h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-primary/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardHeader className="relative z-10 pb-3 sm:pb-4 px-4 sm:px-6 pt-5 sm:pt-6">
              <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-primary/8 border border-primary/15 mb-3 sm:mb-4 mx-auto group-hover:bg-primary/12 group-hover:border-primary/25 transition-all duration-300 group-hover:scale-105">
                <Edit3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-semibold text-center mb-1 sm:mb-2 leading-tight">
                Text Input Challenge
              </CardTitle>
              <CardDescription className="text-center text-sm sm:text-base text-muted-foreground leading-relaxed">
                Recall and type words from your vocabulary
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10 flex-1 flex flex-col px-4 sm:px-6 pb-0">
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/20 rounded-lg sm:rounded-xl border border-border/20 mb-3 sm:mb-4">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed">
                    Type the missing word with Vietnamese hints. Perfect for active recall and spelling practice.
                  </p>
                </div>
                
                <ul className="space-y-1.5 sm:space-y-2 mt-auto">
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80">
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-primary/70" />
                    Boost recall and spelling
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80">
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-primary/70" />
                    Smart translation hints
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80">
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-primary/70" />
                    Master real-world usage
                  </li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="relative z-10 pt-4 sm:pt-6 px-4 sm:px-6 pb-5 sm:pb-6 mt-auto">
              <Button 
                size="lg" 
                onClick={() => handleStartGame('textInput')}
                className="w-full group/btn bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 sm:py-3 px-4 hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 text-sm sm:text-base touch-manipulation min-h-[44px]"
              >
                <PlayCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover/btn:scale-110 transition-transform duration-200" />
                Start Challenge
                <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4 group-hover/btn:translate-x-1 transition-transform duration-200" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Bottom accent */}
        <div className="mt-8 sm:mt-12 lg:mt-16 w-full max-w-4xl">
          <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default GamesTabContent;