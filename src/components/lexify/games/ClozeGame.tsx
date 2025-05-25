"use client";

import type { FC } from 'react';
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, Sparkles, CalendarClock } from 'lucide-react'; // Added Sparkles
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, ClozeQuestion as ClozeQuestionType } from '@/types';
import { generateClozeQuestion } from '@/ai/flows/generate-cloze-question';
import { useToast } from '@/hooks/use-toast';
import { useGameEngine } from './useGameEngine';
import { useWordDetails } from './useWordDetails';
import { useWordDetailsPanelState } from './useWordDetailsPanelState';
import FamiliarityDot from './FamiliarityDot';
import { EmptyState } from '@/components/ui/EmptyState';
import { isDue, logQuizResult } from '@/lib/utils';
import { useWordGameCore } from './useWordGameCore';
import { Due } from '@/components/lexify/library/Due';
import { WordStageIndicator } from './WordStageIndicator';
import { useWordGameAnswerState } from './useWordGameAnswerState';
import { useWordGameKeyboardNavigation } from './useWordGameKeyboardNavigation';

interface ClozeGameProps {
  onStopGame: () => void;
  disabled?: boolean;
}

const DEBUG = false; // Set to false in production

const ClozeGame: FC<ClozeGameProps> = ({ onStopGame, disabled }) => {
  const { getDecoyWords, updateWordSRS } = useVocabulary();
  const { toast } = useToast();

  // Local state for answer selection and focus
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number>(-1);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const startTime = useRef<number | null>(null);

  const generateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<ClozeQuestionType | null> => {
    if (!targetWord) return null;
    const decoys = getDecoyWords(targetWord.id, 3);
    if (decoys.length < 3) {
      toast({ 
        title: "Not enough decoy words", 
        description: `Need at least 3 decoys for \"${targetWord.text}\", found ${decoys.length}. Add more words.`,
        variant: "destructive"
      });
      return null;
    }
    const decoyTexts = decoys.map(d => d.text);
    try {
      const aiInput = { word: targetWord.text, libraryWords: decoyTexts };
      const clozeData = await generateClozeQuestion(aiInput);
      if (!core.isMounted.current) return null;
      if (!clozeData || !clozeData.sentence || !clozeData.options || clozeData.options.length < 1) {
        toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
        return null;
      }
      let options = [...clozeData.options];
      if (!options.includes(targetWord.text)) {
        options[Math.floor(Math.random() * Math.min(options.length, 4))] = targetWord.text;
      }
      const shuffledOptions = options.sort(() => 0.5 - Math.random()).slice(0, 4);
      if (!shuffledOptions.includes(targetWord.text)) {
        shuffledOptions[Math.floor(Math.random() * 4)] = targetWord.text;
      }
      return {
        sentenceWithBlank: clozeData.sentence,
        options: shuffledOptions,
        correctAnswer: targetWord.text,
        targetWord: targetWord.text,
      };
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && core.isMounted.current) {
        toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
      }
      return null;
    }
  }, [getDecoyWords, toast]);

  const core = useWordGameCore<ClozeQuestionType>({
    minWords: 4,
    generateSingleQuestion,
    getDecoyWords,
  });

  const answerState = useWordGameAnswerState<ClozeQuestionType>();

  // --- Quiz/Game Log Util ---
  useEffect(() => {
    return () => { 
      core.currentQuestionAbortController.current?.abort("Component unmount");
      core.nextQuestionAbortController.current?.abort("Component unmount");
    };
  }, []);

  useEffect(() => {
    if (answerState.userInput || (!core.isLoadingCurrentQuestion && core.currentQuestion)) {
      core.safeSetState<number>(setFocusedOptionIndex, -1);
    }
  }, [core.isLoadingCurrentQuestion, core.currentQuestion, answerState.userInput, core.safeSetState]);

  const resetQuestionState = useCallback(() => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setFocusedOptionIndex(-1);
    core.resetPanel(); // Use shared hook to reset details panel
    optionButtonsRef.current = [];
  }, [core.resetPanel]);

  useEffect(() => { startTime.current = Date.now(); }, [core.currentQuestion]);

  const handleAnswerSubmit = useCallback((answer: string) => {
    if (!core.currentQuestion || isCorrect !== null || !core.isMounted.current) return; // Only allow one try
  
    setSelectedAnswer(answer);
    const correct = answer === core.currentQuestion.correctAnswer;
    setIsCorrect(correct);
  
    const targetWordObject = core.libraryWords.find(w => w.text === core.currentQuestion?.targetWord);
    const isWordDue = targetWordObject ? isDue(targetWordObject.fsrsCard.due) : false;
  
    if (correct) {
      toast({ title: "Correct!", description: `"${answer}" is the right word.`, className: "bg-green-500 text-white" });
      if (targetWordObject) {
        updateWordSRS(targetWordObject.id, selectedAnswer === null ? 4 : 3); // Easy if first try, Good otherwise
        if (isWordDue) {
          toast({ title: "Bonus!", description: "You reviewed this word on time! +1", className: "bg-yellow-400 text-black" });
        }
      }
      core.showPanelForWord(core.currentQuestion.targetWord); // Use shared hook
      core.wordDetailsApi.fetchDetails(core.currentQuestion.targetWord);
    } else {
      toast({ title: "Incorrect", description: `"${answer}" is not the right word.`, variant: "destructive" });
      if (targetWordObject) {
        updateWordSRS(targetWordObject.id, 1); // Again
      }
      core.showPanelForWord(core.currentQuestion.targetWord); // Use shared hook
      core.wordDetailsApi.fetchDetails(core.currentQuestion.targetWord);
    }
  
    if (core.currentQuestion && startTime.current) {
      logQuizResult({
        word: core.currentQuestion.targetWord,
        correct,
        duration: Date.now() - startTime.current,
        game: 'cloze',
        timestamp: Date.now(),
      });
    }
  }, [core.currentQuestion, isCorrect, core.libraryWords, toast, updateWordSRS, selectedAnswer, core.isMounted, core.wordDetailsApi, core.showPanelForWord]);

  useEffect(() => {
    if (!core.vocabLoading && core.hasEnoughWords && !core.gameInitialized && core.isMounted.current) {
      core.loadCurrentAndPrepareNext();
      core.safeSetState<boolean>(core.setGameInitialized, true);
    }
  }, [core.vocabLoading, core.hasEnoughWords, core.gameInitialized, core.loadCurrentAndPrepareNext, core.safeSetState, core.isMounted]);

  // Reset answer state on new question
  useEffect(() => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setFocusedOptionIndex(-1);
    optionButtonsRef.current = [];
  }, [core.currentQuestion]);

  // Keyboard navigation and answer submission
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') e.preventDefault();
    if (core.isLoadingCurrentQuestion || !core.currentQuestion || core.isLoadingTransition.current) return;
    if ((e.key === ' ' || e.key === 'Enter') && isCorrect !== null) {
      if (!core.isLoadingNextQuestion && !core.isLoadingTransition.current) {
        core.loadCurrentAndPrepareNext();
      }
      return;
    }
    if (e.key >= '1' && e.key <= '4') {
      const index = parseInt(e.key, 10) - 1;
      if (index >= 0 && index < core.currentQuestion.options.length) {
        const option = core.currentQuestion.options[index];
        handleAnswerSubmit(option);
      }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const optionsCount = core.currentQuestion.options.length;
      let newIndex = focusedOptionIndex;
      const isSmallScreen = window.innerWidth < 640;
      const isOptionSelectable = (idx: number) => {
        if (idx < 0 || idx >= optionsCount) return false;
        return true;
      };
      let currentFocus = focusedOptionIndex === -1 ? (e.key === 'ArrowUp' ? optionsCount : -1) : focusedOptionIndex;
      if (isSmallScreen) {
        if (e.key === 'ArrowUp') {
          for (let i = currentFocus - 1; i >= 0; i--) if (isOptionSelectable(i)) { newIndex = i; break; }
        } else if (e.key === 'ArrowDown') {
          for (let i = currentFocus + 1; i < optionsCount; i++) if (isOptionSelectable(i)) { newIndex = i; break; }
        }
      } else {
        if (e.key === 'ArrowUp') {
          if (currentFocus >= 2 && isOptionSelectable(currentFocus - 2)) newIndex = currentFocus - 2;
        } else if (e.key === 'ArrowDown') {
          if (currentFocus < optionsCount - 2 && isOptionSelectable(currentFocus + 2)) newIndex = currentFocus + 2;
        } else if (e.key === 'ArrowLeft') {
          if (currentFocus % 2 === 1 && isOptionSelectable(currentFocus - 1)) newIndex = currentFocus - 1;
        } else if (e.key === 'ArrowRight') {
          if (currentFocus % 2 === 0 && currentFocus + 1 < optionsCount && isOptionSelectable(currentFocus + 1)) newIndex = currentFocus + 1;
        }
      }
      if (focusedOptionIndex === -1 && newIndex === -1 ) {
        for (let i = 0; i < optionsCount; i++) if (isOptionSelectable(i)) { newIndex = i; break; }
      }
      if (newIndex !== -1 && newIndex !== focusedOptionIndex && isOptionSelectable(newIndex)) {
        setFocusedOptionIndex(newIndex);
        optionButtonsRef.current[newIndex]?.focus();
      }
      return;
    }
    if (e.key === 'Enter' && focusedOptionIndex >= 0 && focusedOptionIndex < core.currentQuestion.options.length) {
      const option = core.currentQuestion.options[focusedOptionIndex];
      handleAnswerSubmit(option);
      return;
    }
  }, [core, isCorrect, focusedOptionIndex, handleAnswerSubmit]);

  useWordGameKeyboardNavigation(handleKeyDown, [core, isCorrect, focusedOptionIndex, handleAnswerSubmit]);

  if (core.vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading vocabulary...</span></div>;
  }

  if (!core.hasEnoughWords && !core.vocabLoading && !core.gameInitialized) {
    return (
      <EmptyState
        title="Not Enough Words"
        description="You need at least 4 unique words (1 target + 3 decoys). Add more words in the Library tab."
        icon={<Lightbulb className="h-5 w-5 text-primary" />}
      >
        <Button onClick={onStopGame} variant="outline" className="mt-4">Back to Games Menu</Button>
      </EmptyState>
    );
  }

  // Note: AI Failure Alert similar to TextInputGame could be added here if an `aiFailureCount` state is implemented.

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-2xl mx-auto mt-6 px-2 sm:px-6" aria-label="Cloze Game Card">
        <CardHeader className="relative">
          {/* Indicators in top left */}
          {(() => {
            const wordObj = core.libraryWords.find(w => w.text === core.currentQuestion?.targetWord);
            if (!wordObj) return null;
            return (
              <div className="absolute -top-3 -left-3 flex gap-1 z-10">
                <WordStageIndicator state={wordObj.fsrsCard.state} />
                <Due isDue={isDue(wordObj.fsrsCard.due)} />
              </div>
            );
          })()}
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">Cloze Test</CardTitle>
            {(core.isLoadingNextQuestion) && ( // Simplified loading indicator
              <div className="flex items-center text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary mr-1" /> 
                <span>Preparing next...</span>
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              </div>
            )}
          </div>
          <CardDescription>Choose the word that best completes the sentence. Use number keys (1-4) or arrow keys & Enter.</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {core.isLoadingCurrentQuestion && !core.currentQuestion && ( // Show if loading and no current question yet
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Generating question...</p>
            </div>
          )}
          
          {!core.isLoadingCurrentQuestion && core.currentQuestion && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                {/* This p tag was missing a closing tag, now fixed */}
                <p className="text-xl md:text-2xl text-center p-6 bg-muted rounded-lg shadow-inner min-h-[100px] flex items-center justify-center mb-0">
                  {core.currentQuestion.sentenceWithBlank.replace(/___/g, " ______ ")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {core.currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isAttemptedIncorrect = false; // Not tracking attemptedAnswers in new version
                  // Only disable if isCorrect is not null AND this is the same question
                  const isDisabled = isCorrect !== null;
                  const isFocused = focusedOptionIndex === index;
                  let buttonVariant = 'outline';
                  if (isSelected) {
                    buttonVariant = isCorrect ? 'default' : 'destructive';
                  }
                  let buttonClass = `relative text-base py-5 transition-all duration-200 ease-in-out transform
                    ${isSelected && isCorrect ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white animate-pulse' : ''}
                    ${isSelected && isCorrect === false ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white' : ''}
                    ${isAttemptedIncorrect && !isCorrect ? 'opacity-60 line-through' : ''}
                    ${isFocused && !isDisabled ? 'ring ring-primary ring-offset-2' : ''}
                    ${isCorrect ? 'hover:scale-100' : (isDisabled ? 'hover:scale-100' : 'hover:scale-105')}`;
                  return (
                    <Button
                      key={option}
                      variant={buttonVariant as any}
                      size="lg"
                      className={buttonClass}
                      onClick={() => handleAnswerSubmit(option)}
                      onFocus={() => !isDisabled && core.safeSetState(setFocusedOptionIndex, index)}
                      ref={el => { optionButtonsRef.current[index] = el ?? null; }}
                      disabled={isDisabled}
                      aria-label={`Option ${index + 1}: ${option}`}
                    >
                      <span className="absolute left-3 top-2 opacity-70 text-xs">{index + 1}</span>
                      {isSelected && isCorrect && <CheckCircle className="mr-2 h-5 w-5" />}
                      {isSelected && isCorrect === false && <XCircle className="mr-2 h-5 w-5" />}
                      {option}
                    </Button>
                  );
                })}
              </div>
            </>
          )}
          
          {!core.isLoadingCurrentQuestion && !core.currentQuestion && !core.vocabLoading && core.gameInitialized && !core.isLoadingTransition.current && (
            <EmptyState
              title="No Question Available"
              description={<>Could not load a question. You might need more words, or there was an AI issue.</>}
              icon={<Info className="h-5 w-5" />}
            >
              <Button 
                onClick={core.loadCurrentAndPrepareNext}
                className="mt-3" 
                disabled={core.isLoadingTransition.current || core.isLoadingCurrentQuestion || core.isLoadingNextQuestion || disabled}
                aria-label="Try Again"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
            </EmptyState>
          )}
          {isCorrect !== null && (
            <div aria-live="polite" className="sr-only">
              {isCorrect ? 'Correct answer selected.' : 'Incorrect answer selected.'}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4">
          <Button onClick={onStopGame} variant="outline" size="lg" className="w-full sm:w-auto"
            disabled={core.isLoadingTransition.current || disabled}
            aria-label="Stop Game"
          >
            <StopCircle className="mr-2 h-5 w-5" /> Stop Game
          </Button>
          
          {isCorrect !== null && core.currentQuestion && (
            <Button 
              onClick={core.loadCurrentAndPrepareNext} 
              className="w-full sm:w-auto" 
              size="lg" 
              variant="default" 
              disabled={core.isLoadingTransition.current || core.isLoadingCurrentQuestion || core.isLoadingNextQuestion || disabled}
              aria-label="Next Question"
            >
              {(core.isLoadingTransition.current || core.isLoadingCurrentQuestion || core.isLoadingNextQuestion) ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-4" />
              )} 
              Next Question (Space/Enter)
            </Button>
          )}
        </CardFooter>
      </Card>

      {core.showDetails && core.detailsWord && (
        <WordDetailPanel 
          word={core.detailsWord} 
          generatedDetails={core.wordDetailsApi.getDetails(core.detailsWord)} 
          isLoading={core.wordDetailsApi.isLoading} 
        />
      )}
      {/* DEBUG && renderDebugInfo() could be added here if needed */}
    </div>
  );
};

ClozeGame.displayName = 'ClozeGame';
export default ClozeGame;