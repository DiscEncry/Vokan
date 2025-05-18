
"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, Sparkles, KeyRound, Send } from 'lucide-react';
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, TextInputQuestion, GeneratedWordDetails, FamiliarityLevel } from '@/types';
import { generateTextInputQuestion } from '@/ai/flows/generate-text-input-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TextInputGameProps {
  onStopGame: () => void;
}

const DEBUG = true; // Set to false in production

const TextInputGame: FC<TextInputGameProps> = React.memo(({ onStopGame }) => {
  const { words: allLibraryWords, updateWordFamiliarity, isLoading: vocabLoading } = useVocabulary();
  const { toast } = useToast();

  const debugLog = useCallback((...args: any[]) => {
    if (DEBUG) console.log("[TextInputGame]", ...args);
  }, []);

  const libraryWords = React.useMemo(() => {
    const filtered = allLibraryWords.filter(w => w.familiarity === 'Familiar' || w.familiarity === 'Mastered');
    debugLog("Filtered library words for game. Count:", filtered.length, filtered.map(w => `${w.text} (${w.familiarity})`));
    return filtered;
  }, [allLibraryWords, debugLog]);

  const [currentQuestion, setCurrentQuestion] = useState<TextInputQuestion | null>(null);
  const [nextQuestion, setNextQuestion] = useState<TextInputQuestion | null>(null);
  const wordDetailsCache = useRef<Map<string, GeneratedWordDetails>>(new Map());
  const [wordDetails, setWordDetails] = useState<GeneratedWordDetails | null>(null);
  const [nextWordDetails, setNextWordDetails] = useState<GeneratedWordDetails | null>(null);

  const [userInput, setUserInput] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hintRevealedThisQuestion, setHintRevealedThisQuestion] = useState(false);
  const [hintUsedThisTurn, setHintUsedThisTurn] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  const [isLoadingCurrentQuestion, setIsLoadingCurrentQuestion] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingNextDetails, setIsLoadingNextDetails] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [gameInitialized, setGameInitialized] = useState(false);
  const isLoadingTransition = useRef(false);
  const isMounted = useRef(true);
  const [aiFailureCount, setAiFailureCount] = useState(0);
  const [showAiFailureAlert, setShowAiFailureAlert] = useState(false);

  const currentQuestionAbortController = useRef<AbortController | null>(null);
  const nextQuestionAbortController = useRef<AbortController | null>(null);
  const wordDetailsAbortController = useRef<AbortController | null>(null);
  const nextWordDetailsAbortController = useRef<AbortController | null>(null);
  
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const hasEnoughWords = libraryWords.length > 0;

  // Helper for safe state updates
  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T | ((prev: T) => T)) => {
    if (isMounted.current) {
      setter(value);
    }
  }, []);
  
  const setAllLoadingStates = useCallback((isLoading: boolean) => {
    if (!isMounted.current) return;
    safeSetState(setIsLoadingCurrentQuestion, isLoading);
    safeSetState(setIsLoadingNextQuestion, isLoading);
    safeSetState(setIsLoadingDetails, isLoading);
    safeSetState(setIsLoadingNextDetails, isLoading);
  }, [safeSetState]);

  const resetQuestionState = useCallback(() => {
    debugLog("resetQuestionState called");
    safeSetState(setUserInput, '');
    safeSetState(setIsCorrect, null);
    safeSetState(setHintRevealedThisQuestion, false);
    safeSetState(setHintUsedThisTurn, false);
    safeSetState(setAttempts, 0);
    safeSetState(setShowCorrectAnswer, false);
    safeSetState(setShowDetails, false);
    if (hiddenInputRef.current) {
        hiddenInputRef.current.focus();
    }
  }, [safeSetState, debugLog]);
  
  const resetGame = useCallback(() => {
    if (!isMounted.current) return;
    debugLog("resetGame: Resetting all game state and aborting requests.");
  
    resetQuestionState();
    safeSetState(setCurrentQuestion, null);
    safeSetState(setNextQuestion, null);
    safeSetState(setWordDetails, null);
    safeSetState(setNextWordDetails, null);
    safeSetState(setGameInitialized, false);
    safeSetState(setAiFailureCount, 0);
    safeSetState(setShowAiFailureAlert, false);
  
    currentQuestionAbortController.current?.abort("Game reset");
    nextQuestionAbortController.current?.abort("Game reset");
    wordDetailsAbortController.current?.abort("Game reset");
    nextWordDetailsAbortController.current?.abort("Game reset");
  
    setAllLoadingStates(false);
    isLoadingTransition.current = false;
  }, [isMounted, resetQuestionState, safeSetState, setAllLoadingStates, debugLog]);


  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      debugLog("Component unmounting, aborting controllers.");
      currentQuestionAbortController.current?.abort("Component unmount");
      nextQuestionAbortController.current?.abort("Component unmount");
      wordDetailsAbortController.current?.abort("Component unmount");
      nextWordDetailsAbortController.current?.abort("Component unmount");
    };
  }, [debugLog]);

  useEffect(() => {
    if (currentQuestion && !isLoadingCurrentQuestion && isCorrect === null && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [currentQuestion, isLoadingCurrentQuestion, isCorrect]);

  const selectTargetWord = useCallback((excludeWordId?: string): Word | null => {
    debugLog("selectTargetWord: Called with excludeWordId:", excludeWordId, "Total eligible words in libraryWords:", libraryWords.length);
    if (!hasEnoughWords) {
      debugLog("selectTargetWord: Not enough words (hasEnoughWords is false).");
      return null;
    }
    
    let eligibleForSelection = [...libraryWords];
    debugLog("selectTargetWord: Initial eligible for selection count:", eligibleForSelection.length);

    if (excludeWordId) {
      eligibleForSelection = eligibleForSelection.filter(w => w.id !== excludeWordId);
      debugLog("selectTargetWord: After filtering excludeWordId '" + excludeWordId + "', count:", eligibleForSelection.length);
    }
    
    if (currentQuestion?.targetWord) {
        const currentTargetWordObj = libraryWords.find(w => w.text === currentQuestion.targetWord);
        if (currentTargetWordObj) {
            eligibleForSelection = eligibleForSelection.filter(w => w.id !== currentTargetWordObj.id);
            debugLog("selectTargetWord: After filtering currentQuestion.targetWord '" + currentQuestion.targetWord + "', count:", eligibleForSelection.length);
        }
    }

    if (eligibleForSelection.length === 0) {
      debugLog("selectTargetWord: No eligible words after filtering. Fallback: Using any word from libraryWords if available.");
      const fallbackSelected = libraryWords.length > 0 ? libraryWords[Math.floor(Math.random() * libraryWords.length)] : null;
      debugLog("selectTargetWord: Fallback selected word:", fallbackSelected ? fallbackSelected.text : "None");
      return fallbackSelected;
    }
    
    const selected = eligibleForSelection[Math.floor(Math.random() * eligibleForSelection.length)];
    debugLog("selectTargetWord: Selected word:", selected ? selected.text : "None");
    return selected;
  }, [libraryWords, currentQuestion, hasEnoughWords, debugLog]);

  const localGenerateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<TextInputQuestion | null> => {
    debugLog("localGenerateSingleQuestion for word:", targetWord?.text);
    if (!targetWord) {
      debugLog("localGenerateSingleQuestion: No target word provided.");
      return null;
    }
    try {
      const aiInput = { word: targetWord.text };
      debugLog("Calling generateTextInputQuestion with:", aiInput);
      // The AI flow itself handles the abort signal if it's designed to.
      // Genkit's underlying fetch might use it.
      const questionData = await generateTextInputQuestion(aiInput); 
      debugLog("AI response for text input question:", questionData);
      
      if (!isMounted.current) {
        debugLog("localGenerateSingleQuestion: Component unmounted during generation.");
        return null;
      }
      
      if (!questionData) {
        debugLog("localGenerateSingleQuestion: AI returned null/undefined.");
        if (isMounted.current) safeSetState(setAiFailureCount, prev => prev + 1);
        return null;
      }
      if (!questionData.sentenceWithBlank) {
        debugLog("localGenerateSingleQuestion: Missing sentenceWithBlank from AI response.");
        if (isMounted.current) safeSetState(setAiFailureCount, prev => prev + 1);
        return null;
      }
      if (!questionData.correctAnswer && !questionData.targetWord) { // AI schema uses targetWord for the blanked word
        debugLog("localGenerateSingleQuestion: Missing correctAnswer/targetWord from AI response.");
        if (isMounted.current) safeSetState(setAiFailureCount, prev => prev + 1);
        return null;
      }
       if (!questionData.translatedHint) {
        debugLog("localGenerateSingleQuestion: Missing translatedHint from AI response.");
        if (isMounted.current) safeSetState(setAiFailureCount, prev => prev + 1);
        return null;
      }
      
      if (isMounted.current) safeSetState(setAiFailureCount, 0); 
      return {
        sentenceWithBlank: questionData.sentenceWithBlank,
        translatedHint: questionData.translatedHint,
        correctAnswer: questionData.targetWord || questionData.correctAnswer, // Use targetWord from AI schema first
        targetWord: targetWord.text, 
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          debugLog("localGenerateSingleQuestion: Aborted.");
        } else {
          debugLog("Error in localGenerateSingleQuestion:", error, error.message, error.stack);
          if (isMounted.current) {
            toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
            safeSetState(setAiFailureCount, prev => prev + 1);
          }
        }
      } else {
        debugLog("Unknown error in localGenerateSingleQuestion:", error);
        if (isMounted.current) {
            toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
            safeSetState(setAiFailureCount, prev => prev + 1);
        }
      }
      return null;
    }
  }, [toast, debugLog, safeSetState]);

  const fetchDetailsWithCache = useCallback(async (wordText: string, abortController: AbortController, setLoadingState: React.Dispatch<React.SetStateAction<boolean>>): Promise<GeneratedWordDetails | null> => {
    debugLog("fetchDetailsWithCache for word:", wordText);
    const normalizedWordText = wordText.toLowerCase();
    if (wordDetailsCache.current.has(normalizedWordText)) {
      const cached = wordDetailsCache.current.get(normalizedWordText);
      if (cached && !cached.details.startsWith("Unable to retrieve full details")) {
          debugLog("Returning cached details for:", wordText);
          return cached;
      }
    }
    debugLog("No valid cache for:", wordText, "- Fetching from AI.");
    safeSetState(setLoadingState, true);
    try {
      // The AI flow itself handles the abort signal if it's designed to.
      const detailsData = await generateWordDetails({ word: wordText });
      debugLog("AI response for word details:", detailsData);

      if (!isMounted.current) {
        debugLog("fetchDetailsWithCache: Component unmounted during detail fetch.");
        return null;
      }
      if (detailsData && !detailsData.details.startsWith("Unable to retrieve full details")) {
        wordDetailsCache.current.set(normalizedWordText, detailsData);
        debugLog("Cached new details for:", wordText);
      }
      return detailsData;
    } catch (error) {
       if (error instanceof Error) {
        if (error.name === 'AbortError') {
          debugLog("fetchDetailsWithCache: Aborted.");
        } else {
          debugLog("Error in fetchDetailsWithCache:", error, error.message, error.stack);
          if (isMounted.current) {
            toast({ title: "AI Error", description: "Could not fetch word details.", variant: "destructive" });
          }
        }
      } else {
        debugLog("Unknown error in fetchDetailsWithCache:", error);
         if (isMounted.current) {
            toast({ title: "AI Error", description: "Could not fetch word details.", variant: "destructive" });
        }
      }
      return { word: wordText, details: `Unable to retrieve full details for "${wordText}" at this time due to an error.` };
    } finally {
      safeSetState(setLoadingState, false);
    }
  }, [toast, debugLog, safeSetState]);

  const fetchAndStoreNextQuestionAndDetails = useCallback(async () => {
    debugLog("fetchAndStoreNextQuestionAndDetails: Start. Conditions - vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "isLoadingTransition:", isLoadingTransition.current, "isLoadingNextQ:", isLoadingNextQuestion, "isLoadingNextD:", isLoadingNextDetails);
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingTransition.current || isLoadingNextQuestion || isLoadingNextDetails) {
        debugLog("fetchAndStoreNextQuestionAndDetails: Bailing early due to unmet conditions.");
        if(isMounted.current) {
            safeSetState(setIsLoadingNextQuestion, false);
            safeSetState(setIsLoadingNextDetails, false);
        }
        return;
    }

    safeSetState(setIsLoadingNextQuestion, true);
    safeSetState(setIsLoadingNextDetails, true); 
    safeSetState(setNextQuestion, null);
    safeSetState(setNextWordDetails, null);
    
    if (nextQuestionAbortController.current) nextQuestionAbortController.current.abort("New next question fetch started");
    nextQuestionAbortController.current = new AbortController();
    if (nextWordDetailsAbortController.current) nextWordDetailsAbortController.current.abort("New next details fetch started");
    nextWordDetailsAbortController.current = new AbortController();

    const currentTargetWordId = currentQuestion ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined;
    const nextTargetWordObj = selectTargetWord(currentTargetWordId);
    debugLog("fetchAndStoreNextQuestionAndDetails: Next target word object:", nextTargetWordObj ? nextTargetWordObj.text : "None");

    if (!nextTargetWordObj) {
      if (hasEnoughWords && isMounted.current) {
        toast({ title: "No More Words", description: "You've reviewed all 'Familiar' or 'Mastered' words for now.", variant: "default" });
      }
      if (isMounted.current) {
        safeSetState(setIsLoadingNextQuestion, false);
        safeSetState(setIsLoadingNextDetails, false);
      }
      return;
    }

    try {
      const question = await localGenerateSingleQuestion(nextTargetWordObj, nextQuestionAbortController.current);
      if (isMounted.current && question) {
        safeSetState(setNextQuestion, question); 
        const details = await fetchDetailsWithCache(question.targetWord, nextWordDetailsAbortController.current, setIsLoadingNextDetails);
        if (isMounted.current) {
          safeSetState(setNextWordDetails, details); 
        }
      } else if (isMounted.current) {
         safeSetState(setNextQuestion, null);
         safeSetState(setNextWordDetails, null);
         safeSetState(setIsLoadingNextDetails, false); 
      }
    } catch (error) {
       if(isMounted.current) {
          debugLog("Error in fetchAndStoreNextQuestionAndDetails general catch block: ", error);
          safeSetState(setNextQuestion, null);
          safeSetState(setNextWordDetails, null);
          safeSetState(setIsLoadingNextDetails, false);
       }
    } finally {
      if (isMounted.current) {
        safeSetState(setIsLoadingNextQuestion, false);
        // If isLoadingNextDetails was managed by fetchDetailsWithCache, it should already be false.
        // This ensures it's false if the path to call fetchDetailsWithCache was not taken.
        if (!nextQuestion && !isLoadingNextDetails) {
            safeSetState(setIsLoadingNextDetails, false);
        }
      }
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, currentQuestion, libraryWords, localGenerateSingleQuestion, fetchDetailsWithCache, toast, isLoadingNextDetails, isLoadingNextQuestion, debugLog, safeSetState]);
  
  const initializeGame = useCallback(async () => {
    debugLog("initializeGame: Starting. vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "isLoadingTransition:", isLoadingTransition.current);
    debugLog("[State Debug]:", { isLoadingCurrentQuestion, isLoadingNextQuestion, currentQuestion: Boolean(currentQuestion), nextQuestion: Boolean(nextQuestion), isLoadingTransition: isLoadingTransition.current });
  
    if (isLoadingTransition.current || !hasEnoughWords) {
      debugLog("initializeGame: Exiting early - transition in progress or no words.");
      if (!hasEnoughWords && !vocabLoading && isMounted.current) {
        toast({ 
          title: "No Words Available", 
          description: "You need at least one 'Familiar' or 'Mastered' word to play.", 
          variant: "destructive" 
        });
      }
      return;
    }
    
    isLoadingTransition.current = true;
    
    resetQuestionState();
    safeSetState(setIsLoadingCurrentQuestion, true);
    safeSetState(setWordDetails, null);
    
    if (currentQuestionAbortController.current) currentQuestionAbortController.current.abort("New initialization");
    currentQuestionAbortController.current = new AbortController();
    
    if (wordDetailsAbortController.current) wordDetailsAbortController.current.abort("New initialization");
    wordDetailsAbortController.current = new AbortController();
    
    try {
      const initialTargetWord = selectTargetWord();
      if (!initialTargetWord) {
        debugLog("initializeGame: No target word found for initial question.");
        safeSetState(setCurrentQuestion, null);
         if (isMounted.current && !vocabLoading) { // only toast if vocab is loaded and still no words
          toast({ title: "No Words Available", description: "Add 'Familiar' or 'Mastered' words to your library.", variant: "destructive" });
        }
        return; // Exit finally will handle cleanup
      }
      debugLog("initializeGame: Selected initial target word:", initialTargetWord.text);
      
      let timeoutId: NodeJS.Timeout | null = null;
      const questionGenPromise = localGenerateSingleQuestion(initialTargetWord, currentQuestionAbortController.current);
      const timeoutPromise = new Promise<null>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Question generation timed out (10s)")), 10000);
      });
  
      const question = await Promise.race([questionGenPromise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      
      if (!isMounted.current) {
        debugLog("initializeGame: Component unmounted during question generation.");
        return;
      }
      
      if (!question) {
        debugLog("initializeGame: Failed to generate initial question (null or timeout).");
        if (isMounted.current) {
          toast({ title: "Question Generation Failed", description: "Could not create the first question. Please try resetting.", variant: "destructive" });
          safeSetState(setCurrentQuestion, null); // Ensure it's null if generation failed
        }
        return;
      }
      
      safeSetState(setCurrentQuestion, question);
      debugLog("initializeGame: Initial question set:", question);
      
      let details = null;
      if (question.targetWord) {
        safeSetState(setIsLoadingDetails, true); // setLoadingState directly
        details = await fetchDetailsWithCache(question.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
        if (isMounted.current) {
          safeSetState(setWordDetails, details);
          debugLog("initializeGame: Initial details set:", details);
        }
      }
      
      if (isMounted.current) {
        fetchAndStoreNextQuestionAndDetails();
        safeSetState(setGameInitialized, true);
        debugLog("initializeGame: Game successfully initialized.");
      }
    } catch (error) {
      if (error instanceof Error) {
        debugLog("initializeGame general error:", error.message, error.stack);
        if (isMounted.current) {
          toast({ title: "Initialization Failed", description: `Could not start the game: ${error.message}. Please try resetting.`, variant: "destructive" });
        }
      } else {
        debugLog("initializeGame unknown error:", error);
         if (isMounted.current) {
          toast({ title: "Initialization Failed", description: "An unknown error occurred. Please try resetting.", variant: "destructive" });
        }
      }
      safeSetState(setCurrentQuestion, null); // Ensure currentQuestion is null on error
    } finally {
      if (isMounted.current) {
        safeSetState(setIsLoadingCurrentQuestion, false);
      }
      isLoadingTransition.current = false;
      debugLog("initializeGame: Completed initialization process.");
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast, resetQuestionState, debugLog, safeSetState]);

  const handleNextQuestion = useCallback(async () => {
    debugLog("handleNextQuestion: Starting. isLoadingTransition:", isLoadingTransition.current);
    debugLog("[State Debug]:", { isLoadingCurrentQuestion, isLoadingNextQuestion, currentQuestion: Boolean(currentQuestion), nextQuestion: Boolean(nextQuestion), isLoadingTransition: isLoadingTransition.current });

    if (isLoadingTransition.current || !isMounted.current) return;
    
    isLoadingTransition.current = true;
    
    resetQuestionState();
    safeSetState(setIsLoadingCurrentQuestion, true);
    safeSetState(setWordDetails, null); 
    
    // Abort controllers for the *new* current question fetch (if needed)
    if (currentQuestionAbortController.current) currentQuestionAbortController.current.abort("Advancing to next question");
    currentQuestionAbortController.current = new AbortController();
    if (wordDetailsAbortController.current) wordDetailsAbortController.current.abort("Advancing to next question for details");
    wordDetailsAbortController.current = new AbortController();

    try {
      if (nextQuestion && nextQuestion.correctAnswer) { 
        debugLog("handleNextQuestion: Using pre-fetched nextQuestion:", nextQuestion.targetWord);
        safeSetState(setCurrentQuestion, nextQuestion);
        safeSetState(setWordDetails, nextWordDetails); // Use pre-fetched details too
        
        if (!nextWordDetails && nextQuestion.targetWord) { // If details for next question weren't ready, fetch them now
            debugLog("handleNextQuestion: Pre-fetched details were not ready for", nextQuestion.targetWord, "fetching now.");
            safeSetState(setIsLoadingDetails, true);
            const d = await fetchDetailsWithCache(nextQuestion.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
            safeSetState(setWordDetails, d);
        }
        
        safeSetState(setNextQuestion, null); 
        safeSetState(setNextWordDetails, null);
        fetchAndStoreNextQuestionAndDetails(); // Start fetching the *new* next question
      } else {
        debugLog("handleNextQuestion: No valid pre-fetched nextQuestion. Generating one now.");
        // Ensure next loading states are false as we are consuming/regenerating current, not waiting for next
        safeSetState(setIsLoadingNextQuestion, false);
        safeSetState(setIsLoadingNextDetails, false);

        const targetWordObj = selectTargetWord(currentQuestion?.targetWord);
        if (targetWordObj) {
          debugLog("handleNextQuestion: Selected new target word for on-the-fly generation:", targetWordObj.text);
          const q = await localGenerateSingleQuestion(targetWordObj, currentQuestionAbortController.current);
          if (isMounted.current) {
            safeSetState(setCurrentQuestion, q);
            if (q && q.correctAnswer) {
              debugLog("handleNextQuestion: On-the-fly question generated:", q.targetWord);
              safeSetState(setIsLoadingDetails, true);
              const d = await fetchDetailsWithCache(q.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
              safeSetState(setWordDetails, d);
              fetchAndStoreNextQuestionAndDetails(); 
            } else {
               debugLog("handleNextQuestion: Failed to generate question on-the-fly (q is null or invalid).");
               toast({ title: "Game Over?", description: "Could not load a new question. Add more 'Familiar' or 'Mastered' words.", variant: "destructive" });
               safeSetState(setCurrentQuestion, null); 
            }
          }
        } else {
          debugLog("handleNextQuestion: No target word found for on-the-fly generation. Game ends.");
          safeSetState(setCurrentQuestion, null); 
          toast({ title: "No Words Left!", description: "You've completed all 'Familiar' or 'Mastered' words.", variant: "default" });
        }
      }
    } catch (error) {
      if(isMounted.current) {
        debugLog("Error in handleNextQuestion general catch block:", error);
        toast({ title: "Error Advancing", description: "An unexpected error occurred.", variant: "destructive" });
        safeSetState(setCurrentQuestion, null);
      }
    } finally {
      if (isMounted.current) {
        safeSetState(setIsLoadingCurrentQuestion, false); 
      }
      isLoadingTransition.current = false;
      debugLog("handleNextQuestion: Completed.");
    }
  }, [nextQuestion, nextWordDetails, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast, resetQuestionState, currentQuestion, debugLog, safeSetState, libraryWords]);


  useEffect(() => {
    debugLog("Effect for game initialization check: vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "gameInitialized:", gameInitialized);
    if (!vocabLoading && hasEnoughWords && !gameInitialized) {
      initializeGame();
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, initializeGame, debugLog]);

  useEffect(() => {
    if (aiFailureCount >= 3) {
      if(isMounted.current) {
        debugLog("AI failure count reached 3, showing alert.");
        safeSetState(setShowAiFailureAlert, true);
      }
    } else {
      if(isMounted.current) safeSetState(setShowAiFailureAlert, false);
    }
  }, [aiFailureCount, debugLog, safeSetState]);

  const handleSubmit = useCallback(async () => {
    debugLog("handleSubmit: Start. currentQuestion:", currentQuestion?.targetWord, "userInput:", userInput, "isCorrect (before submit):", isCorrect);
    if (!currentQuestion || !currentQuestion.correctAnswer || isCorrect !== null) {
        debugLog("handleSubmit: Exiting - no current question, no correct answer, or already answered.");
        return;
    }

    const currentAttempts = attempts + 1;
    safeSetState(setAttempts, currentAttempts);

    const userNormalizedInput = userInput.trim().toLowerCase();
    const correctNormalizedAnswer = currentQuestion.correctAnswer.trim().toLowerCase();
    const currentlyCorrect = userNormalizedInput === correctNormalizedAnswer;
    
    safeSetState(setIsCorrect, currentlyCorrect);
    debugLog("handleSubmit: User input:", userInput, "Correct answer:", currentQuestion.correctAnswer, "Result:", currentlyCorrect);

    const targetWordObject = allLibraryWords.find(w => w.text === currentQuestion.targetWord);

    if (currentlyCorrect) {
      toast({ title: "Correct!", description: `"${currentQuestion.correctAnswer}" is right!`, className: "bg-green-500 text-white" });
      if (targetWordObject) {
        let newFamiliarity: FamiliarityLevel = targetWordObject.familiarity;
        if (currentAttempts === 1 && !hintUsedThisTurn) {
          if (targetWordObject.familiarity === 'Familiar') newFamiliarity = 'Mastered';
        } else { 
          if (targetWordObject.familiarity === 'Mastered') newFamiliarity = 'Familiar';
        }
        if (newFamiliarity !== targetWordObject.familiarity) {
            debugLog("handleSubmit (Correct): Updating familiarity for", targetWordObject.text, "from", targetWordObject.familiarity, "to", newFamiliarity);
            updateWordFamiliarity(targetWordObject.id, newFamiliarity);
        }
      }
    } else { 
      safeSetState(setShowCorrectAnswer, true);
      toast({ title: "Incorrect", description: `The correct answer was: "${currentQuestion.correctAnswer}"`, variant: "destructive" });
      if (targetWordObject) {
        let newFamiliarity: FamiliarityLevel = targetWordObject.familiarity;
        if (targetWordObject.familiarity === 'Mastered') newFamiliarity = 'Familiar';
        else if (targetWordObject.familiarity === 'Familiar') newFamiliarity = 'Learning';
        if (newFamiliarity !== targetWordObject.familiarity) {
            debugLog("handleSubmit (Incorrect): Updating familiarity for", targetWordObject.text, "from", targetWordObject.familiarity, "to", newFamiliarity);
            updateWordFamiliarity(targetWordObject.id, newFamiliarity);
        }
      }
    }
    
    if(isMounted.current) safeSetState(setShowDetails, true);
    if ((!wordDetails || wordDetails.word !== currentQuestion.targetWord) && isMounted.current) {
        safeSetState(setIsLoadingDetails, true); 
        if (wordDetailsAbortController.current) wordDetailsAbortController.current.abort("New submission, fetching details if needed.");
        wordDetailsAbortController.current = new AbortController();
        const d = await fetchDetailsWithCache(currentQuestion.targetWord, wordDetailsAbortController.current!, setIsLoadingDetails);
        safeSetState(setWordDetails, d);
    } else if (isMounted.current) {
        safeSetState(setIsLoadingDetails, false); 
    }

  }, [currentQuestion, isCorrect, userInput, allLibraryWords, updateWordFamiliarity, toast, attempts, hintUsedThisTurn, wordDetails, fetchDetailsWithCache, debugLog, safeSetState]);

  const revealHint = useCallback(() => {
    debugLog("revealHint: Start. currentQuestion:", currentQuestion?.targetWord, "userInput:", userInput);
    if (!currentQuestion || !currentQuestion.correctAnswer || hintRevealedThisQuestion || isCorrect !== null) return;

    let firstDiffIndex = -1;
    for (let i = 0; i < currentQuestion.correctAnswer.length; i++) {
        if (i >= userInput.length || userInput[i].toLowerCase() !== currentQuestion.correctAnswer[i].toLowerCase()) {
            firstDiffIndex = i;
            break;
        }
    }

    if (firstDiffIndex === -1 && userInput.length === currentQuestion.correctAnswer.length) { 
        return;
    }
    
    const revealUpToIndex = firstDiffIndex === -1 ? userInput.length + 1 : firstDiffIndex + 1;
    if (revealUpToIndex > currentQuestion.correctAnswer.length) {
      debugLog("revealHint: Cannot reveal beyond correct answer length.");
      return;
    }
    const revealedPortion = currentQuestion.correctAnswer.substring(0, revealUpToIndex);
    
    safeSetState(setUserInput, revealedPortion);
    safeSetState(setHintRevealedThisQuestion, true);
    safeSetState(setHintUsedThisTurn, true);
    
    debugLog("revealHint: Revealed up to index", revealUpToIndex -1 , ". New input:", revealedPortion);
    toast({ title: "Hint Revealed", description: `Input updated to "${revealedPortion}"`, className: "bg-blue-500 text-white" });
    
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
      setTimeout(() => hiddenInputRef.current?.setSelectionRange(revealedPortion.length, revealedPortion.length), 0);
    }
  }, [currentQuestion, userInput, hintRevealedThisQuestion, isCorrect, toast, debugLog, safeSetState]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCorrect !== null) return; 
    const value = e.target.value;
    // Allow input only up to the length of the correct answer
    if (currentQuestion && value.length <= currentQuestion.correctAnswer.length) {
      safeSetState(setUserInput, value);
    } else if (currentQuestion && value.length > currentQuestion.correctAnswer.length) {
      // If user tries to type beyond, keep input at max length
      safeSetState(setUserInput, value.substring(0, currentQuestion.correctAnswer.length));
    }
  };

  const renderCharacterSpans = useCallback(() => {
    if (!currentQuestion || !currentQuestion.correctAnswer) return null;
  
    const correctAnswerChars = currentQuestion.correctAnswer.split('');
    const displaySpans = [];
    let isInputCurrentlyCorrectPrefix = true;

    if (userInput.length > 0 && !showCorrectAnswer) {
        isInputCurrentlyCorrectPrefix = currentQuestion.correctAnswer.toLowerCase().startsWith(userInput.toLowerCase());
    }
  
    for (let i = 0; i < correctAnswerChars.length; i++) {
      const typedChar = userInput[i];
      let charToDisplay = '_';
      let charColor = 'text-foreground';
      let borderColor = 'border-muted-foreground';
  
      if (showCorrectAnswer) { // After submission (correct or incorrect)
        charToDisplay = correctAnswerChars[i];
        if (isCorrect) { // If the whole answer was correct
            charColor = 'text-green-500 dark:text-green-400';
            borderColor = 'border-green-500 dark:border-green-400';
        } else { // If submission was incorrect
            if (typedChar?.toLowerCase() === correctAnswerChars[i].toLowerCase()) {
              charColor = 'text-green-500 dark:text-green-400'; // User got this specific char right
              borderColor = 'border-green-500 dark:border-green-400';
            } else if (typedChar) { // User typed something here, and it was wrong
              charColor = 'text-red-500 dark:text-red-400'; // Show what user typed, in red
              charToDisplay = typedChar; // Show user's incorrect char
              borderColor = 'border-red-500 dark:border-red-400';
            } else { // User didn't type this far, show correct char
              charColor = 'text-orange-500 dark:text-orange-400'; // Correct char that user missed
              borderColor = 'border-orange-500 dark:border-orange-400';
            }
        }
      } else if (typedChar) { // While typing, before submission
        charToDisplay = typedChar; // Show what user typed
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
          <li>isLoadingDetails: {isLoadingDetails.toString()}</li>
          <li>isLoadingNextDetails: {isLoadingNextDetails.toString()}</li>
          <li>CurrentQ: {currentQuestion ? `${currentQuestion.targetWord} (${currentQuestion.correctAnswer})` : 'null'}</li>
          <li>NextQ: {nextQuestion ? `${nextQuestion.targetWord} (${nextQuestion.correctAnswer})` : 'null'}</li>
          <li>CurrentDetails: {wordDetails ? wordDetails.word : 'null'}</li>
          <li>NextDetails: {nextWordDetails ? nextWordDetails.word : 'null'}</li>
          <li>aiFailureCount: {aiFailureCount}</li>
          <li>Available Words: {libraryWords.length}</li>
        </ul>
        <div className="mt-2">
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={() => {
              debugLog("Force Reset button clicked");
              resetGame();
              setTimeout(initializeGame, 100); // Slight delay before re-initializing
            }}
          >
            Force Reset Game
          </Button>
        </div>
      </div>
    );
  }, [hasEnoughWords, gameInitialized, isLoadingCurrentQuestion, isLoadingNextQuestion, isLoadingDetails, isLoadingNextDetails, currentQuestion, nextQuestion, wordDetails, nextWordDetails, aiFailureCount, libraryWords, resetGame, initializeGame, debugLog]);


  if (vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading vocabulary...</span></div>;
  }

  if (!hasEnoughWords && !vocabLoading && !gameInitialized) { // Show only if vocab loaded and determined no words
    return (
      <Alert variant="default" className="border-primary max-w-md mx-auto">
        <Lightbulb className="h-5 w-5 text-primary" />
        <AlertTitle>Not Enough Words</AlertTitle>
        <AlertDescription>You need at least one word marked as "Familiar" or "Mastered" in your library to play this game. Please add or update words in the Library tab.</AlertDescription>
        <Button onClick={onStopGame} variant="outline" className="mt-4">Back to Games Menu</Button>
      </Alert>
    );
  }
  
  if (showAiFailureAlert) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Info className="h-5 w-5" />
        <AlertTitle>AI Service Issue</AlertTitle>
        <AlertDescription>
          There seems to be an issue generating questions/details from the AI. Please try resetting or check back later.
        </AlertDescription>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => { 
            debugLog("Try Again from AI Failure Alert");
            safeSetState(setShowAiFailureAlert, false); 
            resetGame();
            setTimeout(initializeGame, 100);
          }} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
          <Button onClick={onStopGame} variant="secondary">
            Stop Game
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">Text Input Challenge</CardTitle>
            {(isLoadingNextQuestion || isLoadingNextDetails) && isCorrect === null && !isLoadingTransition.current && (
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
              <p className="text-xl md:text-2xl text-center p-4 sm:p-6 bg-muted rounded-lg shadow-inner min-h-[80px] sm:min-h-[100px] flex items-center justify-center">
                {currentQuestion.sentenceWithBlank.replace(/___/g, " ______ ")}
              </p>
              <p className="text-sm text-center text-muted-foreground italic px-2 py-1 bg-secondary/30 rounded-md">
                Hint: {currentQuestion.translatedHint}
              </p>
              
              <input
                ref={hiddenInputRef}
                type="text"
                value={userInput}
                onChange={handleHiddenInputChange}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && isCorrect === null && userInput.trim().length > 0) {
                        e.preventDefault(); 
                        handleSubmit();
                    }
                }}
                className="opacity-0 absolute w-0 h-0 pointer-events-none"
                aria-label="Type the missing word here"
                maxLength={currentQuestion.correctAnswer.length + 5} // Allow slight overtyping
                disabled={isCorrect !== null}
                autoFocus
              />
              
              {renderCharacterSpans()}
              
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
                  disabled={hintRevealedThisQuestion || isCorrect !== null}
                  className="w-full sm:w-auto"
                >
                  <KeyRound className="mr-2 h-4 w-4" /> 
                  Reveal Hint (1 use)
                </Button>
              </div>
            </>
          )}
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && !isLoadingTransition.current && gameInitialized && (
             <Alert variant="default">
              <Info className="h-5 w-5" />
              <AlertTitle>No Question Available</AlertTitle>
              <AlertDescription>
                Could not load a question. You might need more 'Familiar' or 'Mastered' words, or there was an AI issue.
              </AlertDescription>
              <Button 
                onClick={() => {
                  debugLog("Try Again button clicked from No Question Available alert");
                  resetGame();
                  setTimeout(initializeGame,100);
                }}
                className="mt-3" 
                disabled={isLoadingTransition.current || isLoadingCurrentQuestion}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4">
          <Button onClick={onStopGame} variant="outline" size="lg" className="w-full sm:w-auto">
            <StopCircle className="mr-2 h-5 w-5" /> Stop Game
          </Button>

          {isCorrect === null && currentQuestion && (
            <Button 
              onClick={handleSubmit} 
              disabled={userInput.trim().length === 0} 
              size="lg" 
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-5 w-5" /> Submit Answer
            </Button>
          )}

          {isCorrect !== null && ( 
            <Button 
              onClick={handleNextQuestion} 
              className="w-full sm:w-auto" 
              size="lg" 
              variant="default"
              disabled={isLoadingTransition.current || isLoadingNextQuestion || isLoadingNextDetails || isLoadingCurrentQuestion}
            >
              {(isLoadingTransition.current || isLoadingNextQuestion || isLoadingNextDetails || isLoadingCurrentQuestion) ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-5" />
              )}
              Next Question
            </Button>
          )}
        </CardFooter>
      </Card>

      {showDetails && currentQuestion && (
        <WordDetailPanel 
          word={currentQuestion.targetWord} 
          generatedDetails={wordDetails} 
          isLoading={isLoadingDetails} 
        />
      )}
      {DEBUG && renderDebugInfo()}
    </div>
  );
});

TextInputGame.displayName = 'TextInputGame';
export default TextInputGame;
