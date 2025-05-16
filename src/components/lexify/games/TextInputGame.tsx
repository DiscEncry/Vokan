
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

const TextInputGame: FC<TextInputGameProps> = ({ onStopGame }) => {
  const { words: allLibraryWords, updateWordFamiliarity, isLoading: vocabLoading } = useVocabulary();
  const { toast } = useToast();

  const libraryWords = React.useMemo(() => allLibraryWords.filter(w => w.familiarity === 'Learning'), [allLibraryWords]);

  const [currentQuestion, setCurrentQuestion] = useState<TextInputQuestion | null>(null);
  const [nextQuestion, setNextQuestion] = useState<TextInputQuestion | null>(null);
  const [wordDetails, setWordDetails] = useState<GeneratedWordDetails | null>(null);
  const [nextWordDetails, setNextWordDetails] = useState<GeneratedWordDetails | null>(null);

  const [userInput, setUserInput] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string | null>(null);
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
  const wordDetailsCache = useRef<Map<string, GeneratedWordDetails>>(new Map());
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
      currentQuestionAbortController.current?.abort();
      nextQuestionAbortController.current?.abort();
      wordDetailsAbortController.current?.abort();
      nextWordDetailsAbortController.current?.abort();
    };
  }, []);

  const selectTargetWord = useCallback((excludeWordId?: string): Word | null => {
    if (!hasEnoughWords) return null;
    let eligibleWords = libraryWords;
    if (excludeWordId) {
      eligibleWords = eligibleWords.filter(w => w.id !== excludeWordId);
    }
    if (currentQuestion?.targetWord) {
        const currentTargetWordObj = libraryWords.find(w => w.text === currentQuestion.targetWord);
        if (currentTargetWordObj) {
            eligibleWords = eligibleWords.filter(w => w.id !== currentTargetWordObj.id);
        }
    }
    if (eligibleWords.length === 0) {
        // Fallback: if exclusion results in no words, consider all "Learning" words again
        // This can happen if there's only one "Learning" word.
        return libraryWords.length > 0 ? libraryWords[Math.floor(Math.random() * libraryWords.length)] : null;
    }
    return eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
  }, [libraryWords, currentQuestion, hasEnoughWords]);

  const localGenerateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<TextInputQuestion | null> => {
    if (!targetWord) return null;
    try {
      const aiInput = { word: targetWord.text };
      const questionData = await generateTextInputQuestion(aiInput); // Assuming options.signal can be passed if API supports it
      
      if (!isMounted.current) return null;
      if (!questionData) {
          setAiFailureCount(prev => prev + 1);
          return null;
      }
      setAiFailureCount(0); // Reset on success
      return {
        sentenceWithBlank: questionData.sentenceWithBlank,
        translatedHint: questionData.translatedHint,
        correctAnswer: questionData.targetWord, // AI might slightly alter casing, use its version for checking
        targetWord: targetWord.text, // Keep original for display/details
      };
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        console.error("Error generating text input question:", error);
        toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
        setAiFailureCount(prev => prev + 1);
      }
      return null;
    }
  }, [toast]);

  const fetchDetailsWithCache = useCallback(async (wordText: string, abortController: AbortController, setLoadingStateAction: React.Dispatch<React.SetStateAction<boolean>>): Promise<GeneratedWordDetails | null> => {
    if (wordDetailsCache.current.has(wordText)) {
      const cached = wordDetailsCache.current.get(wordText);
      // Avoid returning cached error messages as success
      if (cached && !cached.details.startsWith("Unable to retrieve full details")) {
          return cached;
      }
    }
    setLoadingStateAction(true);
    try {
      const detailsData = await generateWordDetails({ word: wordText }); // Assuming options.signal can be passed
      if (!isMounted.current) return null;
      if (detailsData && !detailsData.details.startsWith("Unable to retrieve full details")) {
        wordDetailsCache.current.set(wordText, detailsData);
      }
      return detailsData;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        console.error("Error fetching word details:", error);
        toast({ title: "AI Error", description: "Could not fetch word details.", variant: "destructive" });
      }
      return { word: wordText, details: `Unable to retrieve full details for "${wordText}" at this time.` };
    } finally {
      if (isMounted.current) setLoadingStateAction(false);
    }
  }, [toast]);

  const fetchAndStoreNextQuestionAndDetails = useCallback(async () => {
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingTransition.current) return;

    setIsLoadingNextQuestion(true);
    setIsLoadingNextDetails(true);
    setNextQuestion(null);
    setNextWordDetails(null);
    
    nextQuestionAbortController.current?.abort();
    nextQuestionAbortController.current = new AbortController();
    nextWordDetailsAbortController.current?.abort();
    nextWordDetailsAbortController.current = new AbortController();

    const nextTargetWordObj = selectTargetWord(currentQuestion?.targetWord ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined);

    if (!nextTargetWordObj) {
      if (hasEnoughWords) toast({ title: "No more unique words", description: "You've cycled through all available 'Learning' words for now!", variant: "default" });
      setIsLoadingNextQuestion(false);
      setIsLoadingNextDetails(false);
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
      } else if (isMounted.current) { // Question generation failed
         setNextQuestion(null);
         setNextWordDetails(null);
         setIsLoadingNextDetails(false); // Ensure details loading also stops
      }
    } catch (error) {
        // Errors are handled in localGenerateSingleQuestion and fetchDetailsWithCache
    } finally {
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
        // setIsLoadingNextDetails is handled by fetchDetailsWithCache or if question is null
        if(!nextQuestion && !nextWordDetails) setIsLoadingNextDetails(false);
      }
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, currentQuestion, libraryWords, localGenerateSingleQuestion, fetchDetailsWithCache, toast]);


  const resetQuestionState = () => {
    setUserInput('');
    setIsCorrect(null);
    setHint(null);
    setHintRevealed(false);
    setAttempts(0);
    setShowDetails(false);
    setWordDetails(null);
  };

  const handleNextQuestion = useCallback(async () => {
    if (isLoadingTransition.current || !isMounted.current) return;
    isLoadingTransition.current = true;
    resetQuestionState();
    setIsLoadingCurrentQuestion(true);
    
    currentQuestionAbortController.current?.abort();
    currentQuestionAbortController.current = new AbortController();
    wordDetailsAbortController.current?.abort();
    wordDetailsAbortController.current = new AbortController();

    try {
      if (nextQuestion) {
        setCurrentQuestion(nextQuestion);
        setWordDetails(nextWordDetails); // Use pre-fetched details
        setNextQuestion(null);
        setNextWordDetails(null);
        setIsLoadingCurrentQuestion(false);
        if (nextWordDetails) setIsLoadingDetails(false); // If details were pre-fetched, not loading them now
        await fetchAndStoreNextQuestionAndDetails();
      } else {
        // Fallback: if no next question was pre-fetched, generate one now
        const targetWordObj = selectTargetWord();
        if (targetWordObj) {
          const q = await localGenerateSingleQuestion(targetWordObj, currentQuestionAbortController.current);
          setCurrentQuestion(q);
          setIsLoadingCurrentQuestion(false);
          if (q) {
            const d = await fetchDetailsWithCache(q.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
            setWordDetails(d);
            await fetchAndStoreNextQuestionAndDetails(); // Then fetch the *next* next one
          } else {
            toast({ title: "Game Over?", description: "Could not load a new question. Add more 'Learning' words or check AI status.", variant: "destructive" });
             setCurrentQuestion(null); // End game or show error
          }
        } else {
          setCurrentQuestion(null); // No words left
          toast({ title: "No words left!", description: "You've completed all 'Learning' words.", variant: "default" });
        }
      }
    } catch (error) {
        console.error("Error in handleNextQuestion:", error);
        setCurrentQuestion(null);
        toast({ title: "Error", description: "An unexpected error occurred while loading the next question.", variant: "destructive" });
    } finally {
      if (isMounted.current) {
        setIsLoadingCurrentQuestion(false);
      }
      isLoadingTransition.current = false;
    }
  }, [nextQuestion, nextWordDetails, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast]);


  const initializeGame = useCallback(async () => {
    if (isLoadingTransition.current || !isMounted.current || vocabLoading || !hasEnoughWords) return;
    isLoadingTransition.current = true;
    
    resetQuestionState();
    setIsLoadingCurrentQuestion(true);
    
    currentQuestionAbortController.current?.abort();
    currentQuestionAbortController.current = new AbortController();
    wordDetailsAbortController.current?.abort();
    wordDetailsAbortController.current = new AbortController();

    try {
      const initialTargetWord = selectTargetWord();
      if (!initialTargetWord) {
        setCurrentQuestion(null);
        setIsLoadingCurrentQuestion(false);
        isLoadingTransition.current = false;
        return;
      }
      const question = await localGenerateSingleQuestion(initialTargetWord, currentQuestionAbortController.current);
      if (isMounted.current) {
        setCurrentQuestion(question);
        if (question) {
          // Fetch details for the first question
          const details = await fetchDetailsWithCache(question.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
          setWordDetails(details); // Set details for the current question.
                                   // Note: This WordDetailPanel will only show on correct answer.

          // Pre-fetch the *next* question and its details
          await fetchAndStoreNextQuestionAndDetails();
        }
      }
    } catch (error) {
        console.error("Error initializing game:", error);
        setCurrentQuestion(null);
        toast({ title: "Error", description: "Could not initialize the game.", variant: "destructive" });
    } finally {
      if (isMounted.current) {
        setIsLoadingCurrentQuestion(false);
        setGameInitialized(true);
      }
      isLoadingTransition.current = false;
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast]);


  useEffect(() => {
    if (!vocabLoading && hasEnoughWords && !gameInitialized) {
      initializeGame();
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, initializeGame]);

  useEffect(() => {
    if (aiFailureCount >= 3) {
      setShowAiFailureAlert(true);
    } else {
      setShowAiFailureAlert(false);
    }
  }, [aiFailureCount]);

  const handleSubmit = async () => {
    if (!currentQuestion || isCorrect) return;

    setAttempts(prev => prev + 1);
    const correct = userInput.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);

    if (correct) {
      toast({ title: "Correct!", description: `"${currentQuestion.correctAnswer}" is right!`, className: "bg-green-500 text-white" });
      const targetWordObject = allLibraryWords.find(w => w.text === currentQuestion.targetWord);
      if (targetWordObject) {
        updateWordFamiliarity(targetWordObject.id, attempts === 1 && !hintRevealed ? 'Familiar' : 'Learning');
      }
      setShowDetails(true);
      // Details might have been pre-fetched by initializeGame (for the first q) or handleNextQuestion (for subsequent)
      // and set into wordDetails state. If not, fetchDetailsWithCache would have been called by those.
      // Here we ensure isLoadingDetails reflects the state of the *current* question's details.
      if (!wordDetails || wordDetails.word !== currentQuestion.targetWord) {
          // This is a fallback if pre-fetching didn't align or wordDetails is for a previous question
          const d = await fetchDetailsWithCache(currentQuestion.targetWord, wordDetailsAbortController.current!, setIsLoadingDetails);
          if (isMounted.current) setWordDetails(d);
      } else {
          setIsLoadingDetails(false); // Details were already loaded (likely pre-fetched)
      }

    } else {
      toast({ title: "Incorrect", description: "Try again!", variant: "destructive" });
      setUserInput(''); // Clear input on incorrect
    }
  };

  const provideHint = () => {
    if (currentQuestion && !hintRevealed) {
      setHint(`Hint: The word starts with '${currentQuestion.correctAnswer[0].toUpperCase()}'`);
      setHintRevealed(true);
    }
  };

  if (vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading vocabulary...</span></div>;
  }

  if (!hasEnoughWords) {
    return (
      <Alert variant="default" className="border-primary max-w-md mx-auto">
        <Lightbulb className="h-5 w-5 text-primary" />
        <AlertTitle>Not Enough "Learning" Words</AlertTitle>
        <AlertDescription>You need at least one word marked as "Learning" in your library to play this game. Please add or update words in the Library tab.</AlertDescription>
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
                  onKeyPress={(e) => e.key === 'Enter' && !isCorrect && handleSubmit()}
                />
                <Button onClick={handleSubmit} disabled={isCorrect === true || !userInput.trim()} size="lg">
                  {isCorrect === true ? <CheckCircle className="h-5 w-5" /> : "Submit"}
                </Button>
              </div>
              {isCorrect === false && <p className="text-sm text-red-500 text-center">Incorrect, try again!</p>}
              {isCorrect === true && <p className="text-sm text-green-500 text-center">Correct!</p>}
              
              {!isCorrect && !hintRevealed && (
                <Button onClick={provideHint} variant="outline" size="sm" className="w-full sm:w-auto">
                  <HelpCircle className="mr-2 h-4 w-4" /> Get a Hint (First Letter)
                </Button>
              )}
              {hint && <p className="text-sm text-blue-600 dark:text-blue-400 text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md">{hint}</p>}
            </>
          )}
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && (
             <Alert variant="default">
              <Info className="h-5 w-5" />
              <AlertTitle>No Question Available</AlertTitle>
              <AlertDescription>
                Could not load a question. You might need more words in "Learning" state, or there was an AI issue.
              </AlertDescription>
              <Button onClick={initializeGame} className="mt-3" disabled={isLoadingTransition.current}>
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
};

export default TextInputGame;

