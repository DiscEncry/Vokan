
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

  const libraryWords = React.useMemo(() => allLibraryWords.filter(w => w.familiarity === 'Familiar'), [allLibraryWords]);

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
        return libraryWords.length > 0 ? libraryWords[Math.floor(Math.random() * libraryWords.length)] : null;
    }
    return eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
  }, [libraryWords, currentQuestion, hasEnoughWords]);

  const localGenerateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<TextInputQuestion | null> => {
    if (!targetWord) return null;
    try {
      // TODO: Pass abortController.signal to generateTextInputQuestion if supported by Genkit/underlying API
      const aiInput = { word: targetWord.text };
      const questionData = await generateTextInputQuestion(aiInput);
      
      if (!isMounted.current) return null;
      if (!questionData) {
          if (isMounted.current) setAiFailureCount(prev => prev + 1);
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
        console.error("Error generating text input question:", error);
        toast({ title: "AI Error", description: "Could not generate a question.", variant: "destructive" });
        setAiFailureCount(prev => prev + 1);
      }
      return null;
    }
  }, [toast]);

  const fetchDetailsWithCache = useCallback(async (wordText: string, abortController: AbortController, setLoadingStateAction: React.Dispatch<React.SetStateAction<boolean>>): Promise<GeneratedWordDetails | null> => {
    const normalizedWordText = wordText.toLowerCase();
    if (wordDetailsCache.current.has(normalizedWordText)) {
      const cached = wordDetailsCache.current.get(normalizedWordText);
      if (cached && !cached.details.startsWith("Unable to retrieve full details")) {
          return cached;
      }
    }
    setLoadingStateAction(true);
    try {
      // TODO: Pass abortController.signal to generateWordDetails if supported
      const detailsData = await generateWordDetails({ word: wordText }); 
      if (!isMounted.current) return null;
      if (detailsData && !detailsData.details.startsWith("Unable to retrieve full details")) {
        wordDetailsCache.current.set(normalizedWordText, detailsData);
      }
      return detailsData;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        console.error("Error fetching word details:", error);
        toast({ title: "AI Error", description: "Could not fetch word details.", variant: "destructive" });
      }
      // Return a fallback structure if the API call fails entirely
      return { word: wordText, details: `Unable to retrieve full details for "${wordText}" at this time. An error occurred.` };
    } finally {
      if (isMounted.current) setLoadingStateAction(false);
    }
  }, [toast]);

  const fetchAndStoreNextQuestionAndDetails = useCallback(async () => {
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingTransition.current || isLoadingNextQuestion || isLoadingNextDetails) return;

    setIsLoadingNextQuestion(true);
    setIsLoadingNextDetails(true); // Assume we'll fetch details
    setNextQuestion(null);
    setNextWordDetails(null);
    
    nextQuestionAbortController.current?.abort();
    nextQuestionAbortController.current = new AbortController();
    nextWordDetailsAbortController.current?.abort();
    nextWordDetailsAbortController.current = new AbortController();

    const nextTargetWordObj = selectTargetWord(currentQuestion?.targetWord ? libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined);

    if (!nextTargetWordObj) {
      if (hasEnoughWords && isMounted.current) toast({ title: "No more unique words", description: "You've cycled through all available 'Familiar' words for now!", variant: "default" });
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
        setIsLoadingNextDetails(false);
      }
      return;
    }

    try {
      const question = await localGenerateSingleQuestion(nextTargetWordObj, nextQuestionAbortController.current);
      if (isMounted.current && question) {
        setNextQuestion(question); // Set next question first
        const details = await fetchDetailsWithCache(question.targetWord, nextWordDetailsAbortController.current, setIsLoadingNextDetails);
        if (isMounted.current) {
          setNextWordDetails(details); // Then set its details
        }
      } else if (isMounted.current) { // Question generation failed or component unmounted
         setNextQuestion(null);
         setNextWordDetails(null);
         setIsLoadingNextDetails(false); 
      }
    } catch (error) {
       if(isMounted.current) {
          console.error("Error in fetchAndStoreNextQuestionAndDetails: ", error);
          setNextQuestion(null);
          setNextWordDetails(null);
          setIsLoadingNextDetails(false);
       }
    } finally {
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
        // setIsLoadingNextDetails is managed by fetchDetailsWithCache or if question is null
        if(!nextQuestion && !nextWordDetails && !isLoadingNextDetails) setIsLoadingNextDetails(false);
      }
    }
  }, [vocabLoading, hasEnoughWords, selectTargetWord, currentQuestion, libraryWords, localGenerateSingleQuestion, fetchDetailsWithCache, toast, isLoadingNextDetails, isLoadingNextQuestion]);


  const resetQuestionState = () => {
    setUserInput('');
    setIsCorrect(null);
    setHint(null);
    setHintRevealed(false);
    setAttempts(0);
    setShowDetails(false);
    // wordDetails is cleared in handleNextQuestion before setting new current details
  };

  const handleNextQuestion = useCallback(async () => {
    if (isLoadingTransition.current || !isMounted.current) return;
    isLoadingTransition.current = true;
    
    resetQuestionState();
    setIsLoadingCurrentQuestion(true);
    setWordDetails(null); // Clear previous details
    
    currentQuestionAbortController.current?.abort();
    currentQuestionAbortController.current = new AbortController();
    wordDetailsAbortController.current?.abort();
    wordDetailsAbortController.current = new AbortController();

    try {
      if (nextQuestion) {
        setCurrentQuestion(nextQuestion);
        setWordDetails(nextWordDetails); // Use pre-fetched details
        setIsLoadingCurrentQuestion(false);
        if (nextWordDetails || wordDetailsCache.current.has(nextQuestion.targetWord.toLowerCase())) {
             setIsLoadingDetails(false); // If details were pre-fetched or cached, not loading them now
        } else {
            // This case should be rare if pre-fetching works, but as a fallback
            setIsLoadingDetails(true);
            const d = await fetchDetailsWithCache(nextQuestion.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
            if(isMounted.current) setWordDetails(d);
        }
        // Clear pre-fetched states for the next cycle
        setNextQuestion(null); 
        setNextWordDetails(null);
        await fetchAndStoreNextQuestionAndDetails();
      } else {
        // Fallback: if no next question was pre-fetched, generate one now
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
               if(isMounted.current) {
                    toast({ title: "Game Over?", description: "Could not load a new question. Add more 'Familiar' words or check AI status.", variant: "destructive" });
                    setCurrentQuestion(null); 
               }
            }
          }
        } else {
          if(isMounted.current){
            setCurrentQuestion(null); 
            toast({ title: "No words left!", description: "You've completed all 'Familiar' words.", variant: "default" });
          }
        }
      }
    } catch (error) {
        if(isMounted.current) {
            console.error("Error in handleNextQuestion:", error);
            setCurrentQuestion(null);
            toast({ title: "Error", description: "An unexpected error occurred while loading the next question.", variant: "destructive" });
        }
    } finally {
      if (isMounted.current) {
        setIsLoadingCurrentQuestion(false); // Ensure this is false if an error occurred early
      }
      isLoadingTransition.current = false;
    }
  }, [nextQuestion, nextWordDetails, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast]);


  const initializeGame = useCallback(async () => {
    if (isLoadingTransition.current || !isMounted.current || vocabLoading || !hasEnoughWords || gameInitialized) return;
    isLoadingTransition.current = true;
    
    resetQuestionState();
    setIsLoadingCurrentQuestion(true);
    setWordDetails(null);
    
    currentQuestionAbortController.current?.abort();
    currentQuestionAbortController.current = new AbortController();
    wordDetailsAbortController.current?.abort();
    wordDetailsAbortController.current = new AbortController();

    try {
      const initialTargetWord = selectTargetWord();
      if (!initialTargetWord) {
        if (isMounted.current) {
            setCurrentQuestion(null);
            setIsLoadingCurrentQuestion(false);
        }
        isLoadingTransition.current = false;
        return;
      }
      const question = await localGenerateSingleQuestion(initialTargetWord, currentQuestionAbortController.current);
      if (isMounted.current) {
        setCurrentQuestion(question);
        if (question) {
          const details = await fetchDetailsWithCache(question.targetWord, wordDetailsAbortController.current, setIsLoadingDetails);
          if(isMounted.current) setWordDetails(details);
          await fetchAndStoreNextQuestionAndDetails();
        }
      }
    } catch (error) {
        if(isMounted.current) {
            console.error("Error initializing game:", error);
            setCurrentQuestion(null);
            toast({ title: "Error", description: "Could not initialize the game.", variant: "destructive" });
        }
    } finally {
      if (isMounted.current) {
        setIsLoadingCurrentQuestion(false);
        setGameInitialized(true);
      }
      isLoadingTransition.current = false;
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, selectTargetWord, localGenerateSingleQuestion, fetchDetailsWithCache, fetchAndStoreNextQuestionAndDetails, toast]);


  useEffect(() => {
    if (!vocabLoading && hasEnoughWords && !gameInitialized) {
      initializeGame();
    }
  }, [vocabLoading, hasEnoughWords, gameInitialized, initializeGame]);

  useEffect(() => {
    if (aiFailureCount >= 3) {
      if(isMounted.current) setShowAiFailureAlert(true);
    } else {
      if(isMounted.current) setShowAiFailureAlert(false);
    }
  }, [aiFailureCount]);

  const handleSubmit = async () => {
    if (!currentQuestion || isCorrect === true) return;

    setAttempts(prev => prev + 1);
    const correct = userInput.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);

    if (correct) {
      toast({ title: "Correct!", description: `"${currentQuestion.correctAnswer}" is right!`, className: "bg-green-500 text-white" });
      const targetWordObject = allLibraryWords.find(w => w.text === currentQuestion.targetWord);
      if (targetWordObject) {
        // If correct on 1st attempt with no hint, move from Familiar to Mastered
        // Otherwise, it stays Familiar (as it's already Familiar to be in this game)
        const newFamiliarity = (attempts === 0 && !hintRevealed) ? 'Mastered' : 'Familiar';
        updateWordFamiliarity(targetWordObject.id, newFamiliarity);
      }
      if(isMounted.current) setShowDetails(true);
      
      // Ensure details are loaded if not already (e.g. if pre-fetch failed or user was too quick)
      if (!wordDetails || wordDetails.word !== currentQuestion.targetWord) {
          if(isMounted.current) setIsLoadingDetails(true); // Show loader while fetching details for current question
          const d = await fetchDetailsWithCache(currentQuestion.targetWord, wordDetailsAbortController.current!, setIsLoadingDetails);
          if (isMounted.current) setWordDetails(d);
      } else {
          if(isMounted.current) setIsLoadingDetails(false); 
      }

    } else {
      toast({ title: "Incorrect", description: "Try again!", variant: "destructive" });
      setUserInput(''); 
    }
  };

  const provideHint = () => {
    if (currentQuestion && !hintRevealed && currentQuestion.correctAnswer.length > 0) {
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
        <AlertTitle>Not Enough "Familiar" Words</AlertTitle>
        <AlertDescription>You need at least one word marked as "Familiar" in your library to play this game. Please add or update words in the Library tab, or play the Multiple Choice game.</AlertDescription>
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
              {hint && <p className="text-sm text-blue-600 dark:text-blue-400 text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md">{hint}</p>}
            </>
          )}
          
          {!isLoadingCurrentQuestion && !currentQuestion && !vocabLoading && (
             <Alert variant="default">
              <Info className="h-5 w-5" />
              <AlertTitle>No Question Available</AlertTitle>
              <AlertDescription>
                Could not load a question. You might need more words in "Familiar" state, or there was an AI issue.
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
};

export default TextInputGame;
