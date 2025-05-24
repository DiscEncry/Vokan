"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, Sparkles, KeyRound, Send, CalendarClock } from 'lucide-react';
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, TextInputQuestion, GeneratedWordDetails } from '@/types';
import { generateTextInputQuestion } from '@/ai/flows/generate-text-input-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';
import { cn, isDue, logQuizResult } from '@/lib/utils';
import { useGameEngine } from './useGameEngine';
import { useWordDetails } from './useWordDetails';
import { useWordDetailsPanelState } from './useWordDetailsPanelState';
import FamiliarityDot from './FamiliarityDot';
import { EmptyState } from '@/components/ui/EmptyState';

interface TextInputGameProps {
  onStopGame: () => void;
  disabled?: boolean;
}

const DEBUG = false; // Set to false in production

const TextInputGame: FC<TextInputGameProps> = React.memo(({ onStopGame, disabled }) => {
  const {
    libraryWords,
    isMounted,
    gameInitialized,
    setGameInitialized,
    safeSetState,
    hasEnoughWords,
    selectTargetWord,
    vocabLoading,
  } = useGameEngine({ minWords: 1 });
  const wordDetailsApi = useWordDetails();
  const { showDetails, detailsWord, showPanelForWord, resetPanel } = useWordDetailsPanelState();
  const { updateWordSRS } = useVocabulary();
  const { toast } = useToast();

  const debugLog = useCallback((...args: any[]) => {
    if (DEBUG) console.log("[TextInputGame]", ...args);
  }, []);

  // Question & Details State
  const [currentQuestion, setCurrentQuestion] = useState<TextInputQuestion | null>(null);
  const [nextQuestion, setNextQuestion] = useState<TextInputQuestion | null>(null);
  
  // Game Input & Answer State
  const [userInput, setUserInput] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hintRevealedThisQuestion, setHintRevealedThisQuestion] = useState(false);
  const [hintUsedThisTurn, setHintUsedThisTurn] = useState(false); // For familiarity logic
  const [attempts, setAttempts] = useState(0);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false); // To show the actual answer if incorrect

  // Loading States
  const [isLoadingCurrentQuestion, setIsLoadingCurrentQuestion] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);

  // Game Lifecycle & Utility State
  const [aiFailureCount, setAiFailureCount] = useState(0);
  const [showAiFailureAlert, setShowAiFailureAlert] = useState(false);

  // Refs
  const isLoadingTransition = useRef(false); // Prevents re-entrant calls to loadCurrentAndPrepareNext
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const startTime = useRef<number | null>(null); // Track quiz start time

  // Abort Controllers
  const currentQuestionAbortController = useRef<AbortController | null>(null);
  const nextQuestionAbortController = useRef<AbortController | null>(null);

  // Mount/Unmount Effect
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      debugLog("Component unmounting, aborting all controllers.");
      currentQuestionAbortController.current?.abort("Component unmount");
      nextQuestionAbortController.current?.abort("Component unmount");
    };
  }, [debugLog]);

  // Focus hidden input when a new question is ready
  useEffect(() => {
    if (currentQuestion && !isLoadingCurrentQuestion && isCorrect === null && !isLoadingTransition.current && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [currentQuestion, isLoadingCurrentQuestion, isCorrect]);

  // Set startTime when a new question is loaded
  useEffect(() => {
    if (currentQuestion) {
      startTime.current = Date.now();
    }
  }, [currentQuestion]);

  const generateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<TextInputQuestion | null> => {
    debugLog("generateSingleQuestion for word:", targetWord?.text);
    if (!targetWord) return null;
    
    try {
      const aiInput = { word: targetWord.text };
      // Only pass one argument as per function signature
      const questionData = await generateTextInputQuestion(aiInput);
      
      if (!isMounted.current) return null;
      if (!questionData || !questionData.sentenceWithBlank || !questionData.targetWord || !questionData.translatedHint) {
        debugLog("generateSingleQuestion: AI response missing required fields.", questionData);
        if (isMounted.current) safeSetState<number>(setAiFailureCount, prev => prev + 1);
        return null;
      }
      
      if (isMounted.current) safeSetState<number>(setAiFailureCount, 0);
      return {
        sentenceWithBlank: questionData.sentenceWithBlank,
        translatedHint: questionData.translatedHint,
        correctAnswer: questionData.targetWord, // AI provides the correctAnswer form
        targetWord: targetWord.text, // Original word text from library
      };
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        debugLog("Error in generateSingleQuestion:", error);
        toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
        safeSetState<number>(setAiFailureCount, prev => prev + 1);
      } else if (error instanceof Error && error.name === 'AbortError') {
        debugLog("generateSingleQuestion: Aborted.");
      }
      return null;
    }
  }, [toast, debugLog, safeSetState, isMounted]);


  const fetchAndStoreNextQuestion = useCallback(async () => {
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingNextQuestion) return;

    nextQuestionAbortController.current?.abort("New next question fetch started");
    nextQuestionAbortController.current = new AbortController();

    const currentTargetWordId = currentQuestion ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined;
    // Always pass an array (empty if undefined)
    const excludeIds = currentTargetWordId ? [currentTargetWordId] : [];
    const nextTargetWordObj = selectTargetWord(excludeIds);

    if (!nextTargetWordObj) {
      if (hasEnoughWords && isMounted.current) {
        // Toast can be annoying if it's just the end of available words
        debugLog("fetchAndStoreNextQuestion: No suitable next word found.");
      }
      safeSetState<boolean>(setIsLoadingNextQuestion, false);
      return;
    }
    
    safeSetState<boolean>(setIsLoadingNextQuestion, true);

    try {
      const question = await generateSingleQuestion(nextTargetWordObj, nextQuestionAbortController.current);
      if (isMounted.current) {
        safeSetState<TextInputQuestion | null>(setNextQuestion, question);
        // DO NOT prefetch word details for next question here!
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
    safeSetState<string>(setUserInput, '');
    safeSetState<boolean | null>(setIsCorrect, null);
    safeSetState<boolean>(setHintRevealedThisQuestion, false);
    safeSetState<boolean>(setHintUsedThisTurn, false);
    safeSetState<number>(setAttempts, 0);
    safeSetState<boolean>(setShowCorrectAnswer, false);
    resetPanel(); // Use shared hook to reset details panel
    if (hiddenInputRef.current) {
        hiddenInputRef.current.focus();
    }
  }, [safeSetState, debugLog, resetPanel]);


  const loadCurrentAndPrepareNext = useCallback(async () => {
    debugLog("loadCurrentAndPrepareNext: Start. isLoadingTransition:", isLoadingTransition.current);
    if (!isMounted.current || vocabLoading || !hasEnoughWords || isLoadingTransition.current) {
        if (isLoadingTransition.current) debugLog("Bailing: isLoadingTransition is true");
        return;
    }
    isLoadingTransition.current = true;

    currentQuestionAbortController.current?.abort("New current question load");
    currentQuestionAbortController.current = new AbortController();

    resetQuestionState();
    safeSetState<boolean>(setIsLoadingCurrentQuestion, true);

    let questionToLoad: TextInputQuestion | null = null;

    if (nextQuestion) {
        debugLog("Using pre-fetched nextQuestion:", nextQuestion.targetWord);
        questionToLoad = nextQuestion;
        safeSetState<TextInputQuestion | null>(setCurrentQuestion, questionToLoad);
        safeSetState<TextInputQuestion | null>(setNextQuestion, null);
        safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
        // DO NOT prefetch word details for new current question here!
        fetchAndStoreNextQuestion();
    } else {
        debugLog("No pre-fetched nextQuestion. Fetching a new current question.");
        const targetWordObj = selectTargetWord();
        if (!targetWordObj) {
            if (isMounted.current) toast({ title: "No Words Available", description: "Please add some words to your library first.", variant: "destructive" });
            safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
            isLoadingTransition.current = false;
            return;
        }
        try {
            questionToLoad = await generateSingleQuestion(targetWordObj, currentQuestionAbortController.current);
            if (isMounted.current) {
                safeSetState<TextInputQuestion | null>(setCurrentQuestion, questionToLoad);
                if (questionToLoad) {
                    debugLog("Fetched initial current question:", questionToLoad.targetWord);
                    // DO NOT prefetch word details for new current question here!
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
    vocabLoading, hasEnoughWords, nextQuestion, selectTargetWord, 
    generateSingleQuestion, fetchAndStoreNextQuestion, 
    resetQuestionState, toast, debugLog, safeSetState, isMounted
  ]);

  // Initial Game Load Effect
  useEffect(() => {
    debugLog("Initial load effect: vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "gameInitialized:", gameInitialized);
    if (!vocabLoading && hasEnoughWords && !gameInitialized && isMounted.current) {
      loadCurrentAndPrepareNext();
      safeSetState<boolean>(setGameInitialized, true);
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, loadCurrentAndPrepareNext, debugLog, safeSetState]);

  // AI Failure Alert Effect
  useEffect(() => {
    if (aiFailureCount >= 3) {
      if(isMounted.current) safeSetState<boolean>(setShowAiFailureAlert, true);
    } else {
      if(isMounted.current) safeSetState<boolean>(setShowAiFailureAlert, false);
    }
  }, [aiFailureCount, safeSetState]);
  
  const fullResetGame = useCallback(() => {
    if (!isMounted.current) return;
    debugLog("fullResetGame: Resetting all game state and aborting requests.");
  
    currentQuestionAbortController.current?.abort("Game reset");
    nextQuestionAbortController.current?.abort("Game reset");
  
    resetQuestionState();
    safeSetState<TextInputQuestion | null>(setCurrentQuestion, null);
    safeSetState<TextInputQuestion | null>(setNextQuestion, null);
    
    safeSetState<boolean>(setIsLoadingCurrentQuestion, false); // Set to true before load
    safeSetState<boolean>(setIsLoadingNextQuestion, false);

    safeSetState<boolean>(setGameInitialized, false); // This will trigger re-initialization by the effect
    safeSetState<number>(setAiFailureCount, 0);
    safeSetState<boolean>(setShowAiFailureAlert, false);
    
    isLoadingTransition.current = false;
  }, [resetQuestionState, safeSetState, debugLog]);


  const handleSubmit = useCallback(async () => {
    debugLog("handleSubmit: Start. currentQuestion:", currentQuestion?.targetWord, "userInput:", userInput);
    if (!currentQuestion || !currentQuestion.correctAnswer || isCorrect !== null) return;

    const currentAttempts = attempts + 1;
    safeSetState<number>(setAttempts, currentAttempts);

    const userNormalizedInput = userInput.trim().toLowerCase();
    const correctNormalizedAnswer = currentQuestion.correctAnswer.trim().toLowerCase();
    const currentlyCorrect = userNormalizedInput === correctNormalizedAnswer;
    
    safeSetState<boolean | null>(setIsCorrect, currentlyCorrect);

    const targetWordObject = libraryWords.find(w => w.text === currentQuestion.targetWord);
    const isWordDue = targetWordObject ? isDue(targetWordObject.fsrsCard.due) : false;

    if (currentlyCorrect) {
      toast({ title: "Correct!", description: `"${currentQuestion.correctAnswer}" is right!`, className: "bg-green-500 text-white" });
      if (targetWordObject) {
        let rating: number = 3; // Default to Good
        if (currentAttempts === 1 && !hintUsedThisTurn) {
          rating = 4; // Easy
        }
        updateWordSRS(targetWordObject.id, rating);
        if (isWordDue) {
          toast({ title: "Bonus!", description: "You reviewed this word on time! +1", className: "bg-yellow-400 text-black" });
        }
      }
    } else { 
      safeSetState<boolean>(setShowCorrectAnswer, true);
      toast({ title: "Incorrect", description: `The correct answer was: "${currentQuestion.correctAnswer}"`, variant: "destructive" });
      if (targetWordObject) {
        updateWordSRS(targetWordObject.id, 1); // Again
      }
    }
    showPanelForWord(currentQuestion.targetWord); // Use shared hook to show details
    wordDetailsApi.fetchDetails(currentQuestion.targetWord);
    // Details should be loading/loaded by loadCurrentAndPrepareNext.
    // If currentWordDetails are null or mismatched for currentQuestion, loadCurrentAndPrepareNext handles it.
    // This assumes WordDetailPanel will show loading if currentWordDetails are null and isLoadingCurrentDetails is true.

    if (currentlyCorrect || !currentlyCorrect) {
      if (currentQuestion && startTime.current) {
        logQuizResult({
          word: currentQuestion.targetWord,
          correct: currentlyCorrect,
          duration: Date.now() - startTime.current,
          game: 'text-input',
          timestamp: Date.now(),
        });
      }
    }
  }, [
    currentQuestion, isCorrect, userInput, libraryWords, updateWordSRS, toast, 
    attempts, hintUsedThisTurn, debugLog, safeSetState, wordDetailsApi, showPanelForWord
  ]);

  const revealHint = useCallback(() => {
    if (!currentQuestion || !currentQuestion.correctAnswer || hintRevealedThisQuestion || isCorrect !== null) return;

    let firstDiffIndex = -1;
    for (let i = 0; i < currentQuestion.correctAnswer.length; i++) {
        if (i >= userInput.length || userInput[i].toLowerCase() !== currentQuestion.correctAnswer[i].toLowerCase()) {
            firstDiffIndex = i;
            break;
        }
    }
    
    if (firstDiffIndex === -1 && userInput.length >= currentQuestion.correctAnswer.length) return; 
    
    const revealUpToIndex = firstDiffIndex === -1 ? currentQuestion.correctAnswer.length : firstDiffIndex + 1;
    if (revealUpToIndex > currentQuestion.correctAnswer.length) return;

    const revealedPortion = currentQuestion.correctAnswer.substring(0, revealUpToIndex);
    
    safeSetState<string>(setUserInput, revealedPortion);
    safeSetState<boolean>(setHintRevealedThisQuestion, true);
    safeSetState<boolean>(setHintUsedThisTurn, true);
    
    toast({ title: "Hint Revealed", description: `Input updated to "${revealedPortion}"`, className: "bg-blue-500 text-white" });
    
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
      setTimeout(() => hiddenInputRef.current?.setSelectionRange(revealedPortion.length, revealedPortion.length), 0);
    }
  }, [currentQuestion, userInput, hintRevealedThisQuestion, isCorrect, toast, safeSetState]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCorrect !== null) return; 
    const value = e.target.value;
    // Allow typing beyond correct answer length, but handleSubmit will use .trim()
    safeSetState<string>(setUserInput, value);
  };

  const renderCharacterSpans = useCallback(() => {
    // ... (This function can remain as is, it correctly uses currentQuestion, userInput, showCorrectAnswer, isCorrect)
    if (!currentQuestion || !currentQuestion.correctAnswer) return null;
  
    const correctAnswerChars = currentQuestion.correctAnswer.split('');
    const displaySpans = [];
    let isInputCurrentlyCorrectPrefix = true;

    if (userInput.length > 0 && !showCorrectAnswer) { // Check prefix validity only before submission
        isInputCurrentlyCorrectPrefix = currentQuestion.correctAnswer.toLowerCase().startsWith(userInput.toLowerCase());
    }
  
    for (let i = 0; i < correctAnswerChars.length; i++) {
      const typedChar = userInput[i];
      let charToDisplay = '_';
      let charColor = 'text-foreground'; 
      let borderColor = 'border-muted-foreground'; 
  
      if (showCorrectAnswer) { // After submission
        charToDisplay = correctAnswerChars[i];
        if (isCorrect) { 
            charColor = 'text-green-500 dark:text-green-400';
            borderColor = 'border-green-500 dark:border-green-400';
        } else { 
            if (typedChar?.toLowerCase() === correctAnswerChars[i].toLowerCase()) {
              charColor = 'text-green-500 dark:text-green-400'; 
              borderColor = 'border-green-500 dark:border-green-400';
            } else if (typedChar) { 
              charColor = 'text-red-500 dark:text-red-400 line-through'; 
              borderColor = 'border-red-500 dark:border-red-400';
              // charToDisplay = typedChar; // Show user's mistake with strikethrough
              // Or show correct char, and typedChar might be in a tooltip or small text above/below
            } else { // Not typed by user, but answer revealed as incorrect
              charColor = 'text-orange-500 dark:text-orange-400'; 
              borderColor = 'border-orange-500 dark:border-orange-400';
            }
        }
      } else if (typedChar) { // While typing
        charToDisplay = typedChar; 
        charColor = isInputCurrentlyCorrectPrefix ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';
        borderColor = isInputCurrentlyCorrectPrefix ? 'border-green-500 dark:border-green-400' : 'border-red-500 dark:border-red-400';
      }
      
      displaySpans.push(
        <span
          key={`${currentQuestion.targetWord}-char-${i}`}
          className={cn(
            "inline-flex items-center justify-center text-2xl sm:text-3xl font-mono w-7 h-10 sm:w-10 sm:h-14 border-b-2 mx-px sm:mx-0.5 transition-colors duration-150",
            charColor,
            borderColor
          )}
        >
          {charToDisplay}
        </span>
      );
    }
    return <div className="flex flex-wrap justify-center items-center p-2 cursor-text" onClick={() => hiddenInputRef.current?.focus()}>{displaySpans}</div>;
  }, [currentQuestion, userInput, showCorrectAnswer, isCorrect]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') e.preventDefault(); // Prevent page scroll

      if (isLoadingCurrentQuestion || !currentQuestion || isLoadingTransition.current) return;

      if (isCorrect !== null) { // Answer has been submitted
        if (e.key === ' ' || e.key === 'Enter') {
          const nextButtonDisabled = isLoadingCurrentQuestion || isLoadingNextQuestion || isLoadingTransition.current;
          if (!nextButtonDisabled) {
            loadCurrentAndPrepareNext();
          }
        }
        return;
      }

      // If answer not submitted yet (isCorrect === null)
      if (e.key === 'Enter') {
        if (userInput.trim().length > 0) { // Submit button would be enabled
          handleSubmit();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQuestion, isCorrect, userInput, handleSubmit, loadCurrentAndPrepareNext,
    isLoadingCurrentQuestion, isLoadingNextQuestion
  ]);


  const renderDebugInfo = useCallback(() => {
    if (!DEBUG) return null;
    return (
      <div className="text-xs border border-red-500 p-2 mt-4 bg-red-50 dark:bg-red-900/20 rounded max-w-full overflow-auto">
        <h4 className="font-bold mb-1">Debug Info:</h4>
        <ul className="space-y-0.5">
          <li>hasEnoughWords: {hasEnoughWords.toString()}</li>
          <li>gameInitialized: {gameInitialized.toString()}</li>
          <li>isLoadingTransition: {isLoadingTransition.current.toString()}</li>
          <li>isLoadingCurrentQ: {isLoadingCurrentQuestion.toString()}</li>
          <li>isLoadingNextQ: {isLoadingNextQuestion.toString()}</li>
          <li>CurrentQ: {currentQuestion ? `${currentQuestion.targetWord} (${currentQuestion.correctAnswer})` : 'null'}</li>
          <li>NextQ: {nextQuestion ? `${nextQuestion.targetWord} (${nextQuestion.correctAnswer})` : 'null'}</li>
          <li>aiFailureCount: {aiFailureCount}</li>
          <li>Available Words: {libraryWords.length}</li>
        </ul>
        <div className="mt-2">
          <Button size="sm" variant="destructive" onClick={fullResetGame}>
            Force Reset Game
          </Button>
        </div>
      </div>
    );
  }, [
    hasEnoughWords, gameInitialized, isLoadingCurrentQuestion, isLoadingNextQuestion, 
    currentQuestion, nextQuestion, aiFailureCount, libraryWords, fullResetGame
  ]);

  // Render Logic
  if (vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading vocabulary...</span></div>;
  }
  
  if (showAiFailureAlert) {
    return (
      <EmptyState
        title="AI Service Issue"
        description={
          <>There seems to be an issue generating questions/details. Try resetting or check back later.</>
        }
        icon={<Info className="h-5 w-5" />}
      >
        <div className="mt-4 flex gap-2 justify-center">
          <Button onClick={fullResetGame} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
          <Button onClick={onStopGame} variant="secondary">Stop Game</Button>
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl max-w-2xl mx-auto">
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
            <CardTitle className="text-2xl">Text Input Challenge</CardTitle>
            {(isLoadingNextQuestion) && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary mr-1" /> 
                <span>Preparing next...</span>
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              </div>
            )}
          </div>
          <CardDescription>Type the English word that fits the blank. Check the Vietnamese hint below!</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-6">
          {isLoadingCurrentQuestion && !currentQuestion && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Generating question...</p>
            </div>
          )}

          {!isLoadingCurrentQuestion && currentQuestion && currentQuestion.correctAnswer && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <p className="text-xl md:text-2xl text-center p-4 sm:p-6 bg-muted rounded-lg shadow-inner min-h-[80px] sm:min-h-[100px] flex items-center justify-center mb-0">
                  {currentQuestion.sentenceWithBlank.replace(/___/g, " ______ ")}
                </p>
              </div>
              <p className="text-sm text-center text-muted-foreground italic px-2 py-1 bg-secondary/30 rounded-md">
                Hint: {currentQuestion.translatedHint}
              </p>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-full flex flex-wrap justify-center items-center p-2 cursor-text border-2 border-muted-foreground rounded-lg min-h-[56px] focus-within:ring-2 focus-within:ring-primary transition-all bg-background"
                  tabIndex={0}
                  aria-label="Type the missing word here"
                  onClick={() => hiddenInputRef.current?.focus()}
                  style={{ outline: 'none' }}
                >
                  {renderCharacterSpans()}
                  <input
                    ref={hiddenInputRef}
                    type="text"
                    value={userInput}
                    onChange={handleHiddenInputChange}
                    className="fixed -top-10 left-0 w-0 h-0 opacity-0 pointer-events-none"
                    aria-label="Type the missing word here"
                    maxLength={(currentQuestion?.correctAnswer?.length || 0) + 10}
                    disabled={disabled || isCorrect !== null || isLoadingTransition.current}
                    autoFocus
                    tabIndex={-1}
                  />
                </div>
                <span className="text-xs text-muted-foreground mt-1">Tap or click the blanks to type your answer</span>
              </div>
              {isCorrect === false && showCorrectAnswer && (
                <p className="text-sm text-red-500 dark:text-red-400 text-center font-semibold">
                  The correct answer was: "{currentQuestion.correctAnswer}"
                </p>
              )}
              <div className="flex justify-center pt-2">
                <Button 
                  onClick={revealHint} 
                  variant="outline" 
                  size="sm" 
                  disabled={disabled || hintRevealedThisQuestion || isCorrect !== null || isLoadingTransition.current}
                  className="w-full sm:w-auto"
                >
                  <KeyRound className="mr-2 h-4 w-4" /> 
                  Reveal Hint (1 use)
                </Button>
              </div>
            </>
          )}
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && gameInitialized && !isLoadingTransition.current && (
            <EmptyState
              title="No Question Available"
              description={<>Could not load a question. Make sure you have some words in your library.</>}
              icon={<Info className="h-5 w-5" />}
            >
              <Button 
                onClick={fullResetGame}
                className="mt-3" 
                disabled={disabled || isLoadingTransition.current || isLoadingCurrentQuestion}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
            </EmptyState>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4">
          <Button onClick={onStopGame} variant="outline" size="lg" className="w-full sm:w-auto"
            disabled={disabled || isLoadingTransition.current}>
            <StopCircle className="mr-2 h-5 w-5" /> Stop Game
          </Button>

          {isCorrect === null && currentQuestion && (
            <Button 
              onClick={handleSubmit} 
              disabled={disabled || userInput.trim().length === 0 || isLoadingTransition.current} 
              size="lg" 
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-5 w-5" /> Submit Answer
            </Button>
          )}

          {isCorrect !== null && ( 
            <Button 
              onClick={loadCurrentAndPrepareNext} 
              className="w-full sm:w-auto" 
              size="lg" 
              variant="default"
              disabled={disabled || isLoadingTransition.current || isLoadingCurrentQuestion || isLoadingNextQuestion}
            >
              {(isLoadingTransition.current || isLoadingCurrentQuestion || isLoadingNextQuestion) ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-5" />
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
      {DEBUG && renderDebugInfo()}
    </div>
  );
});

TextInputGame.displayName = 'TextInputGame';
export default TextInputGame;