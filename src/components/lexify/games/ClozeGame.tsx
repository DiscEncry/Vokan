
"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, Sparkles, Volume2 } from 'lucide-react';
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, ClozeQuestion as ClozeQuestionType, GeneratedWordDetails } from '@/types';
import { generateClozeQuestion } from '@/ai/flows/generate-cloze-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


interface ClozeGameProps {
  onStopGame: () => void;
}

const DEBUG = true; // Set to false in production
const debugLog = (...args: any[]) => {
  if (DEBUG) console.log("[ClozeGame]", ...args);
};

const ClozeGame: FC<ClozeGameProps> = ({ onStopGame }) => {
  const { words: libraryWords, updateWordFamiliarity, getDecoyWords, isLoading: vocabLoading } = useVocabulary();
  const { toast } = useToast();

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<ClozeQuestionType | null>(null);
  const [nextQuestion, setNextQuestion] = useState<ClozeQuestionType | null>(null);
  
  // Game state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attemptedAnswers, setAttemptedAnswers] = useState<string[]>([]);
  const [activeOptionIndex, setActiveOptionIndex] = useState<number>(-1); // For keyboard navigation
  
  // Option buttons refs for focus management
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Loading states
  const [isLoadingCurrentQuestion, setIsLoadingCurrentQuestion] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingNextDetails, setIsLoadingNextDetails] = useState(false);
  
  // Word details state
  const [wordDetails, setWordDetails] = useState<GeneratedWordDetails | null>(null);
  const [nextWordDetails, setNextWordDetails] = useState<GeneratedWordDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Request cancellation refs
  const isMounted = useRef(true);
  const currentQuestionAbortController = useRef<AbortController | null>(null);
  const nextQuestionAbortController = useRef<AbortController | null>(null);
  const wordDetailsAbortController = useRef<AbortController | null>(null);
  const nextWordDetailsAbortController = useRef<AbortController | null>(null);

  // Game flow control
  const isLoadingTransition = useRef(false); // Prevents re-entry into main loading functions
  const [gameInitialized, setGameInitialized] = useState(false);
  const [aiFailureCount, setAiFailureCount] = useState(0);
  const [showAiFailureAlert, setShowAiFailureAlert] = useState(false);

  // Client-side cache for word details to reduce API calls within a session
  const wordDetailsCache = useRef<Map<string, GeneratedWordDetails>>(new Map());

  const hasEnoughWords = libraryWords.length >= 4;

  useEffect(() => {
    isMounted.current = true;
    debugLog("Component mounted");
    
    return () => { 
      isMounted.current = false; 
      debugLog("Component unmounting, aborting pending requests...");
      currentQuestionAbortController.current?.abort("ClozeGame unmounting (current question)");
      nextQuestionAbortController.current?.abort("ClozeGame unmounting (next question)");
      wordDetailsAbortController.current?.abort("ClozeGame unmounting (current details)");
      nextWordDetailsAbortController.current?.abort("ClozeGame unmounting (next details)");
      debugLog("Component unmounted");
    };
  }, []);

  useEffect(() => {
    if (aiFailureCount >= 3) {
      if (isMounted.current) setShowAiFailureAlert(true);
    } else {
      if (isMounted.current) setShowAiFailureAlert(false);
    }
  }, [aiFailureCount]);

  const resetQuestionState = useCallback(() => {
    debugLog("Resetting question state");
    if (!isMounted.current) return;
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowDetails(false);
    setAttemptedAnswers([]);
    setActiveOptionIndex(-1);
    optionButtonsRef.current = [];
  }, []);

  const selectTargetWord = useCallback((excludeWordId?: string): Word | null => {
    debugLog(`selectTargetWord called. excludeWordId: ${excludeWordId}, currentQuestion target: ${currentQuestion?.targetWord}`);
    if (!hasEnoughWords) {
      debugLog("selectTargetWord: Not enough words in library.");
      return null;
    }
    
    let eligibleWords = libraryWords;
    debugLog(`Initial eligible words count: ${eligibleWords.length}`);

    if (excludeWordId) {
      eligibleWords = eligibleWords.filter(w => w.id !== excludeWordId);
      debugLog(`After excluding ID '${excludeWordId}', eligible words count: ${eligibleWords.length}`);
    }
    
    if (currentQuestion?.targetWord) {
        const currentTargetWordObj = libraryWords.find(w => w.text === currentQuestion.targetWord);
        if (currentTargetWordObj) {
            eligibleWords = eligibleWords.filter(w => w.id !== currentTargetWordObj.id);
            debugLog(`After excluding current target word '${currentQuestion.targetWord}', eligible words count: ${eligibleWords.length}`);
        }
    }
    
    if (eligibleWords.length === 0) {
        debugLog("selectTargetWord: No eligible words after filtering. Falling back to any word if library has words.");
        const fallbackWords = excludeWordId ? libraryWords.filter(w => w.id !== excludeWordId) : libraryWords;
        if (fallbackWords.length > 0) {
            const randomFallback = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
            debugLog(`Selected fallback word: ${randomFallback.text}`);
            return randomFallback;
        }
        debugLog("selectTargetWord: No words found even in fallback.");
        return null;
    }

    const learningWords = eligibleWords.filter(w => w.familiarity === 'New' || w.familiarity === 'Learning');
    debugLog(`Learning words count (New or Learning): ${learningWords.length}`);
    
    if (learningWords.length > 0) {
      const selected = learningWords[Math.floor(Math.random() * learningWords.length)];
      debugLog(`Selected from learning words: ${selected.text}`);
      return selected;
    }
    
    const selectedFromAllEligible = eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
    debugLog(`No learning words, selected from all eligible: ${selectedFromAllEligible.text}`);
    return selectedFromAllEligible;
  }, [libraryWords, currentQuestion, hasEnoughWords]);


  const localGenerateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<ClozeQuestionType | null> => {
    debugLog(`localGenerateSingleQuestion for word: "${targetWord.text}"`);
    if (!targetWord) {
      debugLog("localGenerateSingleQuestion: No target word provided.");
      return null;
    }

    const decoys = getDecoyWords(targetWord.id, 3);
    if (decoys.length < 3) {
      if (isMounted.current) {
        toast({ 
          title: "Not enough decoy words", 
          description: `Need at least 3 decoys for "${targetWord.text}", found ${decoys.length}. Add more words.`, 
          variant: "destructive"
        });
      }
      debugLog(`localGenerateSingleQuestion: Not enough decoys for "${targetWord.text}". Found: ${decoys.length}`);
      return null;
    }
    
    const decoyTexts = decoys.map(d => d.text);
    const aiInput = { word: targetWord.text, libraryWords: decoyTexts };
    debugLog("Calling generateClozeQuestion with AI Input:", aiInput);

    try {
      const clozeData = await generateClozeQuestion(aiInput, { signal: abortController.signal });
      debugLog("generateClozeQuestion API response:", clozeData);
      
      if (!isMounted.current || abortController.signal.aborted) {
        debugLog("localGenerateSingleQuestion: Component unmounted or request aborted after API call.");
        return null;
      }
      
      if (!clozeData) {
        if (isMounted.current) {
          debugLog(`AI returned null for cloze question: ${targetWord.text}`);
          setAiFailureCount(prev => prev + 1);
        }
        return null;
      }
      if(isMounted.current) setAiFailureCount(0);

      let options = [...clozeData.options];
      if (!options.includes(targetWord.text)) {
        options[Math.floor(Math.random() * options.length)] = targetWord.text;
      }
      
      const shuffledOptions = options.sort(() => 0.5 - Math.random()).slice(0, 4);
      if (!shuffledOptions.includes(targetWord.text)) {
        shuffledOptions[Math.floor(Math.random() * 4)] = targetWord.text; 
      }
      
      const finalOptionsSet = new Set(shuffledOptions);
      let finalOptions = Array.from(finalOptionsSet);

      const libraryWordTexts = libraryWords.map(w => w.text);
      let attemptFill = 0;
      while(finalOptions.length < 4 && attemptFill < 10 && libraryWordTexts.length > finalOptions.length) {
        const randomWordFromLib = libraryWordTexts[Math.floor(Math.random() * libraryWordTexts.length)];
        if (!finalOptions.includes(randomWordFromLib) && randomWordFromLib !== targetWord.text) {
          finalOptions.push(randomWordFromLib);
        }
        attemptFill++;
      }
      finalOptions = finalOptions.slice(0, 4); 
      finalOptions.sort(() => 0.5 - Math.random());


      debugLog(`Generated question for "${targetWord.text}": Sentence: "${clozeData.sentence}", Options: ${finalOptions.join(', ')}`);
      return {
        sentenceWithBlank: clozeData.sentence,
        options: finalOptions,
        correctAnswer: targetWord.text,
        targetWord: targetWord.text,
      };
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        console.error("[ClozeGame] Error generating cloze question:", error);
        toast({ title: "AI Error", description: "Could not generate a question. Please try again.", variant: "destructive" });
        setAiFailureCount(prev => prev + 1);
      } else if (error instanceof Error && error.name === 'AbortError') {
        debugLog("localGenerateSingleQuestion: Aborted.");
      }
      return null;
    }
  }, [getDecoyWords, toast, libraryWords]);

  const fetchDetailsWithCache = useCallback(async (wordText: string, abortController: AbortController, setLoadingStateAction: React.Dispatch<React.SetStateAction<boolean>>): Promise<GeneratedWordDetails | null> => {
    const normalizedWordText = wordText.toLowerCase();
    debugLog(`fetchDetailsWithCache for word: "${wordText}" (normalized: "${normalizedWordText}")`);

    if (wordDetailsCache.current.has(normalizedWordText)) {
      const cached = wordDetailsCache.current.get(normalizedWordText)!;
      if (!cached.details.startsWith("Unable to retrieve full details")) {
          debugLog(`Cache HIT for "${normalizedWordText}". Returning cached details.`);
          return cached;
      }
      debugLog(`Cache contained fallback for "${normalizedWordText}", will re-fetch.`);
    } else {
      debugLog(`Cache MISS for "${normalizedWordText}".`);
    }
    
    if (!isMounted.current) return null;
    setLoadingStateAction(true);
    
    try {
      debugLog(`Calling generateWordDetails API for "${wordText}"`);
      const detailsData = await generateWordDetails({ word: wordText }, { signal: abortController.signal });
      debugLog(`generateWordDetails API response for "${wordText}":`, detailsData);

      if (!isMounted.current || abortController.signal.aborted) {
        debugLog("fetchDetailsWithCache: Component unmounted or request aborted after API call.");
        return null;
      }

      if (detailsData && detailsData.details && !detailsData.details.startsWith("Unable to retrieve full details")) {
        wordDetailsCache.current.set(normalizedWordText, detailsData);
        debugLog(`Successfully fetched and cached details for "${normalizedWordText}".`);
      } else if (detailsData) {
        debugLog(`Fetched details for "${normalizedWordText}" seem to be a fallback or error, not caching substantively.`);
      } else {
         debugLog(`AI returned null for word details: ${wordText}`);
         if (isMounted.current) setAiFailureCount(prev => prev + 1);
      }
      return detailsData;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        console.error(`[ClozeGame] Error fetching word details for "${wordText}":`, error);
        toast({ title: "AI Error", description: `Could not fetch word details for ${wordText}.`, variant: "destructive" });
        if (isMounted.current) setAiFailureCount(prev => prev + 1);
      } else if (error instanceof Error && error.name === 'AbortError') {
        debugLog(`fetchDetailsWithCache for "${wordText}": Aborted.`);
      }
      return { word: wordText, details: `Unable to retrieve full details for "${wordText}" at this time due to an error.` };
    } finally {
      if (isMounted.current) setLoadingStateAction(false);
    }
  }, [toast]);

  const handleAnswerSubmit = useCallback(async (answer: string) => {
    debugLog(`handleAnswerSubmit called with answer: "${answer}"`);
    if (!currentQuestion || isCorrect || !isMounted.current) {
      debugLog("handleAnswerSubmit: Pre-conditions not met.", { currentQuestion: Boolean(currentQuestion), isCorrect, isMounted: isMounted.current });
      return;
    }

    if(isMounted.current) setSelectedAnswer(answer);
    if(isMounted.current) setAttemptedAnswers(prev => [...prev, answer]);
    
    const correct = answer === currentQuestion.correctAnswer;
    if(isMounted.current) setIsCorrect(correct);

    if (correct) {
      debugLog(`Answer "${answer}" is CORRECT.`);
      if(isMounted.current) toast({ title: "Correct!", description: `"${answer}" is the right word.`, className: "bg-green-500 text-white" });
      
      const targetWordObject = libraryWords.find(w => w.text === currentQuestion.targetWord);
      if (targetWordObject) {
        const familiarity = attemptedAnswers.length === 0 ? 'Familiar' : 'Learning'; 
        debugLog(`Updating familiarity for "${targetWordObject.text}" to "${familiarity}". Previous attempts: ${attemptedAnswers.length}`);
        updateWordFamiliarity(targetWordObject.id, familiarity);
      }

      if(isMounted.current) setShowDetails(true);
      
      if (!wordDetails || wordDetails.word !== currentQuestion.targetWord) {
        debugLog(`Details for "${currentQuestion.targetWord}" not pre-loaded or mismatched. Fetching now.`);
        if(isMounted.current) setIsLoadingDetails(true);
        wordDetailsAbortController.current?.abort("New details needed for current correct answer");
        wordDetailsAbortController.current = new AbortController();
        const d = await fetchDetailsWithCache(currentQuestion.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
        if (isMounted.current) setWordDetails(d);
      } else {
         debugLog(`Details for "${currentQuestion.targetWord}" were already available (pre-fetched or cached).`);
         if(isMounted.current) setIsLoadingDetails(false); 
      }

    } else {
      debugLog(`Answer "${answer}" is INCORRECT.`);
      if(isMounted.current) {
        toast({ title: "Incorrect", description: `"${answer}" is not the right word. Try again!`, variant: "destructive" });
      }
    }
  }, [currentQuestion, isCorrect, toast, libraryWords, updateWordFamiliarity, attemptedAnswers, wordDetails, fetchDetailsWithCache]);
  
  const fetchAndStoreNextQuestionAndDetails = useCallback(async () => {
    debugLog("fetchAndStoreNextQuestionAndDetails called.");
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingTransition.current || isLoadingNextQuestion || isLoadingNextDetails) {
      debugLog("fetchAndStoreNextQuestionAndDetails: Pre-conditions not met or already loading.", { vocabLoading, hasEnoughWords, isMounted: isMounted.current, isLoadingTransition: isLoadingTransition.current, isLoadingNextQuestion, isLoadingNextDetails });
      return;
    }

    if (!isMounted.current) return;
    setIsLoadingNextQuestion(true);
    setIsLoadingNextDetails(true); 
    setNextQuestion(null); 
    setNextWordDetails(null); 

    nextQuestionAbortController.current?.abort("New next question requested (fetchAndStoreNextQ)");
    nextQuestionAbortController.current = new AbortController();
    nextWordDetailsAbortController.current?.abort("New next details requested (fetchAndStoreNextD)");
    nextWordDetailsAbortController.current = new AbortController();
    
    const currentTargetWordId = currentQuestion ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined;
    const nextTargetWordObj = selectTargetWord(currentTargetWordId);
    
    if (!nextTargetWordObj) {
      if (hasEnoughWords && isMounted.current) {
        toast({ title: "No suitable next word", description: "Could not find a different word for the next question.", variant: "default" });
      }
      debugLog("fetchAndStoreNextQuestionAndDetails: No next target word found.");
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
        setIsLoadingNextDetails(false);
      }
      return;
    }
    debugLog(`Selected next target word: ${nextTargetWordObj.text}`);

    try {
      const question = await localGenerateSingleQuestion(nextTargetWordObj, nextQuestionAbortController.current);
      if (isMounted.current && question) {
        setNextQuestion(question);
        const details = await fetchDetailsWithCache(question.targetWord, nextWordDetailsAbortController.current, setIsLoadingNextDetails);
        if (isMounted.current) setNextWordDetails(details);
      } else if (isMounted.current) {
        debugLog("fetchAndStoreNextQuestionAndDetails: Next question generation failed or component unmounted.");
        setNextQuestion(null); 
        setNextWordDetails(null);
        setIsLoadingNextDetails(false); 
      }
    } catch (error) {
      debugLog("fetchAndStoreNextQuestionAndDetails: Error during processing", error);
       if(isMounted.current) {
          setNextQuestion(null);
          setNextWordDetails(null);
          setIsLoadingNextDetails(false);
       }
    } finally {
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
      }
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, currentQuestion, libraryWords, localGenerateSingleQuestion, fetchDetailsWithCache, toast, isLoadingNextQuestion, isLoadingNextDetails]);

  const loadCurrentAndPrepareNext = useCallback(async () => {
    debugLog("loadCurrentAndPrepareNext called.");
    if (isLoadingTransition.current || !isMounted.current) {
      debugLog("loadCurrentAndPrepareNext: Transition in progress or component unmounted, exiting.");
      return;
    }
    if (vocabLoading) {
      debugLog("loadCurrentAndPrepareNext: Vocab still loading, exiting.");
      return;
    }
    if (!hasEnoughWords) {
      debugLog("loadCurrentAndPrepareNext: Not enough words, exiting.");
       if (isMounted.current) {
        setIsLoadingCurrentQuestion(false); 
        setCurrentQuestion(null);
      }
      return;
    }

    isLoadingTransition.current = true;
    debugLog("loadCurrentAndPrepareNext: State Debug (before loading):", { isLoadingCurrentQuestion, currentQuestion: Boolean(currentQuestion), nextQuestion: Boolean(nextQuestion), isLoadingTransition: isLoadingTransition.current });
    
    resetQuestionState();
    if(isMounted.current) setIsLoadingCurrentQuestion(true);
    if(isMounted.current) setWordDetails(null); 

    currentQuestionAbortController.current?.abort("New current question requested (loadCurrent)");
    currentQuestionAbortController.current = new AbortController();
    wordDetailsAbortController.current?.abort("New current details requested (loadCurrent)");
    wordDetailsAbortController.current = new AbortController();

    try {
      if (nextQuestion) {
        debugLog(`Using pre-fetched nextQuestion: "${nextQuestion.targetWord}"`);
        if(isMounted.current) setCurrentQuestion(nextQuestion);
        if(isMounted.current) setWordDetails(nextWordDetails); 
        
        if (isMounted.current) setIsLoadingCurrentQuestion(false); 
        
        if (nextWordDetails || wordDetailsCache.current.has(nextQuestion.targetWord.toLowerCase())) {
            if(isMounted.current) setIsLoadingDetails(false); 
        } else {
            if(isMounted.current) setIsLoadingDetails(true);
            const d = await fetchDetailsWithCache(nextQuestion.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
            if(isMounted.current) setWordDetails(d);
        }

        if(isMounted.current) setNextQuestion(null); 
        if(isMounted.current) setNextWordDetails(null);
        
        await fetchAndStoreNextQuestionAndDetails();

      } else {
        debugLog("No pre-fetched nextQuestion. Generating initial/current question.");
        const initialTargetWord = selectTargetWord();
        if (!initialTargetWord) {
          if(isMounted.current) toast({ title: "No words available", description: "Could not select a word to start.", variant: "destructive" });
          debugLog("loadCurrentAndPrepareNext: No initial target word found.");
          if(isMounted.current) {
             setCurrentQuestion(null);
             setIsLoadingCurrentQuestion(false);
          }
          isLoadingTransition.current = false;
          return;
        }
        debugLog(`Initial target word: ${initialTargetWord.text}`);
        const question = await localGenerateSingleQuestion(initialTargetWord, currentQuestionAbortController.current);
        
        if (isMounted.current) {
          setCurrentQuestion(question);
          if (question) {
            const details = await fetchDetailsWithCache(question.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
            if(isMounted.current) setWordDetails(details);
            await fetchAndStoreNextQuestionAndDetails();
          } else {
             debugLog("Failed to generate initial question.");
             if(isMounted.current) {
                toast({ title: "Game Over?", description: "Could not load a new question.", variant: "destructive" });
                setCurrentQuestion(null); 
             }
          }
        }
      }
    } catch (error) {
        debugLog("Error in loadCurrentAndPrepareNext:", error);
        if(isMounted.current) {
            console.error("[ClozeGame] Critical error in loadCurrentAndPrepareNext:", error);
            toast({ title: "Error", description: "An unexpected error occurred while loading the question.", variant: "destructive" });
            setCurrentQuestion(null);
        }
    } finally {
      if (isMounted.current) setIsLoadingCurrentQuestion(false);
      isLoadingTransition.current = false;
      debugLog("loadCurrentAndPrepareNext: Transition finished.");
    }
  }, [
    vocabLoading, hasEnoughWords, resetQuestionState, nextQuestion, nextWordDetails, 
    selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, 
    fetchAndStoreNextQuestionAndDetails, toast
  ]);

  const initializeGame = useCallback(async () => {
    debugLog("initializeGame called.");
    if (isLoadingTransition.current || !isMounted.current || vocabLoading || !hasEnoughWords || gameInitialized) {
      debugLog("initializeGame: Pre-conditions not met or already initialized.", { isLoadingTransition: isLoadingTransition.current, isMounted: isMounted.current, vocabLoading, hasEnoughWords, gameInitialized });
      if (!hasEnoughWords && !vocabLoading && isMounted.current) setIsLoadingCurrentQuestion(false); 
      return;
    }
    debugLog("initializeGame: State Debug (before loading):", { isLoadingCurrentQuestion, currentQuestion: Boolean(currentQuestion), nextQuestion: Boolean(nextQuestion), isLoadingTransition: isLoadingTransition.current });
    
    await loadCurrentAndPrepareNext(); 
    
    if(isMounted.current) setGameInitialized(true);
    debugLog("Game initialized.");

  }, [vocabLoading, hasEnoughWords, gameInitialized, loadCurrentAndPrepareNext]);

  useEffect(() => {
    if (!vocabLoading && hasEnoughWords && !gameInitialized) {
      debugLog("useEffect: Vocab loaded, has enough words, game not initialized. Initializing game.");
      initializeGame();
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, initializeGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMounted.current || showAiFailureAlert || isLoadingCurrentQuestion || !currentQuestion || isCorrect) {
        if (isCorrect && (e.key === ' ' || e.key === 'Enter') && !isLoadingNextQuestion && !isLoadingTransition.current && !isLoadingCurrentQuestion) {
          e.preventDefault();
          debugLog("Keyboard: Next Question (Space/Enter)");
          loadCurrentAndPrepareNext();
        }
        return;
      }
      
      if (e.key === ' ') e.preventDefault(); 

      const optionsCount = currentQuestion.options.length;

      if (e.key >= '1' && e.key <= '4') {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < optionsCount) {
          const option = currentQuestion.options[index];
          const isAttemptedIncorrect = attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer;
          if (!isAttemptedIncorrect) {
            debugLog(`Keyboard: Selecting option ${index + 1} ("${option}") with number key.`);
            handleAnswerSubmit(option);
          }
        }
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let newIndex = activeOptionIndex;
        if (activeOptionIndex === -1) { // No option currently focused, start at first available
            newIndex = currentQuestion.options.findIndex(opt => !(attemptedAnswers.includes(opt) && opt !== currentQuestion.correctAnswer));
            if (newIndex === -1) return; // All options attempted/disabled
        } else {
            const navigableOptions = currentQuestion.options.map((opt, idx) => ({opt, idx, disabled: attemptedAnswers.includes(opt) && opt !== currentQuestion.correctAnswer}));
            let currentMappedIndex = navigableOptions.filter(o => !o.disabled).findIndex(o => o.idx === activeOptionIndex);
            if(currentMappedIndex === -1) { // focused option became disabled
                newIndex = navigableOptions.filter(o => !o.disabled)[0]?.idx ?? -1;
            } else {
                const enabledOptions = navigableOptions.filter(o => !o.disabled);
                if (enabledOptions.length === 0) return;

                if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') newIndex = enabledOptions[(currentMappedIndex - 1 + enabledOptions.length) % enabledOptions.length].idx;
                else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') newIndex = enabledOptions[(currentMappedIndex + 1) % enabledOptions.length].idx;
            }
        }
        
        if (isMounted.current) setActiveOptionIndex(newIndex);
        optionButtonsRef.current[newIndex]?.focus(); 
        debugLog(`Keyboard: Navigated to option index ${newIndex}`);
        return;
      }

      if (e.key === 'Enter' && activeOptionIndex >= 0 && activeOptionIndex < optionsCount) {
        const option = currentQuestion.options[activeOptionIndex];
        const isAttemptedIncorrect = attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer;
        if (!isAttemptedIncorrect) {
          debugLog(`Keyboard: Selecting focused option ${activeOptionIndex} ("${option}") with Enter.`);
          handleAnswerSubmit(option);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentQuestion, isCorrect, activeOptionIndex, attemptedAnswers, isLoadingCurrentQuestion, showAiFailureAlert, handleAnswerSubmit, loadCurrentAndPrepareNext, isLoadingNextQuestion]);


  if (vocabLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
        <span className="ml-2">Loading vocabulary...</span>
      </div>
    );
  }

  if (!hasEnoughWords) {
    return (
      <Alert variant="default" className="border-primary max-w-md mx-auto">
        <Lightbulb className="h-5 w-5 text-primary" />
        <AlertTitle>Not Enough Words</AlertTitle>
        <AlertDescription>
          You need at least 4 unique words in your library to play the Multiple Choice game. 
          Please add more words in the Library tab.
        </AlertDescription>
        <Button onClick={onStopGame} variant="outline" className="mt-4">
          Back to Games Menu
        </Button>
      </Alert>
    );
  }

  if (showAiFailureAlert) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Info className="h-5 w-5" />
        <AlertTitle>AI Service Issue</AlertTitle>
        <AlertDescription>
          There seems to be an issue generating questions/details from the AI. Please try again later or check your API quota.
        </AlertDescription>
        <div className="mt-4 flex gap-2">
            <Button onClick={() => { setAiFailureCount(0); setShowAiFailureAlert(false); initializeGame();}} variant="outline">
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
            <CardTitle className="text-2xl">Multiple Choice</CardTitle>
            {(isLoadingNextQuestion || isLoadingNextDetails) && !isCorrect && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary mr-1" /> 
                <span>Preparing next...</span>
                 {(isLoadingNextQuestion || isLoadingNextDetails) && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              </div>
            )}
          </div>
          <CardDescription>
            Choose the word that best completes the sentence. 
            Use number keys (1-4) or arrow keys to navigate and Enter to select.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {(isLoadingCurrentQuestion && !currentQuestion) && ( 
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Generating question...</p>
            </div>
          )}
          
          {!isLoadingCurrentQuestion && currentQuestion && (
            <>
              <p className="text-xl md:text-2xl text-center p-6 bg-muted rounded-lg shadow-inner min-h-[100px] flex items-center justify-center">
                {currentQuestion.sentenceWithBlank.replace(/___/g, " ______ ")}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isAttemptedIncorrect = attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer;
                  const isDisabledByGameState = isCorrect || (isAttemptedIncorrect && !isCorrect);
                  const isFocusedByKeyboard = activeOptionIndex === index;
                  
                  let buttonVariant = 'outline'; 
                  if (isSelected) {
                    buttonVariant = isCorrect ? 'default' : 'destructive'; 
                  }
                  
                  return (
                    <Button
                      key={`${currentQuestion.targetWord}-${option}-${index}-${currentQuestion.sentenceWithBlank.length}`} 
                      ref={el => { optionButtonsRef.current[index] = el; }}
                      variant={buttonVariant as any}
                      size="lg"
                      className={cn(`text-base py-5 transition-all duration-200 ease-in-out transform focus:ring-2 focus:ring-offset-2`,
                        isSelected && isCorrect ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white animate-pulse' : '',
                        isSelected && !isCorrect ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white' : '',
                        isAttemptedIncorrect && !isCorrect ? 'opacity-60 line-through cursor-not-allowed' : 'hover:scale-105',
                        isCorrect ? 'hover:scale-100 cursor-default' : '',
                        isFocusedByKeyboard && !isDisabledByGameState ? 'ring-2 ring-primary dark:ring-accent ring-offset-background' : 'focus:ring-primary dark:focus:ring-accent' 
                      )}
                      onClick={() => handleAnswerSubmit(option)}
                      disabled={isDisabledByGameState}
                      aria-label={`Option ${index + 1}: ${option}. ${isAttemptedIncorrect ? "Previously tried and incorrect." : ""}`}
                    >
                      <span className="absolute left-3 top-2 opacity-70 text-xs">{index + 1}</span>
                      {isSelected && isCorrect && <CheckCircle className="mr-2 h-5 w-5" />}
                      {isSelected && !isCorrect && <XCircle className="mr-2 h-5 w-5" />}
                      {option}
                    </Button>
                  );
                })}
              </div>
            </>
          )}
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && ( 
             <Alert variant="default">
              <Info className="h-5 w-5" />
              <AlertTitle>No Question Available</AlertTitle>
              <AlertDescription>
                Could not load a question. You might need more words in your library, or there was an AI issue.
              </AlertDescription>
              <Button onClick={initializeGame} className="mt-3" disabled={isLoadingTransition.current || isLoadingCurrentQuestion}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
            </Alert>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
          <Button onClick={onStopGame} variant="outline" size="lg">
            <StopCircle className="mr-2 h-5 w-5" /> Stop Game
          </Button>
          
          {isCorrect && (
            <Button 
              onClick={loadCurrentAndPrepareNext} 
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
              Next Question (Space/Enter)
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
    </div>
  );
};

export default React.memo(ClozeGame);

