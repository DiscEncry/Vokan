
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

  const [currentQuestion, setCurrentQuestion] = useState<ClozeQuestionType | null>(null);
  const [nextQuestion, setNextQuestion] = useState<ClozeQuestionType | null>(null);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  const [isLoadingCurrentQuestion, setIsLoadingCurrentQuestion] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [wordDetails, setWordDetails] = useState<GeneratedWordDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [attemptedAnswers, setAttemptedAnswers] = useState<string[]>([]);

  const isMounted = useRef(true); // To prevent state updates on unmounted component

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const selectTargetWord = useCallback((excludeWordId?: string): Word | null => {
    let eligibleWords = libraryWords;
    if (excludeWordId) {
        eligibleWords = libraryWords.filter(w => w.id !== excludeWordId && w.text !== currentQuestion?.targetWord);
    }
    if (eligibleWords.length === 0) return null;

    let targetWord = eligibleWords.find(w => w.familiarity === 'New' || w.familiarity === 'Learning');
    if (!targetWord) {
      targetWord = eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
    }
    return targetWord;
  }, [libraryWords, currentQuestion]);


  const generateSingleQuestion = useCallback(async (targetWord: Word): Promise<ClozeQuestionType | null> => {
    if (!targetWord) return null;

    const decoys = getDecoyWords(targetWord.id, 3);
    if (decoys.length < 3) {
      toast({ title: "Not enough decoy words", description: `Need at least 3 decoys, found ${decoys.length}. Add more words.`, variant: "destructive"});
      return null;
    }
    const decoyTexts = decoys.map(d => d.text);

    try {
      const aiInput = { word: targetWord.text, libraryWords: decoyTexts };
      const clozeData = await generateClozeQuestion(aiInput);
      
      const options = [...clozeData.options];
      if (!options.includes(targetWord.text)) {
          options.pop(); 
          options.push(targetWord.text);
      }
      const shuffledOptions = options.sort(() => 0.5 - Math.random()).slice(0,4);
      if (!shuffledOptions.includes(targetWord.text) && shuffledOptions.length === 4) {
        shuffledOptions[Math.floor(Math.random() * 4)] = targetWord.text; // Ensure target word is an option
      }


      return {
        sentenceWithBlank: clozeData.sentence,
        options: shuffledOptions,
        correctAnswer: targetWord.text,
        targetWord: targetWord.text,
      };
    } catch (error) {
      console.error("Error generating cloze question:", error);
      toast({ title: "AI Error", description: "Could not generate a question. Please try again.", variant: "destructive" });
      return null;
    }
  }, [getDecoyWords, toast]);

  const fetchAndStoreNextQuestion = useCallback(async () => {
    if (vocabLoading || libraryWords.length < 4 || !isMounted.current) return;
    
    const nextTargetWord = selectTargetWord(currentQuestion?.targetWord);
    if (!nextTargetWord) {
        if(libraryWords.length >=4 ) { // Only toast if there should be words but selection failed
            toast({ title: "No suitable next word", description: "Could not find a different word for the next question.", variant: "default" });
        }
        return;
    }

    setIsLoadingNextQuestion(true);
    const question = await generateSingleQuestion(nextTargetWord);
    if (isMounted.current) {
        setNextQuestion(question);
        setIsLoadingNextQuestion(false);
    }
  }, [vocabLoading, libraryWords.length, generateSingleQuestion, selectTargetWord, currentQuestion, toast]);

  const loadCurrentAndPrepareNext = useCallback(async () => {
    if (!isMounted.current || vocabLoading || libraryWords.length < 4) return;

    setIsLoadingCurrentQuestion(true);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setWordDetails(null);
    setShowDetails(false);
    setAttemptedAnswers([]);

    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setNextQuestion(null); // Consume the pre-generated question
      setIsLoadingCurrentQuestion(false);
      fetchAndStoreNextQuestion(); // Start fetching the next one
    } else {
      // First load or if pre-generation failed/wasn't ready
      const initialTargetWord = selectTargetWord();
      if (!initialTargetWord) {
        toast({ title: "No words to start", description: "Please add at least 4 words to your library.", variant: "destructive" });
        setIsLoadingCurrentQuestion(false);
        return;
      }
      const question = await generateSingleQuestion(initialTargetWord);
       if (isMounted.current) {
        setCurrentQuestion(question);
        setIsLoadingCurrentQuestion(false);
        if (question) { // Only fetch next if current succeeded
            fetchAndStoreNextQuestion();
        }
      }
    }
  }, [nextQuestion, vocabLoading, libraryWords.length, selectTargetWord, generateSingleQuestion, fetchAndStoreNextQuestion, toast]);


  useEffect(() => {
    if (!vocabLoading && libraryWords.length >= 4) {
      loadCurrentAndPrepareNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabLoading, libraryWords.length]); // Deliberately not including loadCurrentAndPrepareNext to avoid re-trigger loops

  const handleAnswerSubmit = async (answer: string) => {
    if (!currentQuestion || isCorrect) return;

    setSelectedAnswer(answer);
    setAttemptedAnswers(prev => [...prev, answer]);
    const correct = answer === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      toast({ title: "Correct!", description: `"${answer}" is the right word.`, className: "bg-green-500 text-white" });
      const targetWordObject = libraryWords.find(w => w.text === currentQuestion.targetWord);
      if (targetWordObject) {
          const familiarity = attemptedAnswers.length === 0 ? 'Familiar' : 'Learning'; 
          updateWordFamiliarity(targetWordObject.id, familiarity);
      }

      setIsLoadingDetails(true);
      setShowDetails(true); // Show panel with loading state first
      try {
        const detailsData = await generateWordDetails({ word: currentQuestion.targetWord });
        if (isMounted.current) setWordDetails(detailsData);
      } catch (error) {
        console.error("Error fetching word details:", error);
        if (isMounted.current) toast({ title: "AI Error", description: "Could not fetch word details.", variant: "destructive" });
      } finally {
        if (isMounted.current) setIsLoadingDetails(false);
      }
    } else {
      toast({ title: "Incorrect", description: `"${answer}" is not the right word. Try again!`, variant: "destructive" });
    }
  };
  
  if (vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading vocabulary...</span></div>;
  }

  if (libraryWords.length < 4 && !vocabLoading) {
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
            {isLoadingNextQuestion && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" title="Preparing next question..." />}
          </div>
          <CardDescription>Choose the word that best completes the sentence.</CardDescription>
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
                {currentQuestion.sentenceWithBlank.replace("___", " ______ ")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isAttemptedIncorrect = attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer;
                  
                  return (
                    <Button
                      key={index}
                      variant={
                        isSelected
                          ? (isCorrect ? 'default' : 'destructive') 
                          : (isAttemptedIncorrect && !isCorrect ? 'outline' : 'outline') // Keep outline if attempted and wrong, but not current selection
                      }
                      size="lg"
                      className={`text-base py-5 transition-all duration-200 ease-in-out transform focus:ring-2 focus:ring-primary
                        ${isSelected && isCorrect ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white animate-pulse' : ''}
                        ${isSelected && !isCorrect ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white' : ''}
                        ${isAttemptedIncorrect && !isCorrect ? 'opacity-60 line-through' : ''}
                        ${isCorrect ? 'hover:scale-100' : 'hover:scale-105'} 
                      `}
                      onClick={() => handleAnswerSubmit(option)}
                      disabled={isCorrect || (isAttemptedIncorrect && !isCorrect)} // Disable if overall correct OR if this specific option was a wrong attempt
                      aria-label={`Choose ${option}`}
                    >
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
                  There might have been an issue loading a question, or you've seen all available ones. Try adding more unique words.
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
            {isCorrect && ( // Only show Next Question if correct
                <Button onClick={loadCurrentAndPrepareNext} className="w-full sm:w-auto" size="lg" variant="default" disabled={isLoadingCurrentQuestion || isLoadingNextQuestion}>
                    {isLoadingCurrentQuestion || isLoadingNextQuestion ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />} 
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

export default ClozeGame;
