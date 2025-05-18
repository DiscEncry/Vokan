
"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
// Input component is no longer directly used for visible input
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, Sparkles, KeyRound, Send } from 'lucide-react'; // Added KeyRound, Send
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

const DEBUG = process.env.NODE_ENV === 'development';

const debugLog = (...args: any[]) => {
  if (DEBUG) console.log("[TextInputGame]", ...args);
};

const TextInputGame: FC<TextInputGameProps> = React.memo(({ onStopGame }) => {
  const { words: allLibraryWords, updateWordFamiliarity, isLoading: vocabLoading } = useVocabulary();
  const { toast } = useToast();

  const libraryWords = React.useMemo(() => {
    debugLog("Filtering library words. All words count:", allLibraryWords.length);
    const filtered = allLibraryWords.filter(w => w.familiarity === 'Familiar' || w.familiarity === 'Mastered');
    debugLog("Words with 'Familiar' or 'Mastered' familiarity:", filtered.length, filtered.map(w => `${w.text} (${w.familiarity})`));
    return filtered;
  }, [allLibraryWords]);

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
  }, []);

  useEffect(() => {
    // Auto-focus the hidden input when a new question loads and interaction is possible
    if (currentQuestion && !isLoadingCurrentQuestion && isCorrect === null && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [currentQuestion, isLoadingCurrentQuestion, isCorrect]);


  const selectTargetWord = useCallback((excludeWordId?: string): Word | null => {
    debugLog("selectTargetWord called. excludeWordId:", excludeWordId, "Total eligible words:", libraryWords.length);
    if (!hasEnoughWords) {
      debugLog("selectTargetWord: Not enough words.");
      return null;
    }
    
    let eligibleForSelection = [...libraryWords];
    debugLog("Initial eligible words for selection:", eligibleForSelection.map(w => w.text));

    if (excludeWordId) {
      eligibleForSelection = eligibleForSelection.filter(w => w.id !== excludeWordId);
      debugLog("After filtering excludeWordId:", eligibleForSelection.map(w => w.text));
    }
    
    if (currentQuestion?.targetWord) {
        const currentTargetWordObj = libraryWords.find(w => w.text === currentQuestion.targetWord);
        if (currentTargetWordObj) {
            eligibleForSelection = eligibleForSelection.filter(w => w.id !== currentTargetWordObj.id);
            debugLog("After filtering currentQuestion.targetWord:", eligibleForSelection.map(w => w.text));
        }
    }

    if (eligibleForSelection.length === 0) {
      debugLog("No eligible words after filtering, falling back to any word from libraryWords if available.");
      return libraryWords.length > 0 ? libraryWords[Math.floor(Math.random() * libraryWords.length)] : null;
    }
    
    const selected = eligibleForSelection[Math.floor(Math.random() * eligibleForSelection.length)];
    debugLog("Selected word for question:", selected ? selected.text : "None");
    return selected;
  }, [libraryWords, currentQuestion, hasEnoughWords]);

  const localGenerateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<TextInputQuestion | null> => {
    debugLog("localGenerateSingleQuestion for word:", targetWord?.text);
    if (!targetWord) {
      debugLog("localGenerateSingleQuestion: No target word provided.");
      return null;
    }
    try {
      const aiInput = { word: targetWord.text };
      debugLog("Calling generateTextInputQuestion with:", aiInput);
      const questionData = await generateTextInputQuestion(aiInput); 
      debugLog("AI response for text input question:", questionData);
      
      if (!isMounted.current) {
        debugLog("localGenerateSingleQuestion: Component unmounted during generation.");
        return null;
      }
      if (!questionData || !questionData.sentenceWithBlank || !questionData.correctAnswer || !questionData.translatedHint) {
          if (isMounted.current) {
            debugLog("localGenerateSingleQuestion: AI returned null/undefined or incomplete data.", questionData);
            setAiFailureCount(prev => prev + 1);
          }
          return null;
      }
      if (isMounted.current) setAiFailureCount(0); 
      return {
        sentenceWithBlank: questionData.sentenceWithBlank,
        translatedHint: questionData.translatedHint,
        correctAnswer: questionData.targetWord, // AI schema uses targetWord for the blanked word
        targetWord: targetWord.text, // The original word object's text
      };
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        debugLog("Error in localGenerateSingleQuestion:", error);
        toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
        setAiFailureCount(prev => prev + 1);
      } else if (error instanceof Error && error.name === 'AbortError') {
        debugLog("localGenerateSingleQuestion: Aborted.");
      }
      return null;
    }
  }, [toast]);

  const fetchDetailsWithCache = useCallback(async (wordText: string, abortController: AbortController, setLoadingStateAction: React.Dispatch<React.SetStateAction<boolean>>): Promise<GeneratedWordDetails | null> => {
    debugLog("fetchDetailsWithCache for word:", wordText);
    const normalizedWordText = wordText.toLowerCase();
    if (wordDetailsCache.current.has(normalizedWordText)) {
      const cached = wordDetailsCache.current.get(normalizedWordText);
      if (cached && !cached.details.startsWith("Unable to retrieve full details")) {
          debugLog("Returning cached details for:", wordText);
          return cached;
      }
    }
    debugLog("No valid cache for:", wordText, "Fetching from AI.");
    if(isMounted.current) setLoadingStateAction(true);
    try {
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
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        debugLog("Error in fetchDetailsWithCache:", error);
        toast({ title: "AI Error", description: "Could not fetch word details.", variant: "destructive" });
      } else if (error instanceof Error && error.name === 'AbortError') {
        debugLog("fetchDetailsWithCache: Aborted.");
      }
      return { word: wordText, details: `Unable to retrieve full details for "${wordText}" at this time. An error occurred.` };
    } finally {
      if (isMounted.current) setLoadingStateAction(false);
    }
  }, [toast]);

  const fetchAndStoreNextQuestionAndDetails = useCallback(async () => {
    debugLog("fetchAndStoreNextQuestionAndDetails: Start. vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "isLoadingTransition:", isLoadingTransition.current, "isLoadingNextQ:", isLoadingNextQuestion, "isLoadingNextD:", isLoadingNextDetails);
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingTransition.current || isLoadingNextQuestion || isLoadingNextDetails) {
        debugLog("fetchAndStoreNextQuestionAndDetails: Bailing early due to conditions.");
        if (!hasEnoughWords && isMounted.current && gameInitialized) {
            toast({ title: "No More Words", description: `You've reviewed all 'Familiar' or 'Mastered' words. Add more or change familiarity!`, variant: "default" });
        }
        if(isMounted.current) { // Ensure loaders are off if bailing
            setIsLoadingNextQuestion(false);
            setIsLoadingNextDetails(false);
        }
        return;
    }

    if(isMounted.current) {
        setIsLoadingNextQuestion(true);
        setIsLoadingNextDetails(true); 
        setNextQuestion(null);
        setNextWordDetails(null);
    }
    
    nextQuestionAbortController.current?.abort("New next question fetch started");
    nextQuestionAbortController.current = new AbortController();
    nextWordDetailsAbortController.current?.abort("New next details fetch started");
    nextWordDetailsAbortController.current = new AbortController();

    const currentTargetWordId = currentQuestion ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined;
    const nextTargetWordObj = selectTargetWord(currentTargetWordId);
    debugLog("fetchAndStoreNextQuestionAndDetails: Next target word object:", nextTargetWordObj);

    if (!nextTargetWordObj) {
      if (hasEnoughWords && isMounted.current) {
        toast({ title: "No more unique words", description: "You've cycled through all available 'Familiar' or 'Mastered' words for now!", variant: "default" });
      }
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
        setIsLoadingNextDetails(false);
      }
      return;
    }

    try {
      const question = await localGenerateSingleQuestion(nextTargetWordObj, nextQuestionAbortController.current);
      if (isMounted.current && question) {
        setNextQuestion(question); 
        const details = await fetchDetailsWithCache(question.targetWord, nextWordDetailsAbortController.current, setIsLoadingNextDetails);
        if (isMounted.current) {
          setNextWordDetails(details); 
        }
      } else if (isMounted.current) {
         setNextQuestion(null);
         setNextWordDetails(null);
         if(isMounted.current) setIsLoadingNextDetails(false); 
      }
    } catch (error) {
       if(isMounted.current) {
          debugLog("Error in fetchAndStoreNextQuestionAndDetails catch block: ", error);
          setNextQuestion(null);
          setNextWordDetails(null);
          setIsLoadingNextDetails(false);
       }
    } finally {
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
        if(!nextQuestion && !nextWordDetails && !isLoadingNextDetails) { 
            setIsLoadingNextDetails(false);
        }
      }
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, currentQuestion, libraryWords, localGenerateSingleQuestion, fetchDetailsWithCache, toast, isLoadingNextDetails, isLoadingNextQuestion, gameInitialized]);

  const resetQuestionState = useCallback(() => {
    debugLog("resetQuestionState called");
    setUserInput('');
    setIsCorrect(null);
    setHintRevealedThisQuestion(false);
    setHintUsedThisTurn(false);
    setAttempts(0);
    setShowCorrectAnswer(false);
    setShowDetails(false);
    if (hiddenInputRef.current) {
        hiddenInputRef.current.focus();
    }
  }, []);

  const handleNextQuestion = useCallback(async () => {
    debugLog("handleNextQuestion: Start. isLoadingTransition:", isLoadingTransition.current);
    if (isLoadingTransition.current || !isMounted.current) return;
    
    isLoadingTransition.current = true;
    debugLog("handleNextQuestion: Set isLoadingTransition to true.");
    
    if(isMounted.current) {
      resetQuestionState();
      setIsLoadingCurrentQuestion(true);
      setWordDetails(null); 
    }
    
    currentQuestionAbortController.current?.abort("New current question fetch started");
    currentQuestionAbortController.current = new AbortController();
    wordDetailsAbortController.current?.abort("New current details fetch started");
    wordDetailsAbortController.current = new AbortController();

    try {
      debugLog("handleNextQuestion: nextQuestion:", nextQuestion, "nextWordDetails:", nextWordDetails);
      if (nextQuestion && nextQuestion.correctAnswer) { // Ensure nextQuestion is valid
        if(isMounted.current) {
            setCurrentQuestion(nextQuestion);
            setWordDetails(nextWordDetails); 
            setIsLoadingCurrentQuestion(false);
        }
        if (nextWordDetails || (nextQuestion && wordDetailsCache.current.has(nextQuestion.targetWord.toLowerCase()))) {
             if(isMounted.current) setIsLoadingDetails(false); 
        } else if (nextQuestion) { 
            if(isMounted.current) setIsLoadingDetails(true);
            const d = await fetchDetailsWithCache(nextQuestion.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
            if(isMounted.current) setWordDetails(d);
        }
        if(isMounted.current) {
            setNextQuestion(null); 
            setNextWordDetails(null);
        }
        await fetchAndStoreNextQuestionAndDetails();
      } else {
        debugLog("handleNextQuestion: No valid pre-fetched nextQuestion. Generating one now.");
        setIsLoadingNextQuestion(false); // No longer waiting for a "next" one that failed
        setIsLoadingNextDetails(false);

        const targetWordObj = selectTargetWord();
        if (targetWordObj) {
          const q = await localGenerateSingleQuestion(targetWordObj, currentQuestionAbortController.current);
          if (isMounted.current) {
            setCurrentQuestion(q);
            setIsLoadingCurrentQuestion(false);
            if (q && q.correctAnswer) {
              const d = await fetchDetailsWithCache(q.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
              if(isMounted.current) setWordDetails(d);
              await fetchAndStoreNextQuestionAndDetails(); 
            } else {
               if(isMounted.current){
                    debugLog("handleNextQuestion: Failed to generate question on-the-fly.");
                    toast({ title: "Game Over?", description: "Could not load a new question. Add more 'Familiar' or 'Mastered' words or check AI status.", variant: "destructive" });
                    setCurrentQuestion(null); 
               }
            }
          }
        } else {
          if(isMounted.current){
            debugLog("handleNextQuestion: No target word found for on-the-fly generation.");
            setCurrentQuestion(null); 
            toast({ title: "No words left!", description: "You've completed all 'Familiar' or 'Mastered' words.", variant: "default" });
          }
        }
      }
    } catch (error) {
        if(isMounted.current) {
            debugLog("Error in handleNextQuestion catch block:", error);
            setCurrentQuestion(null);
            toast({ title: "Error", description: "An unexpected error occurred while loading the next question.", variant: "destructive" });
        }
    } finally {
      if (isMounted.current) {
        setIsLoadingCurrentQuestion(false); 
        debugLog("handleNextQuestion: Set isLoadingTransition to false in finally.");
      }
      isLoadingTransition.current = false;
    }
  }, [nextQuestion, nextWordDetails, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast, resetQuestionState]);

  const initializeGame = useCallback(async () => {
    debugLog("initializeGame: Start. vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "gameInitialized:", gameInitialized, "isLoadingTransition:", isLoadingTransition.current);
    if (isLoadingTransition.current || !isMounted.current || vocabLoading || !hasEnoughWords || gameInitialized) return;
    
    isLoadingTransition.current = true;
    debugLog("initializeGame: Set isLoadingTransition to true.");
    
    if(isMounted.current) {
      resetQuestionState();
      setIsLoadingCurrentQuestion(true);
      setWordDetails(null);
    }
    
    currentQuestionAbortController.current?.abort("Game initialization started");
    currentQuestionAbortController.current = new AbortController();
    wordDetailsAbortController.current?.abort("Game initialization started");
    wordDetailsAbortController.current = new AbortController();

    try {
      const initialTargetWord = selectTargetWord();
      debugLog("initializeGame: Initial target word:", initialTargetWord);
      if (!initialTargetWord) {
        if (isMounted.current) {
            debugLog("initializeGame: No initial target word found.");
            setCurrentQuestion(null);
            setIsLoadingCurrentQuestion(false);
        }
        isLoadingTransition.current = false;
        debugLog("initializeGame: Set isLoadingTransition to false (no initial word).");
        return;
      }
      const question = await localGenerateSingleQuestion(initialTargetWord, currentQuestionAbortController.current);
      if (isMounted.current) {
        setCurrentQuestion(question);
        if (question && question.correctAnswer) {
          debugLog("initializeGame: Initial question generated:", question);
          const details = await fetchDetailsWithCache(question.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
          if(isMounted.current) setWordDetails(details);
          debugLog("initializeGame: Initial details fetched:", details);
          await fetchAndStoreNextQuestionAndDetails();
        } else {
            debugLog("initializeGame: Failed to generate initial question.");
            setCurrentQuestion(null); // Ensure no partial question state
        }
      }
    } catch (error) {
        if(isMounted.current) {
            debugLog("Error in initializeGame catch block:", error);
            setCurrentQuestion(null);
            toast({ title: "Error", description: "Could not initialize the game.", variant: "destructive" });
        }
    } finally {
      if (isMounted.current) {
        setIsLoadingCurrentQuestion(false);
        setGameInitialized(true);
        debugLog("initializeGame: Game initialized and set isLoadingTransition to false in finally.");
      }
      isLoadingTransition.current = false;
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast, resetQuestionState]);

  useEffect(() => {
    debugLog("Effect for game initialization: vocabLoading:", vocabLoading, "hasEnoughWords:", hasEnoughWords, "gameInitialized:", gameInitialized);
    if (!vocabLoading && hasEnoughWords && !gameInitialized) {
      initializeGame();
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, initializeGame]);

  useEffect(() => {
    if (aiFailureCount >= 3) {
      if(isMounted.current) {
        debugLog("AI failure count reached 3, showing alert.");
        setShowAiFailureAlert(true);
      }
    } else {
      if(isMounted.current) setShowAiFailureAlert(false);
    }
  }, [aiFailureCount]);

  const handleSubmit = useCallback(async () => {
    debugLog("handleSubmit: Start. currentQuestion:", currentQuestion, "isCorrect:", isCorrect);
    if (!currentQuestion || !currentQuestion.correctAnswer || isCorrect !== null) return; // Check isCorrect to prevent re-submission

    const currentAttempts = attempts + 1;
    setAttempts(currentAttempts);

    const userNormalizedInput = userInput.trim().toLowerCase();
    const correctNormalizedAnswer = currentQuestion.correctAnswer.trim().toLowerCase();
    const currentlyCorrect = userNormalizedInput === correctNormalizedAnswer;
    
    setIsCorrect(currentlyCorrect);
    debugLog("handleSubmit: User input:", userInput, "Correct answer:", currentQuestion.correctAnswer, "Result:", currentlyCorrect);

    const targetWordObject = allLibraryWords.find(w => w.text === currentQuestion.targetWord);

    if (currentlyCorrect) {
      toast({ title: "Correct!", description: `"${currentQuestion.correctAnswer}" is right!`, className: "bg-green-500 text-white" });
      if (targetWordObject) {
        let newFamiliarity: FamiliarityLevel = targetWordObject.familiarity;
        if (currentAttempts === 1 && !hintUsedThisTurn) {
          if (targetWordObject.familiarity === 'Familiar') newFamiliarity = 'Mastered';
          // If already Mastered, stays Mastered
        } else { // Correct, but multiple attempts or hint used
          if (targetWordObject.familiarity === 'Mastered') newFamiliarity = 'Familiar';
          // If Familiar or Learning, stays as is
        }
        if (newFamiliarity !== targetWordObject.familiarity) {
            debugLog("handleSubmit (Correct): Updating familiarity for", targetWordObject.text, "from", targetWordObject.familiarity, "to", newFamiliarity);
            updateWordFamiliarity(targetWordObject.id, newFamiliarity);
        }
      }
    } else { // Incorrect submission
      setShowCorrectAnswer(true);
      toast({ title: "Incorrect", description: `The correct answer was: "${currentQuestion.correctAnswer}"`, variant: "destructive" });
      if (targetWordObject) {
        let newFamiliarity: FamiliarityLevel = targetWordObject.familiarity;
        if (targetWordObject.familiarity === 'Mastered') newFamiliarity = 'Familiar';
        else if (targetWordObject.familiarity === 'Familiar') newFamiliarity = 'Learning';
        // If Learning or New, stays as is
        if (newFamiliarity !== targetWordObject.familiarity) {
            debugLog("handleSubmit (Incorrect): Updating familiarity for", targetWordObject.text, "from", targetWordObject.familiarity, "to", newFamiliarity);
            updateWordFamiliarity(targetWordObject.id, newFamiliarity);
        }
      }
    }
    
    // Show details for the target word regardless of correct/incorrect
    if(isMounted.current) setShowDetails(true);
    if ((!wordDetails || wordDetails.word !== currentQuestion.targetWord) && isMounted.current) {
        setIsLoadingDetails(true); 
        wordDetailsAbortController.current?.abort("New submission, fetching details if needed.");
        wordDetailsAbortController.current = new AbortController();
        const d = await fetchDetailsWithCache(currentQuestion.targetWord, wordDetailsAbortController.current!, setIsLoadingDetails);
        if (isMounted.current) setWordDetails(d);
    } else if (isMounted.current) {
        setIsLoadingDetails(false); 
    }

  }, [currentQuestion, isCorrect, userInput, allLibraryWords, updateWordFamiliarity, toast, attempts, hintUsedThisTurn, wordDetails, fetchDetailsWithCache]);

  const revealHint = useCallback(() => {
    debugLog("revealHint: Start. currentQuestion:", currentQuestion, "userInput:", userInput);
    if (!currentQuestion || !currentQuestion.correctAnswer || hintRevealedThisQuestion || isCorrect !== null) return;

    let firstDiffIndex = -1;
    for (let i = 0; i < currentQuestion.correctAnswer.length; i++) {
        if (i >= userInput.length || userInput[i].toLowerCase() !== currentQuestion.correctAnswer[i].toLowerCase()) {
            firstDiffIndex = i;
            break;
        }
    }

    if (firstDiffIndex === -1 && userInput.length === currentQuestion.correctAnswer.length) { // Input is already correct
        return;
    }
    
    const revealUpToIndex = firstDiffIndex === -1 ? currentQuestion.correctAnswer.length : firstDiffIndex + 1;
    const revealedPortion = currentQuestion.correctAnswer.substring(0, revealUpToIndex);
    
    setUserInput(revealedPortion);
    setHintRevealedThisQuestion(true);
    setHintUsedThisTurn(true);
    
    debugLog("revealHint: Revealed up to index", revealUpToIndex, ". New input:", revealedPortion);
    toast({ 
      title: "Hint Revealed", 
      description: `Input updated to "${revealedPortion}"`,
      className: "bg-blue-500 text-white"
    });
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
      // Move cursor to the end of the revealed portion
      setTimeout(() => hiddenInputRef.current?.setSelectionRange(revealedPortion.length, revealedPortion.length), 0);
    }
  }, [currentQuestion, userInput, hintRevealedThisQuestion, isCorrect, toast]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCorrect !== null) return; // Don't allow changes after submission
    const value = e.target.value;
    if (currentQuestion && value.length <= currentQuestion.correctAnswer.length) {
      setUserInput(value);
    }
  };

  const renderCharacterSpans = useCallback(() => {
    if (!currentQuestion || !currentQuestion.correctAnswer) return null;
  
    const correctAnswerChars = currentQuestion.correctAnswer.split('');
    const displaySpans = [];
  
    // Determine overall correctness of the current userInput prefix
    // This is for the "neo -> all red" effect
    let isInputCurrentlyCorrectPrefix = true;
    if (userInput.length > 0 && !showCorrectAnswer) {
        isInputCurrentlyCorrectPrefix = currentQuestion.correctAnswer.toLowerCase().startsWith(userInput.toLowerCase());
    }
  
    for (let i = 0; i < correctAnswerChars.length; i++) {
      const typedChar = userInput[i];
      let charToDisplay = '_';
      let charColor = 'text-foreground';
      let borderColor = 'border-muted-foreground';
  
      if (showCorrectAnswer) {
        charToDisplay = correctAnswerChars[i];
        if (typedChar?.toLowerCase() === correctAnswerChars[i].toLowerCase()) {
          charColor = 'text-green-500 dark:text-green-400';
          borderColor = isCorrect ? 'border-green-500 dark:border-green-400' : 'border-green-500 dark:border-green-400'; // Correct part is green
        } else if (typedChar) { // User typed something, but it was wrong
          charColor = 'text-red-500 dark:text-red-400'; // Show correct char in red if user's input was there and wrong
          borderColor = 'border-red-500 dark:border-red-400';
        } else { // User didn't type this far, show correct char
          charColor = 'text-foreground'; // Neutral color for correctly filled in missing parts
          borderColor = isCorrect === false ? 'border-red-500 dark:border-red-400' : 'border-muted-foreground';
        }
      } else if (typedChar) {
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


  if (vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading vocabulary...</span></div>;
  }

  if (!hasEnoughWords) {
    return (
      <Alert variant="default" className="border-primary max-w-md mx-auto">
        <Lightbulb className="h-5 w-5 text-primary" />
        <AlertTitle>Not Enough "Familiar" or "Mastered" Words</AlertTitle>
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
          There seems to be an issue generating questions/details from the AI. Please try again later or check your API quota.
        </AlertDescription>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => { 
            setAiFailureCount(0); 
            setShowAiFailureAlert(false); 
            initializeGame();
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
            {(isLoadingNextQuestion || isLoadingNextDetails) && isCorrect === null && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary mr-1" /> 
                <span>Preparing next...</span>
                {(isLoadingNextQuestion || isLoadingNextDetails) && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
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
              
              {/* Visually hidden input for capturing keyboard events */}
              <input
                ref={hiddenInputRef}
                type="text"
                value={userInput}
                onChange={handleHiddenInputChange}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && isCorrect === null && userInput.trim().length > 0) {
                        e.preventDefault(); // Prevent form submission if wrapped in one
                        handleSubmit();
                    }
                }}
                className="opacity-0 absolute w-0 h-0 pointer-events-none"
                aria-label="Type the missing word here"
                maxLength={currentQuestion.correctAnswer.length}
                disabled={isCorrect !== null}
                autoFocus
              />
              
              {/* Character display area */}
              {renderCharacterSpans()}
              
              {isCorrect === false && showCorrectAnswer && (
                <p className="text-sm text-red-500 dark:text-red-400 text-center font-semibold">
                  Incorrect. The correct answer was: "{currentQuestion.correctAnswer}"
                </p>
              )}
              
              {/* Hint button */}
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
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && !isLoadingTransition.current && (
            <Alert variant="default">
              <Info className="h-5 w-5" />
              <AlertTitle>No Question Available</AlertTitle>
              <AlertDescription>
                Could not load a question. You might need more words in "Familiar" or "Mastered" state, or there was an AI issue.
              </AlertDescription>
              <Button 
                onClick={initializeGame} 
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

          {isCorrect === null && currentQuestion && ( // Show Submit button only if question is active and not yet answered
            <Button 
              onClick={handleSubmit} 
              disabled={userInput.trim().length === 0} 
              size="lg" 
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-5 w-5" /> Submit Answer
            </Button>
          )}

          {isCorrect !== null && ( // Show Next Question button after an answer (correct or incorrect)
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
    </div>
  );
});

TextInputGame.displayName = 'TextInputGame';
export default TextInputGame;


    