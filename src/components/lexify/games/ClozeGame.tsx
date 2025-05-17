"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw, StopCircle, Info } from 'lucide-react';
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, ClozeQuestion as ClozeQuestionType, GeneratedWordDetails } from '@/types';
import { generateClozeQuestion } from '@/ai/flows/generate-cloze-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';

interface ClozeGameProps {
  onStopGame: () => void;
}

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
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number>(-1);
  
  // Option buttons refs for focus management
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Loading states
  const [isLoadingCurrentQuestion, setIsLoadingCurrentQuestion] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Word details state
  const [wordDetails, setWordDetails] = useState<GeneratedWordDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Request cancellation refs
  const isMounted = useRef(true);
  const currentQuestionAbortController = useRef<AbortController | null>(null);
  const nextQuestionAbortController = useRef<AbortController | null>(null);
  const wordDetailsAbortController = useRef<AbortController | null>(null);

  // Check if the library has enough words to play
  const hasEnoughWords = libraryWords.length >= 4;

  useEffect(() => {
    isMounted.current = true;
    
    return () => { 
      isMounted.current = false; 
      // Cancel any pending requests on unmount
      if (currentQuestionAbortController.current) currentQuestionAbortController.current.abort();
      if (nextQuestionAbortController.current) nextQuestionAbortController.current.abort();
      if (wordDetailsAbortController.current) wordDetailsAbortController.current.abort();
    };
  }, []);

  // Reset focused option index when a new question loads
  useEffect(() => {
    if (!isLoadingCurrentQuestion && currentQuestion) {
      setFocusedOptionIndex(-1);
    }
  }, [isLoadingCurrentQuestion, currentQuestion]);

  /**
   * Select a target word for the question, excluding any specified word ID
   */
  const selectTargetWord = useCallback((excludeWordId?: string): Word | null => {
    if (!hasEnoughWords) return null;
    
    let eligibleWords = libraryWords;
    
    // Filter out excluded words and the current target word
    if (excludeWordId) {
      eligibleWords = libraryWords.filter(w => w.id !== excludeWordId);
    }
    if (currentQuestion?.targetWord) {
      eligibleWords = eligibleWords.filter(w => w.text !== currentQuestion.targetWord);
    }
    
    if (eligibleWords.length === 0) return null;

    // Prioritize New and Learning words
    const learningWords = eligibleWords.filter(w => w.familiarity === 'New' || w.familiarity === 'Learning');
    
    if (learningWords.length > 0) {
      // Select randomly from learning words
      return learningWords[Math.floor(Math.random() * learningWords.length)];
    }
    
    // Fall back to any word if no learning words found
    return eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
  }, [libraryWords, currentQuestion, hasEnoughWords]);

  /**
   * Generate a single cloze question for the given target word
   */
  const generateSingleQuestion = useCallback(async (targetWord: Word, abortController: AbortController): Promise<ClozeQuestionType | null> => {
    if (!targetWord) return null;

    // Get decoy words, ensuring we have enough
    const decoys = getDecoyWords(targetWord.id, 3);
    if (decoys.length < 3) {
      toast({ 
        title: "Not enough decoy words", 
        description: `Need at least 3 decoys, found ${decoys.length}. Add more words.`, 
        variant: "destructive"
      });
      return null;
    }
    
    const decoyTexts = decoys.map(d => d.text);

    try {
      const aiInput = { word: targetWord.text, libraryWords: decoyTexts };
      const clozeData = await generateClozeQuestion(aiInput, { signal: abortController.signal });
      
      if (!isMounted.current) return null;
      
      // Ensure the target word is always an option
      let options = [...clozeData.options];
      if (!options.includes(targetWord.text)) {
        options[Math.floor(Math.random() * options.length)] = targetWord.text;
      }
      
      // Shuffle the options
      const shuffledOptions = options.sort(() => 0.5 - Math.random()).slice(0, 4);
      
      // Double-check target word is included after shuffling
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
      // Only show error if not caused by abort
      if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
        console.error("Error generating cloze question:", error);
        toast({ 
          title: "AI Error", 
          description: "Could not generate a question. Please try again.", 
          variant: "destructive" 
        });
      }
      return null;
    }
  }, [getDecoyWords, toast]);

  /**
   * Fetch and store the next question in advance
   */
  const fetchAndStoreNextQuestion = useCallback(async () => {
    if (vocabLoading || !hasEnoughWords || !isMounted.current || isLoadingNextQuestion) return;
    
    // Cancel any existing request
    if (nextQuestionAbortController.current) {
      nextQuestionAbortController.current.abort();
    }
    
    // Create new abort controller for this request
    nextQuestionAbortController.current = new AbortController();
    
    // Select a target word for the next question
    const nextTargetWord = selectTargetWord(currentQuestion?.targetWord ? 
      libraryWords.find(w => w.text === currentQuestion.targetWord)?.id : undefined);
    
    if (!nextTargetWord) {
      if (hasEnoughWords) {
        toast({ 
          title: "No suitable next word", 
          description: "Could not find a different word for the next question.", 
          variant: "default" 
        });
      }
      return;
    }

    setIsLoadingNextQuestion(true);
    
    try {
      const question = await generateSingleQuestion(nextTargetWord, nextQuestionAbortController.current);
      
      if (isMounted.current) {
        setNextQuestion(question);
      }
    } catch (error) {
      // Error handling is done in generateSingleQuestion
    } finally {
      if (isMounted.current) {
        setIsLoadingNextQuestion(false);
      }
    }
  }, [
    vocabLoading, 
    hasEnoughWords, 
    isLoadingNextQuestion, 
    selectTargetWord, 
    currentQuestion, 
    generateSingleQuestion, 
    libraryWords, 
    toast
  ]);

  /**
   * Load the current question and prepare the next one
   */
  const loadCurrentAndPrepareNext = useCallback(async () => {
    if (!isMounted.current || vocabLoading || !hasEnoughWords) return;

    // Cancel any existing requests
    if (currentQuestionAbortController.current) {
      currentQuestionAbortController.current.abort();
    }
    
    // Create new abort controller for this request
    currentQuestionAbortController.current = new AbortController();

    // Reset game state
    setIsLoadingCurrentQuestion(true);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setWordDetails(null);
    setShowDetails(false);
    setAttemptedAnswers([]);
    setFocusedOptionIndex(-1);
    optionButtonsRef.current = [];

    // If we have a pre-generated question, use it
    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setNextQuestion(null);
      setIsLoadingCurrentQuestion(false);
      
      // Start fetching the next question
      fetchAndStoreNextQuestion();
    } else {
      // First load or if pre-generation failed
      const initialTargetWord = selectTargetWord();
      
      if (!initialTargetWord) {
        toast({ 
          title: "No words to start", 
          description: "Please add at least 4 words to your library.", 
          variant: "destructive" 
        });
        setIsLoadingCurrentQuestion(false);
        return;
      }
      
      try {
        const question = await generateSingleQuestion(initialTargetWord, currentQuestionAbortController.current);
        
        if (isMounted.current) {
          setCurrentQuestion(question);
          
          // Only fetch next if current succeeded
          if (question) {
            fetchAndStoreNextQuestion();
          }
        }
      } catch (error) {
        // Error handling is done in generateSingleQuestion
      } finally {
        if (isMounted.current) {
          setIsLoadingCurrentQuestion(false);
        }
      }
    }
  }, [
    vocabLoading, 
    hasEnoughWords, 
    nextQuestion, 
    selectTargetWord, 
    generateSingleQuestion, 
    fetchAndStoreNextQuestion, 
    toast
  ]);

  /**
   * Handle the user's answer submission
   */
  const handleAnswerSubmit = useCallback((answer: string) => {
    if (!currentQuestion || isCorrect || !isMounted.current) return;

    setSelectedAnswer(answer);
    setAttemptedAnswers(prev => [...prev, answer]);
    
    const correct = answer === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      toast({ 
        title: "Correct!", 
        description: `"${answer}" is the right word.`, 
        className: "bg-green-500 text-white" 
      });
      
      // Update word familiarity
      const targetWordObject = libraryWords.find(w => w.text === currentQuestion.targetWord);
      if (targetWordObject) {
        // First try = Familiar, multiple tries = still Learning
        const familiarity = attemptedAnswers.length === 0 ? 'Familiar' : 'Learning'; 
        updateWordFamiliarity(targetWordObject.id, familiarity);
      }

      // Load word details
      setIsLoadingDetails(true);
      setShowDetails(true);
      
      // Cancel any existing requests
      if (wordDetailsAbortController.current) {
        wordDetailsAbortController.current.abort();
      }
      
      // Create new abort controller for this request
      wordDetailsAbortController.current = new AbortController();
      
      generateWordDetails(
        { word: currentQuestion.targetWord },
        { signal: wordDetailsAbortController.current.signal }
      ).then(detailsData => {
        if (isMounted.current) {
          setWordDetails(detailsData);
        }
      }).catch(error => {
        if (error instanceof Error && error.name !== 'AbortError' && isMounted.current) {
          console.error("Error fetching word details:", error);
          toast({ 
            title: "AI Error", 
            description: "Could not fetch word details.", 
            variant: "destructive" 
          });
        }
      }).finally(() => {
        if (isMounted.current) {
          setIsLoadingDetails(false);
        }
      });
    } else {
      toast({ 
        title: "Incorrect", 
        description: `"${answer}" is not the right word. Try again!`, 
        variant: "destructive" 
      });
    }
  }, [currentQuestion, isCorrect, attemptedAnswers, libraryWords, toast, updateWordFamiliarity]);

  /**
   * Initial load of the game
   */
  useEffect(() => {
    // First mount or after vocabulary is loaded, start the game
    if (!vocabLoading && hasEnoughWords) {
      loadCurrentAndPrepareNext();
    }
  // Deliberately not including all dependencies to avoid infinite re-render loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabLoading, hasEnoughWords]);

  /**
   * Handle keyboard navigation and selection
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for Space to avoid page scrolling
      if (e.key === ' ') {
        e.preventDefault();
      }

      // Skip if loading or no question is available
      if (isLoadingCurrentQuestion || !currentQuestion) return;
      
      // If already answered correctly, handle next question shortcuts
      if (isCorrect === true) {
        // Space or Enter to proceed to next question when correct
        if ((e.key === ' ' || e.key === 'Enter') && !isLoadingNextQuestion) {
          loadCurrentAndPrepareNext();
        }
        return;
      }

      // Number keys 1-4 to select options
      if (e.key >= '1' && e.key <= '4') {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < currentQuestion.options.length) {
          const option = currentQuestion.options[index];
          // Check if this option has already been attempted and is incorrect
          const isAttemptedIncorrect = attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer;
          if (!isAttemptedIncorrect) {
            handleAnswerSubmit(option);
          }
        }
        return;
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        
        const optionsCount = currentQuestion.options.length;
        let newIndex = focusedOptionIndex;
        
        // Get current screen width to determine layout
        const isSmallScreen = window.innerWidth < 640; // sm breakpoint in tailwind is 640px
        
        if (isSmallScreen) {
          // For single column layout (mobile)
          if (e.key === 'ArrowUp') {
            newIndex = focusedOptionIndex > 0 ? focusedOptionIndex - 1 : focusedOptionIndex;
          } else if (e.key === 'ArrowDown') {
            newIndex = focusedOptionIndex < optionsCount - 1 ? focusedOptionIndex + 1 : focusedOptionIndex;
          }
        } else {
          // For two-column layout (desktop/tablet)
          if (e.key === 'ArrowUp') {
            newIndex = (focusedOptionIndex >= 2) ? focusedOptionIndex - 2 : focusedOptionIndex;
          } else if (e.key === 'ArrowDown') {
            newIndex = (focusedOptionIndex < 2 && focusedOptionIndex + 2 < optionsCount) ? focusedOptionIndex + 2 : focusedOptionIndex;
          } else if (e.key === 'ArrowLeft') {
            newIndex = (focusedOptionIndex % 2 === 1) ? focusedOptionIndex - 1 : focusedOptionIndex;
          } else if (e.key === 'ArrowRight') {
            newIndex = (focusedOptionIndex % 2 === 0 && focusedOptionIndex + 1 < optionsCount) ? focusedOptionIndex + 1 : focusedOptionIndex;
          }
        }
        
        // If no option is focused yet, start with the first one
        if (focusedOptionIndex === -1) {
          newIndex = 0;
        }
        
        // Make sure the index is valid
        if (newIndex >= 0 && newIndex < optionsCount) {
          setFocusedOptionIndex(newIndex);
          // Focus the button element
          optionButtonsRef.current[newIndex]?.focus();
        }
        
        return;
      }

      // Enter key to select focused option
      if (e.key === 'Enter' && focusedOptionIndex >= 0 && focusedOptionIndex < currentQuestion.options.length) {
        const option = currentQuestion.options[focusedOptionIndex];
        // Check if this option has already been attempted and is incorrect
        const isAttemptedIncorrect = attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer;
        if (!isAttemptedIncorrect) {
          handleAnswerSubmit(option);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    currentQuestion, 
    focusedOptionIndex, 
    isCorrect, 
    isLoadingCurrentQuestion, 
    isLoadingNextQuestion, 
    attemptedAnswers,
    loadCurrentAndPrepareNext,
    handleAnswerSubmit
  ]);

  // Render loading state while vocabulary is loading
  if (vocabLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
        <span className="ml-2">Loading vocabulary...</span>
      </div>
    );
  }

  // Render warning if not enough words
  if (!hasEnoughWords) {
    return (
      <Alert variant="default" className="border-primary max-w-md mx-auto">
        <Lightbulb className="h-5 w-5 text-primary" />
        <AlertTitle>Not Enough Words</AlertTitle>
        <AlertDescription>
          You need at least 4 unique words in your library to play the Cloze game (1 target word + 3 decoys). 
          Please add more words in the Library tab.
        </AlertDescription>
        <Button onClick={onStopGame} variant="outline" className="mt-4">
          Back to Games Menu
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">Cloze Test</CardTitle>
            {isLoadingNextQuestion && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                <span>Preparing next...</span>
              </div>
            )}
          </div>
          <CardDescription>
            Choose the word that best completes the sentence. 
            Use number keys (1-4) or arrow keys to navigate and Enter to select.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isLoadingCurrentQuestion && (
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
                  const isDisabled = isCorrect || (isAttemptedIncorrect && !isCorrect);
                  const isFocused = focusedOptionIndex === index;
                  
                  let buttonVariant = 'outline';
                  if (isSelected) {
                    buttonVariant = isCorrect ? 'default' : 'destructive';
                  }
                  
                  let buttonClass = `text-base py-5 transition-all duration-200 ease-in-out transform focus:ring-2 focus:ring-primary
                    ${isSelected && isCorrect ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white animate-pulse' : ''}
                    ${isSelected && !isCorrect ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white' : ''}
                    ${isAttemptedIncorrect && !isCorrect ? 'opacity-60 line-through' : ''}
                    ${isFocused ? 'ring ring-primary ring-offset-2' : ''}
                    ${isCorrect ? 'hover:scale-100' : 'hover:scale-105'}`;
                  
                  return (
                    <Button
                      key={index}
                      variant={buttonVariant as any}
                      size="lg"
                      className={buttonClass}
                      onClick={() => handleAnswerSubmit(option)}
                      onFocus={() => setFocusedOptionIndex(index)}
                      ref={el => { optionButtonsRef.current[index] = el; }}
                      disabled={isDisabled}
                      aria-label={`Option ${index + 1}: ${option}`}
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
          
          {!isLoadingCurrentQuestion && !currentQuestion && (
            <Alert variant="default">
              <Info className="h-5 w-5" />
              <AlertTitle>No Question Available</AlertTitle>
              <AlertDescription>
                There might have been an issue loading a question, or you've seen all available ones.
                Try adding more unique words.
              </AlertDescription>
              <Button onClick={loadCurrentAndPrepareNext} className="mt-3">
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
              disabled={isLoadingCurrentQuestion || isLoadingNextQuestion}
            >
              {(isLoadingCurrentQuestion || isLoadingNextQuestion) ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-5 w-5" />
              )} 
              Next Question (Space)
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

export default ClozeGame;