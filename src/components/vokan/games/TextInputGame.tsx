"use client";

import type { FC } from 'react';
import React, { useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, Sparkles, KeyRound, Send, CalendarClock } from 'lucide-react';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, TextInputQuestion, GeneratedWordDetails } from '@/types';
import { generateTextInputQuestion } from '@/ai/flows/generate-text-input-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useWordGameCore } from './useWordGameCore';
import { EmptyState } from '@/components/ui/EmptyState';
import { isDue, logQuizResult } from '@/lib/utils';
import WordDetailPanel from './WordDetailPanel';
import { Due } from '@/components/vokan/library/Due';
import { WordStageIndicator } from './WordStageIndicator';
import { useWordGameAnswerState } from './useWordGameAnswerState';
import { useWordGameKeyboardNavigation } from './useWordGameKeyboardNavigation';
import { showStandardToast } from '@/lib/showStandardToast';

interface TextInputGameProps {
  onStopGame: () => void;
  disabled?: boolean;
}

const DEBUG = false; // Set to false in production

// --- Quiz/Game Log Util ---
// Remove local QUIZ_LOG_KEY, use only logQuizResult from utils

// --- Component ---
const TextInputGame: FC<TextInputGameProps> = React.memo(({ onStopGame, disabled }) => {
  const { toast } = useToast();

  const generateSingleQuestion = React.useCallback(async (targetWord: Word, _abortController: AbortController) => {
    try {
      const aiInput = { word: targetWord.text };
      const questionData = await generateTextInputQuestion(aiInput);
      if (!core.isMounted.current) return null;
      if (!questionData || !questionData.sentenceWithBlank || !questionData.targetWord || !questionData.translatedHint) {
        core.toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
        showStandardToast(toast, 'error', 'AI Error', 'Could not generate a question.');
        return null;
      }
      return {
        sentenceWithBlank: questionData.sentenceWithBlank,
        translatedHint: questionData.translatedHint,
        correctAnswer: questionData.targetWord,
        targetWord: targetWord.text,
      };
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && core.isMounted.current) {
        core.toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
        showStandardToast(toast, 'error', 'AI Error', 'Could not generate a question.');
      }
      return null;
    }
  }, []);

  const core = useWordGameCore<TextInputQuestion>({
    minWords: 1,
    generateSingleQuestion,
  });

  const answerState = useWordGameAnswerState<TextInputQuestion>();

  // Game-specific state
  const [aiFailureCount, setAiFailureCount] = React.useState(0);
  const [showAiFailureAlert, setShowAiFailureAlert] = React.useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const isLoadingTransition = useRef(false);

  // Mount/Unmount Effect
  useEffect(() => {
    core.isMounted.current = true;
    return () => {
      core.isMounted.current = false;
    };
  }, []);

  // Focus hidden input when a new question is ready
  useEffect(() => {
    if (core.currentQuestion && !core.isLoadingCurrentQuestion && answerState.isCorrect === null && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [core.currentQuestion, core.isLoadingCurrentQuestion, answerState.isCorrect]);

  // Set startTime when a new question is loaded
  useEffect(() => {
    if (core.currentQuestion) {
      if (answerState.startTime) answerState.startTime.current = Date.now();
    }
  }, [core.currentQuestion, answerState]);

  const fetchAndStoreNextQuestion = useCallback(async () => {
    if (core.vocabLoading || !core.hasEnoughWords || !core.isMounted.current || core.isLoadingNextQuestion) return;
    const currentTargetWordId = core.currentQuestion ? core.libraryWords.find(w => w.text === core.currentQuestion?.targetWord)?.id : undefined;
    const excludeIds = currentTargetWordId ? [currentTargetWordId] : [];
    const nextTargetWordObj = core.selectTargetWord(excludeIds);
    if (!nextTargetWordObj) {
      if (core.hasEnoughWords && core.isMounted.current) {
        // No suitable next word found
      }
      return;
    }
    core.setIsLoadingNextQuestion(true);
    try {
      const question = await generateSingleQuestion(nextTargetWordObj, new AbortController());
      if (core.isMounted.current) {
        core.setNextQuestion(question);
      }
    } catch (error) {
      // Error handling is in generateSingleQuestion
    } finally {
      if (core.isMounted.current) core.setIsLoadingNextQuestion(false);
    }
  }, [
    core.vocabLoading, core.hasEnoughWords, core.isLoadingNextQuestion, core.currentQuestion, core.libraryWords, 
    core.selectTargetWord, generateSingleQuestion, core.isMounted
  ]);

  const resetQuestionState = useCallback(() => {
    answerState.resetAnswerState();
    core.resetPanel(); // Hide word details panel on new question
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [core, hiddenInputRef, answerState]);

  const loadCurrentAndPrepareNext = useCallback(async () => {
    if (!core.isMounted.current || core.vocabLoading || !core.hasEnoughWords || isLoadingTransition.current) {
      return;
    }
    isLoadingTransition.current = true;
    resetQuestionState();
    core.setIsLoadingCurrentQuestion(true);
    let questionToLoad: TextInputQuestion | null = null;
    if (core.nextQuestion) {
      questionToLoad = core.nextQuestion;
      core.setCurrentQuestion(questionToLoad);
      core.setNextQuestion(null);
      core.setIsLoadingCurrentQuestion(false);
      fetchAndStoreNextQuestion();
    } else {
      const targetWordObj = core.selectTargetWord();
      if (!targetWordObj) {
        if (core.isMounted.current) {
          core.toast({ title: "No Words Available", description: "Please add some words to your library first.", variant: "destructive" });
          showStandardToast(toast, 'error', 'No Words Available', 'Please add some words to your library first.');
        }
        core.setIsLoadingCurrentQuestion(false);
        isLoadingTransition.current = false;
        return;
      }
      try {
        questionToLoad = await generateSingleQuestion(targetWordObj, new AbortController());
        if (core.isMounted.current) {
          core.setCurrentQuestion(questionToLoad);
          if (questionToLoad) {
            fetchAndStoreNextQuestion();
          }
        }
      } catch (error) {
      } finally {
        if (core.isMounted.current) core.setIsLoadingCurrentQuestion(false);
      }
    }
    isLoadingTransition.current = false;
  }, [
    core.vocabLoading, core.hasEnoughWords, core.nextQuestion, core.selectTargetWord, 
    generateSingleQuestion, fetchAndStoreNextQuestion, resetQuestionState, core.isMounted
  ]);

  // Initial Game Load Effect
  useEffect(() => {
    if (!core.vocabLoading && core.hasEnoughWords && !core.gameInitialized && core.isMounted.current) {
      loadCurrentAndPrepareNext();
      core.setGameInitialized(true);
    }
  }, [core.vocabLoading, core.hasEnoughWords, core.gameInitialized, loadCurrentAndPrepareNext, core.isMounted]);

  // AI Failure Alert Effect
  useEffect(() => {
    if (aiFailureCount >= 3) {
      if(core.isMounted.current) setShowAiFailureAlert(true);
    } else {
      if(core.isMounted.current) setShowAiFailureAlert(false);
    }
  }, [aiFailureCount, core.isMounted]);
  
  const fullResetGame = useCallback(() => {
    if (!core.isMounted.current) return;
    resetQuestionState();
    core.setCurrentQuestion(null);
    core.setNextQuestion(null);
    core.setIsLoadingCurrentQuestion(false);
    core.setIsLoadingNextQuestion(false);
    core.setGameInitialized(false);
    setAiFailureCount(0);
    setShowAiFailureAlert(false);
    isLoadingTransition.current = false;
  }, [resetQuestionState, core]);

  const handleSubmit = useCallback(async () => {
    if (!core.currentQuestion || !core.currentQuestion.correctAnswer || answerState.isCorrect !== null) return;
    const currentAttempts = answerState.attempts + 1;
    answerState.setAttempts(currentAttempts);
    const userNormalizedInput = answerState.userInput.trim().toLowerCase();
    const correctNormalizedAnswer = core.currentQuestion.correctAnswer.trim().toLowerCase();
    const currentlyCorrect = userNormalizedInput === correctNormalizedAnswer;
    answerState.setIsCorrect(currentlyCorrect);
    const targetWordObject = core.currentQuestion && 'targetWord' in core.currentQuestion && core.currentQuestion.targetWord ? core.libraryWords.find(w => w.text === core.currentQuestion.targetWord) : undefined;
    const isWordDue = targetWordObject ? isDue(targetWordObject.fsrsCard.due) : false;
    if (currentlyCorrect) {
      showStandardToast(core.toast, 'success', 'Correct!', `"${core.currentQuestion.correctAnswer}" is right!`);
      if (targetWordObject) {
        let rating: number = 3;
        if (currentAttempts === 1 && !answerState.hintUsed) {
          rating = 4;
        }
        core.updateWordSRS(targetWordObject.id, rating);
        if (isWordDue) {
          showStandardToast(core.toast, 'info', 'Bonus!', 'You reviewed this word on time! +1');
        }
      }
    } else { 
      showStandardToast(core.toast, 'error', 'Incorrect', `The correct answer was: "${core.currentQuestion.correctAnswer}"`);
      if (targetWordObject) {
        core.updateWordSRS(targetWordObject.id, 1);
      }
    }
    if (core.currentQuestion && answerState.startTime && answerState.startTime.current) {
      logQuizResult({
        word: core.currentQuestion.targetWord,
        correct: currentlyCorrect,
        duration: Date.now() - answerState.startTime.current,
        game: 'text-input',
        timestamp: Date.now(),
      });
    }
    // Show word details panel after answer
    if (core.currentQuestion) {
      core.showPanelForWord(core.currentQuestion.targetWord);
      core.wordDetailsApi.fetchDetails(core.currentQuestion.targetWord);
    }
  }, [
    core.currentQuestion, answerState, core.libraryWords, core.updateWordSRS, 
    aiFailureCount, showAiFailureAlert, core
  ]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (answerState.isCorrect !== null) return; 
    const value = e.target.value;
    answerState.setUserInput(value);
  };

  const renderCharacterSpans = useCallback(() => {
    // ... (This function can remain as is, it correctly uses currentQuestion, userInput, showCorrectAnswer, isCorrect)
    if (!core.currentQuestion || !core.currentQuestion.correctAnswer) return null;
  
    const correctAnswerChars = core.currentQuestion.correctAnswer.split('');
    const displaySpans = [];
    let isInputCurrentlyCorrectPrefix = true;

    if (answerState.userInput.length > 0 && !answerState.showCorrectAnswer) { // Check prefix validity only before submission
        isInputCurrentlyCorrectPrefix = core.currentQuestion.correctAnswer.toLowerCase().startsWith(answerState.userInput.toLowerCase());
    }
  
    for (let i = 0; i < correctAnswerChars.length; i++) {
      const typedChar = answerState.userInput[i];
      let charToDisplay = '_';
      let charColor = 'text-foreground'; 
      let borderColor = 'border-muted-foreground'; 
  
      if (answerState.showCorrectAnswer) { // After submission
        charToDisplay = correctAnswerChars[i];
        if (answerState.isCorrect) { 
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
          key={`${core.currentQuestion.targetWord}-char-${i}`}
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
  }, [core.currentQuestion, answerState.userInput, answerState.showCorrectAnswer, answerState.isCorrect]);

  // Keyboard shortcuts
  useWordGameKeyboardNavigation(
    useCallback((e: KeyboardEvent) => {
      if (disabled || isLoadingTransition.current || core.isLoadingCurrentQuestion || core.isLoadingNextQuestion) return;
      if ((e.key === ' ' || e.key === 'Enter') && answerState.isCorrect !== null) {
        loadCurrentAndPrepareNext();
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Return') && answerState.isCorrect === null && answerState.userInput.trim().length > 0) {
        handleSubmit();
        return;
      }
    }, [disabled, core.isLoadingCurrentQuestion, core.isLoadingNextQuestion, answerState.isCorrect, answerState.userInput, loadCurrentAndPrepareNext, handleSubmit]),
    [disabled, core.isLoadingCurrentQuestion, core.isLoadingNextQuestion, answerState.isCorrect, answerState.userInput, loadCurrentAndPrepareNext, handleSubmit]
  );

  // Render Logic
  if (core.vocabLoading) {
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
            const wordObj = core.currentQuestion ? core.libraryWords.find(w => w.text === core.currentQuestion?.targetWord) : undefined;
            if (!wordObj) return null;
            return (
              <div className="absolute -top-3 -left-3 flex gap-1 z-10">
                <WordStageIndicator state={wordObj.fsrsCard.state} />
                <Due isDue={isDue(wordObj.fsrsCard.due)} />
              </div>
            );
          })()}
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">Text Input Challenge</CardTitle>
            {(core.isLoadingNextQuestion) && (
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
          {core.isLoadingCurrentQuestion && !core.currentQuestion && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Generating question...</p>
            </div>
          )}

          {!core.isLoadingCurrentQuestion && core.currentQuestion && core.currentQuestion.correctAnswer && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <p className="text-xl md:text-2xl text-center p-4 sm:p-6 bg-muted rounded-lg shadow-inner min-h-[80px] sm:min-h-[100px] flex items-center justify-center mb-0">
                  {core.currentQuestion.sentenceWithBlank.replace(/___/g, " ______ ")}
                </p>
              </div>
              <p className="text-sm text-center text-muted-foreground italic px-2 py-1 bg-secondary/30 rounded-md">
                Hint: {core.currentQuestion.translatedHint}
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
                    value={answerState.userInput}
                    onChange={handleHiddenInputChange}
                    className="fixed -top-10 left-0 w-0 h-0 opacity-0 pointer-events-none"
                    aria-label="Type the missing word here"
                    maxLength={(core.currentQuestion?.correctAnswer?.length || 0) + 10}
                    disabled={disabled || answerState.isCorrect !== null}
                    autoFocus
                    tabIndex={-1}
                  />
                </div>
                <span className="text-xs text-muted-foreground mt-1">Tap or click the blanks to type your answer</span>
              </div>
              {answerState.isCorrect === false && answerState.showCorrectAnswer && (
                <p className="text-sm text-red-500 dark:text-red-400 text-center font-semibold">
                  The correct answer was: "{core.currentQuestion.correctAnswer}"
                </p>
              )}
              <div className="flex justify-center pt-2">
                <Button 
                  onClick={() => core.currentQuestion && answerState.revealHint(core.currentQuestion)} 
                  variant="outline" 
                  size="sm" 
                  disabled={disabled || answerState.hintRevealed || answerState.isCorrect !== null}
                  className="w-full sm:w-auto"
                >
                  <KeyRound className="mr-2 h-4 w-4" /> 
                  Reveal Hint (1 use)
                </Button>
              </div>
            </>
          )}
          
          {!core.isLoadingCurrentQuestion && !core.currentQuestion && !core.vocabLoading && core.gameInitialized && !isLoadingTransition.current && (
            <EmptyState
              title="No Question Available"
              description={<>Could not load a question. Make sure you have some words in your library.</>}
              icon={<Info className="h-5 w-5" />}
            >
              <Button 
                onClick={fullResetGame}
                className="mt-3" 
                disabled={disabled || isLoadingTransition.current || core.isLoadingCurrentQuestion}
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

          {answerState.isCorrect === null && core.currentQuestion && (
            <Button 
              onClick={handleSubmit} 
              disabled={disabled || answerState.userInput.trim().length === 0 || isLoadingTransition.current} 
              size="lg" 
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-5 w-5" /> Submit Answer
            </Button>
          )}

          {answerState.isCorrect !== null && ( 
            <Button 
              onClick={loadCurrentAndPrepareNext} 
              className="w-full sm:w-auto" 
              size="lg" 
              variant="default"
              disabled={disabled || isLoadingTransition.current || core.isLoadingCurrentQuestion || core.isLoadingNextQuestion}
            >
              {(isLoadingTransition.current || core.isLoadingCurrentQuestion || core.isLoadingNextQuestion) ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-5" />
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
    </div>
  );
});

TextInputGame.displayName = 'TextInputGame';
export default TextInputGame;