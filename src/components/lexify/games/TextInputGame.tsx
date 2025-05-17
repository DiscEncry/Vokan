
"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info, HelpCircle, Sparkles } from 'lucide-react';
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, TextInputQuestion, GeneratedWordDetails } from '@/types';
import { generateTextInputQuestion } from '@/ai/flows/generate-text-input-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';

interface TextInputGameProps {
  onStopGame: () => void;
}

const DEBUG = process.env.NODE_ENV === 'development'; // Or a dedicated debug flag

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
  const [hintText, setHintText] = useState<string | null>(null); // Renamed from 'hint'
  const [hintRevealed, setHintRevealed] = useState(false);
  const [attempts, setAttempts] = useState(0);

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
      // Fallback: if filtering leaves no words, but the original libraryWords had items, pick one from there
      // This ensures that if there's only one word, it can still be picked if not excluded.
      if (libraryWords.length > 0 && !excludeWordId && !currentQuestion?.targetWord) {
        return libraryWords[Math.floor(Math.random() * libraryWords.length)];
      }
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
      if (!questionData) {
          if (isMounted.current) {
            debugLog("localGenerateSingleQuestion: AI returned null/undefined data.");
            setAiFailureCount(prev => prev + 1);
          }
          return null;
      }
      if (isMounted.current) setAiFailureCount(0); 
      return {
        sentenceWithBlank: questionData.sentenceWithBlank,
        translatedHint: questionData.translatedHint,
        correctAnswer: questionData.targetWord, 
        targetWord: targetWord.text, 
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
        if (!hasEnoughWords && isMounted.current && gameInitialized) { // only toast if game was already running
            toast({ title: "No More Words", description: `You've reviewed all 'Familiar' or 'Mastered' words. Add more or change familiarity!`, variant: "default" });
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
        if(!nextQuestion && !nextWordDetails && !isLoadingNextDetails) { // If no next Q/D by end, ensure details loader is off
            setIsLoadingNextDetails(false);
        }
      }
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, currentQuestion, libraryWords, localGenerateSingleQuestion, fetchDetailsWithCache, toast, isLoadingNextDetails, isLoadingNextQuestion, gameInitialized]);


  const resetQuestionState = useCallback(() => {
    debugLog("resetQuestionState called");
    setUserInput('');
    setIsCorrect(null);
    setHintText(null);
    setHintRevealed(false);
    setAttempts(0);
    setShowDetails(false);
    // wordDetails is cleared in handleNextQuestion or initializeGame before setting new current details
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
      if (nextQuestion) {
        if(isMounted.current) {
            setCurrentQuestion(nextQuestion);
            setWordDetails(nextWordDetails); 
            setIsLoadingCurrentQuestion(false);
        }
        if (nextWordDetails || (nextQuestion && wordDetailsCache.current.has(nextQuestion.targetWord.toLowerCase()))) {
             if(isMounted.current) setIsLoadingDetails(false); 
        } else if (nextQuestion) { // If nextQuestion exists but details don't
            if(isMounted.current) setIsLoadingDetails(true);
            const d = await fetchDetailsWithCache(nextQuestion.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
            if(isMounted.current) setWordDetails(d);
        }
        // Clear pre-fetched states for the next cycle
        if(isMounted.current) {
            setNextQuestion(null); 
            setNextWordDetails(null);
        }
        await fetchAndStoreNextQuestionAndDetails();
      } else {
        debugLog("handleNextQuestion: No pre-fetched nextQuestion. Generating one now.");
        const targetWordObj = selectTargetWord();
        if (targetWordObj) {
          const q = await localGenerateSingleQuestion(targetWordObj, currentQuestionAbortController.current);
          if (isMounted.current) {
            setCurrentQuestion(q);
            setIsLoadingCurrentQuestion(false);
            if (q) {
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
        setIsLoadingCurrentQuestion(false); // Ensure this is false if an error occurred early
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
        if (question) {
          debugLog("initializeGame: Initial question generated:", question);
          const details = await fetchDetailsWithCache(question.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
          if(isMounted.current) setWordDetails(details);
          debugLog("initializeGame: Initial details fetched:", details);
          await fetchAndStoreNextQuestionAndDetails();
        } else {
            debugLog("initializeGame: Failed to generate initial question.");
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
    if (!currentQuestion || isCorrect === true) return;

    setAttempts(prev => prev + 1);
    const correct = userInput.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    debugLog("handleSubmit: User input:", userInput, "Correct answer:", currentQuestion.correctAnswer, "Result:", correct);

    if (correct) {
      toast({ title: "Correct!", description: `"${currentQuestion.correctAnswer}" is right!`, className: "bg-green-500 text-white" });
      const targetWordObject = allLibraryWords.find(w => w.text === currentQuestion.targetWord);
      if (targetWordObject) {
        const newFamiliarity = (attempts === 0 && !hintRevealed) ? 'Mastered' : 'Familiar';
        debugLog("handleSubmit: Updating familiarity for", targetWordObject.text, "to", newFamiliarity);
        updateWordFamiliarity(targetWordObject.id, newFamiliarity);
      }
      if(isMounted.current) setShowDetails(true);
      
      if (!wordDetails || wordDetails.word !== currentQuestion.targetWord) {
          if(isMounted.current) setIsLoadingDetails(true); 
          wordDetailsAbortController.current?.abort("New correct answer, fetching details if needed.");
          wordDetailsAbortController.current = new AbortController();
          const d = await fetchDetailsWithCache(currentQuestion.targetWord, wordDetailsAbortController.current!, setIsLoadingDetails);
          if (isMounted.current) setWordDetails(d);
      } else {
          if(isMounted.current) setIsLoadingDetails(false); 
      }

    } else {
      toast({ title: "Incorrect", description: "Try again!", variant: "destructive" });
      if(isMounted.current) setUserInput(''); 
    }
  }, [currentQuestion, isCorrect, userInput, allLibraryWords, updateWordFamiliarity, toast, attempts, hintRevealed, wordDetails, fetchDetailsWithCache]);

  const provideHint = useCallback(() => {
    debugLog("provideHint: Start. currentQuestion:", currentQuestion, "hintRevealed:", hintRevealed);
    if (currentQuestion && !hintRevealed && currentQuestion.correctAnswer.length > 0) {
      const newHintText = `Hint: The word starts with '${currentQuestion.correctAnswer[0].toUpperCase()}'`;
      debugLog("provideHint: Setting hint text to:", newHintText);
      setHintText(newHintText);
      setHintRevealed(true);
    }
  }, [currentQuestion, hintRevealed]);

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
            <CardTitle className="text-2xl">Text Input Challenge</CardTitle>
            {(isLoadingNextQuestion || isLoadingNextDetails) && !isCorrect && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary mr-1" /> 
                <span>Preparing next...</span>
                 {(isLoadingNextQuestion || isLoadingNextDetails) && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              </div>
            )}
          </div>
          <CardDescription>Type the English word that fits the blank. Check the Vietnamese hint below!</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoadingCurrentQuestion && !currentQuestion && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Generating question...</p>
            </div>
          )}

          {!isLoadingCurrentQuestion && currentQuestion && (
            <>
              <p className="text-xl md:text-2xl text-center p-6 bg-muted rounded-lg shadow-inner min-h-[100px] flex items-center justify-center">
                {currentQuestion.sentenceWithBlank.replace(/___/g, " ______ ")}
              </p>
              <p className="text-sm text-center text-muted-foreground italic px-2 py-1 bg-secondary/30 rounded-md">
                {currentQuestion.translatedHint}
              </p>
              <div className="flex gap-2 items-center">
                <Input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type the missing word"
                  className={`flex-grow text-lg ${isCorrect === false ? 'border-red-500 focus:ring-red-500' : ''} ${isCorrect === true ? 'border-green-500 focus:ring-green-500' : ''}`}
                  disabled={isCorrect === true}
                  onKeyPress={(e) => e.key === 'Enter' && isCorrect !== true && handleSubmit()}
                  aria-label="Type the missing word"
                />
                <Button onClick={handleSubmit} disabled={isCorrect === true || !userInput.trim()} size="lg">
                  {isCorrect === true ? <CheckCircle className="h-5 w-5" /> : "Submit"}
                </Button>
              </div>
              {isCorrect === false && <p className="text-sm text-red-500 text-center">Incorrect, try again!</p>}
              {isCorrect === true && <p className="text-sm text-green-500 text-center">Correct!</p>}
              
              {isCorrect !== true && !hintRevealed && (
                <Button onClick={provideHint} variant="outline" size="sm" className="w-full sm:w-auto">
                  <HelpCircle className="mr-2 h-4 w-4" /> Get a Hint (First Letter)
                </Button>
              )}
              {hintText && <p className="text-sm text-blue-600 dark:text-blue-400 text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md">{hintText}</p>}
            </>
          )}
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && !isLoadingTransition.current && (
             <Alert variant="default">
              <Info className="h-5 w-5" />
              <AlertTitle>No Question Available</AlertTitle>
              <AlertDescription>
                Could not load a question. You might need more words in "Familiar" or "Mastered" state, or there was an AI issue.
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

