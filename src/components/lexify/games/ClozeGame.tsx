"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, Sparkles, CalendarClock } from 'lucide-react'; // Added Sparkles
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, ClozeQuestion as ClozeQuestionType, GeneratedWordDetails } from '@/types';
import { generateClozeQuestion } from '@/ai/flows/generate-cloze-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';
import { useGameEngine } from './useGameEngine';
import { useWordDetails } from './useWordDetails';
import { useWordDetailsPanelState } from './useWordDetailsPanelState';
import FamiliarityDot from './FamiliarityDot';
import { EmptyState } from '@/components/ui/EmptyState';
import { isDue, logQuizResult } from '@/lib/utils';

interface ClozeGameProps {
  onStopGame: () => void;
  disabled?: boolean;
}

const DEBUG = false; // Set to false in production

const ClozeGame: FC<ClozeGameProps> = ({ onStopGame, disabled }) => {
  // Use shared game engine hook
  const {
    libraryWords,
    isMounted,
    gameInitialized,
    setGameInitialized,
    safeSetState,
    hasEnoughWords,
    selectTargetWord,
    vocabLoading,
  } = useGameEngine({ minWords: 4 });

  // Use shared word details hook
  const wordDetailsApi = useWordDetails();
  const { showDetails, detailsWord, showPanelForWord, resetPanel } = useWordDetailsPanelState();

  const { updateWordSRS, getDecoyWords } = useVocabulary();
  const { toast } = useToast();

  const debugLog = useCallback((...args: any[]) => {
    if (DEBUG) console.log("[ClozeGame]", ...args);
  }, []);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<ClozeQuestionType | null>(null);
  const [nextQuestion, setNextQuestion] = useState<ClozeQuestionType | null>(null);
  
  // Game state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number>(-1);
  
  // Option buttons refs for focus management
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Loading states
  const [isLoadingCurrentQuestion, setIsLoadingCurrentQuestion] = useState(true); // True initially
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  
  // Game Lifecycle & Utility State
  const isLoadingTransition = useRef(false); // NEW: Prevents re-entrant calls to loadCurrentAndPrepareNext

  // Request cancellation refs
  const currentQuestionAbortController = useRef<AbortController | null>(null);
  const nextQuestionAbortController = useRef<AbortController | null>(null);
  const wordDetailsAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { 
      debugLog("Component unmounting, aborting all controllers.");
      currentQuestionAbortController.current?.abort("Component unmount");
      nextQuestionAbortController.current?.abort("Component unmount");
      wordDetailsAbortController.current?.abort("Component unmount");
    };
  }, [debugLog]);

  useEffect(() => {
    if (selectedAnswer || (!isLoadingCurrentQuestion && currentQuestion)) {
      safeSetState<number>(setFocusedOptionIndex, -1);
    }
  }, [isLoadingCurrentQuestion, currentQuestion, selectedAnswer, safeSetState]);

  const generateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<ClozeQuestionType | null> => {
    debugLog("generateSingleQuestion for word:", targetWord?.text);
    if (!targetWord) return null;

    const decoys = getDecoyWords(targetWord.id, 3);
    if (decoys.length < 3) {
      if (isMounted.current) {
        toast({ 
          title: "Not enough decoy words", 
          description: `Need at least 3 decoys for "${targetWord.text}", found ${decoys.length}. Add more words.`, 
          variant: "destructive"
        });
      }
      return null;
    }
    
    const decoyTexts = decoys.map(d => d.text);

    try {
      const aiInput = { word: targetWord.text, libraryWords: decoyTexts };
      // Only pass one argument as per function signature
      const clozeData = await generateClozeQuestion(aiInput);
      
      if (!isMounted.current) return null;
      if (!clozeData || !clozeData.sentence || !clozeData.options || clozeData.options.length < 1) {
        debugLog("generateSingleQuestion: AI response missing required fields.", clozeData);
        // Optionally, could add AI failure count here if needed
        return null;
      }
      
      let options = [...clozeData.options];
      if (!options.includes(targetWord.text)) {
        // Ensure target word is an option, replace a random one if not present
        options[Math.floor(Math.random() * Math.min(options.length, 4))] = targetWord.text;
      }
      
      const shuffledOptions = options.sort(() => 0.5 - Math.random()).slice(0, 4);
      
      if (!shuffledOptions.includes(targetWord.text)) {
        shuffledOptions[Math.floor(Math.random() * 4)] = targetWord.text;
      }

      return {
        sentenceWithBlank: clozeData.sentence,
        options: shuffledOptions,
        correctAnswer: targetWord.text, // The AI should confirm the correct form, but here it's usually the same as targetWord
        targetWord: targetWord.text,
      };
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        debugLog("Error in generateSingleQuestion:", error);
        toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
      } else if (error instanceof Error && error.name === 'AbortError') {
        debugLog("generateSingleQuestion: Aborted.");
      }
      return null;
    }
  }, [getDecoyWords, toast, debugLog, isMounted]);

  const fetchAndStoreNextQuestion = useCallback(async () => {
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingNextQuestion) return;

    nextQuestionAbortController.current?.abort("New next question fetch started");
    nextQuestionAbortController.current = new AbortController();

    const currentTargetWordId = currentQuestion ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined;
    const excludeIds = currentTargetWordId ? [currentTargetWordId] : [];
    const nextTargetWordObj = selectTargetWord(excludeIds);

    if (!nextTargetWordObj) {
      if (hasEnoughWords && isMounted.current) {
        debugLog("fetchAndStoreNextQuestion: No suitable next word found.");
      }
      safeSetState<boolean>(setIsLoadingNextQuestion, false);
      return;
    }
    
    safeSetState<boolean>(setIsLoadingNextQuestion, true);

    try {
      const question = await generateSingleQuestion(nextTargetWordObj, nextQuestionAbortController.current);
      if (isMounted.current) {
        safeSetState<ClozeQuestionType | null>(setNextQuestion, question);
      }
    } catch (error) {
      // Error handling is in generateSingleQuestion
    } finally {
      if (isMounted.current) safeSetState<boolean>(setIsLoadingNextQuestion, false);
    }
  }, [
    vocabLoading, hasEnoughWords, isLoadingNextQuestion, currentQuestion, libraryWords, 
    selectTargetWord, generateSingleQuestion, debugLog, safeSetState, isMounted
  ]);

  const resetQuestionState = useCallback(() => {
    debugLog("resetQuestionState called");
    safeSetState<string | null>(setSelectedAnswer, null);
    safeSetState<boolean | null>(setIsCorrect, null);
    safeSetState<number>(setFocusedOptionIndex, -1);
    resetPanel(); // Use shared hook to reset details panel
    optionButtonsRef.current = [];
  }, [safeSetState, debugLog, resetPanel]);

  const loadCurrentAndPrepareNext = useCallback(async () => {
    debugLog("loadCurrentAndPrepareNext: Start. isLoadingTransition:", isLoadingTransition.current);
    if (!isMounted.current || vocabLoading || !hasEnoughWords || isLoadingTransition.current) {
        if (isLoadingTransition.current) debugLog("Bailing: isLoadingTransition is true");
        return;
    }
    isLoadingTransition.current = true;

    currentQuestionAbortController.current?.abort("New current question load");
    currentQuestionAbortController.current = new AbortController(); // Create new one for current question

    resetQuestionState();
    safeSetState<boolean>(setIsLoadingCurrentQuestion, true);

    let questionToLoad: ClozeQuestionType | null = null;

    if (nextQuestion) {
        debugLog("Using pre-fetched nextQuestion:", nextQuestion.targetWord);
        questionToLoad = nextQuestion;
        safeSetState<ClozeQuestionType | null>(setCurrentQuestion, questionToLoad);
        safeSetState<ClozeQuestionType | null>(setNextQuestion, null);
        safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
        fetchAndStoreNextQuestion();
    } else {
        debugLog("No pre-fetched nextQuestion. Fetching a new current question.");
        const currentId = currentQuestion?.targetWord ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined;
        const excludeIds = currentId ? [currentId] : [];
        const targetWordObj = selectTargetWord(excludeIds);
        
        if (!targetWordObj) {
            if (isMounted.current) toast({ title: "No Words Available", description: "Could not find a suitable word.", variant: "destructive" });
            safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
            isLoadingTransition.current = false;
            return;
        }
        try {
            questionToLoad = await generateSingleQuestion(targetWordObj, currentQuestionAbortController.current);
            if (isMounted.current) {
                safeSetState<ClozeQuestionType | null>(setCurrentQuestion, questionToLoad);
                if (questionToLoad) {
                    debugLog("Fetched initial current question:", questionToLoad.targetWord);
                    fetchAndStoreNextQuestion();
                }
            }
        } catch (error) {
            debugLog("Error in loadCurrentAndPrepareNext (initial fetch):", error);
        } finally {
            if (isMounted.current) safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
        }
    }
    isLoadingTransition.current = false;
    debugLog("loadCurrentAndPrepareNext completed.");
  }, [
    vocabLoading, hasEnoughWords, nextQuestion, currentQuestion, libraryWords, selectTargetWord, 
    generateSingleQuestion, fetchAndStoreNextQuestion, resetQuestionState, 
    toast, debugLog, safeSetState, isMounted
  ]);

  // Initial Game Load Effect
  useEffect(() => {
    debugLog("Initial load effect: vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "gameInitialized:", gameInitialized);
    if (!vocabLoading && hasEnoughWords && !gameInitialized && isMounted.current) {
      loadCurrentAndPrepareNext();
      safeSetState<boolean>(setGameInitialized, true);
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, loadCurrentAndPrepareNext, debugLog, safeSetState, isMounted]);

  const handleAnswerSubmit = useCallback((answer: string) => {
    if (!currentQuestion || isCorrect !== null || !isMounted.current) return; // Only allow one try
    debugLog("handleAnswerSubmit for answer:", answer);
  
    safeSetState<string | null>(setSelectedAnswer, answer);
    const correct = answer === currentQuestion.correctAnswer;
    safeSetState<boolean | null>(setIsCorrect, correct);
  
    const targetWordObject = libraryWords.find(w => w.text === currentQuestion.targetWord);
    const isWordDue = targetWordObject ? isDue(targetWordObject.fsrsCard.due) : false;
  
    if (correct) {
      toast({ title: "Correct!", description: `"${answer}" is the right word.`, className: "bg-green-500 text-white" });
      if (targetWordObject) {
        updateWordSRS(targetWordObject.id, selectedAnswer === null ? 4 : 3); // Easy if first try, Good otherwise
        if (isWordDue) {
          toast({ title: "Bonus!", description: "You reviewed this word on time! +1", className: "bg-yellow-400 text-black" });
        }
      }
      showPanelForWord(currentQuestion.targetWord); // Use shared hook
      wordDetailsApi.fetchDetails(currentQuestion.targetWord);
    } else {
      toast({ title: "Incorrect", description: `"${answer}" is not the right word.`, variant: "destructive" });
      if (targetWordObject) {
        updateWordSRS(targetWordObject.id, 1); // Again
      }
      showPanelForWord(currentQuestion.targetWord); // Use shared hook
      wordDetailsApi.fetchDetails(currentQuestion.targetWord);
    }
  
    if (currentQuestion && startTime.current) {
      logQuizResult({
        word: currentQuestion.targetWord,
        correct,
        duration: Date.now() - startTime.current,
        game: 'cloze',
        timestamp: Date.now(),
      });
    }
  }, [currentQuestion, isCorrect, libraryWords, toast, updateWordSRS, debugLog, safeSetState, isMounted, wordDetailsApi, showPanelForWord]);

  const startTime = useRef<number | null>(null);
  useEffect(() => { startTime.current = Date.now(); }, [currentQuestion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') e.preventDefault(); 

      if (isLoadingCurrentQuestion || !currentQuestion || isLoadingTransition.current) return;
      
      if ((e.key === ' ' || e.key === 'Enter') && isCorrect !== null) {
        if (!isLoadingNextQuestion && !isLoadingTransition.current) {
          loadCurrentAndPrepareNext();
        }
        return;
      }

      if (e.key >= '1' && e.key <= '4') {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < currentQuestion.options.length) {
          const option = currentQuestion.options[index];
          handleAnswerSubmit(option);
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        
        const optionsCount = currentQuestion.options.length;
        let newIndex = focusedOptionIndex;
        const isSmallScreen = window.innerWidth < 640; 
        
        const isOptionSelectable = (idx: number) => {
          if (idx < 0 || idx >= optionsCount) return false;
          return true;
        };
        
        let currentFocus = focusedOptionIndex === -1 ? (e.key === 'ArrowUp' ? optionsCount : -1) : focusedOptionIndex;

        if (isSmallScreen) { // Vertical navigation
            if (e.key === 'ArrowUp') {
                for (let i = currentFocus - 1; i >= 0; i--) if (isOptionSelectable(i)) { newIndex = i; break; }
            } else if (e.key === 'ArrowDown') {
                for (let i = currentFocus + 1; i < optionsCount; i++) if (isOptionSelectable(i)) { newIndex = i; break; }
            }
        } else { // Grid navigation
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
        
        if (focusedOptionIndex === -1 && newIndex === -1 ) { // If no option focused and no movement, try to focus first selectable
             for (let i = 0; i < optionsCount; i++) if (isOptionSelectable(i)) { newIndex = i; break; }
        }

        if (newIndex !== -1 && newIndex !== focusedOptionIndex && isOptionSelectable(newIndex)) {
          safeSetState(setFocusedOptionIndex, newIndex);
          optionButtonsRef.current[newIndex]?.focus();
        }
        return;
      }

      if (e.key === 'Enter' && focusedOptionIndex >= 0 && focusedOptionIndex < currentQuestion.options.length) {
        const option = currentQuestion.options[focusedOptionIndex];
        handleAnswerSubmit(option);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQuestion, focusedOptionIndex, isCorrect, isLoadingCurrentQuestion, isLoadingNextQuestion, 
    loadCurrentAndPrepareNext, handleAnswerSubmit, safeSetState
  ]);

  if (vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading vocabulary...</span></div>;
  }

  if (!hasEnoughWords && !vocabLoading && !gameInitialized) {
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
            const wordObj = currentQuestion && libraryWords.find(w => w.text === currentQuestion.targetWord);
            if (!wordObj) return null;
            return (
              <div className="absolute -top-3 -left-3 flex gap-1 z-10">
                <FamiliarityDot state={wordObj.fsrsCard.state} />
                {isDue(wordObj.fsrsCard.due) && (
                  <span title="Review due!" className="text-orange-500 dark:text-orange-300 animate-pulse">
                    <CalendarClock className="inline h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })()}
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">Cloze Test</CardTitle>
            {(isLoadingNextQuestion) && ( // Simplified loading indicator
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
          {isLoadingCurrentQuestion && !currentQuestion && ( // Show if loading and no current question yet
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Generating question...</p>
            </div>
          )}
          
          {!isLoadingCurrentQuestion && currentQuestion && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                {/* This p tag was missing a closing tag, now fixed */}
                <p className="text-xl md:text-2xl text-center p-6 bg-muted rounded-lg shadow-inner min-h-[100px] flex items-center justify-center mb-0">
                  {currentQuestion.sentenceWithBlank.replace(/___/g, " ______ ")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isAttemptedIncorrect = false; // Not tracking attemptedAnswers in new version
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
                      onFocus={() => !isDisabled && safeSetState(setFocusedOptionIndex, index)}
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
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && gameInitialized && !isLoadingTransition.current && (
            <EmptyState
              title="No Question Available"
              description={<>Could not load a question. You might need more words, or there was an AI issue.</>}
              icon={<Info className="h-5 w-5" />}
            >
              <Button 
                onClick={loadCurrentAndPrepareNext}
                className="mt-3" 
                disabled={isLoadingTransition.current || isLoadingCurrentQuestion || disabled}
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
            disabled={isLoadingTransition.current || disabled}
            aria-label="Stop Game"
          >
            <StopCircle className="mr-2 h-5 w-5" /> Stop Game
          </Button>
          
          {isCorrect !== null && currentQuestion && (
            <Button 
              onClick={loadCurrentAndPrepareNext} 
              className="w-full sm:w-auto" 
              size="lg" 
              variant="default" 
              disabled={isLoadingTransition.current || isLoadingCurrentQuestion || isLoadingNextQuestion || disabled}
              aria-label="Next Question"
            >
              {(isLoadingTransition.current || isLoadingCurrentQuestion || isLoadingNextQuestion) ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-4" />
              )} 
              Next Question (Space/Enter)
            </Button>
          )}
        </CardFooter>
      </Card>

      {showDetails && detailsWord && (
        <WordDetailPanel 
          word={detailsWord} 
          generatedDetails={wordDetailsApi.getDetails(detailsWord)} 
          isLoading={wordDetailsApi.isLoading} 
        />
      )}
      {/* DEBUG && renderDebugInfo() could be added here if needed */}
    </div>
  );
};

ClozeGame.displayName = 'ClozeGame';
export default ClozeGame;