"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Lightbulb, RefreshCw } from 'lucide-react';
import WordDetailPanel from './WordDetailPanel';
import { useVocabulary } from '@/context/VocabularyContext';
import type { Word, ClozeQuestion as ClozeQuestionType, GeneratedWordDetails } from '@/types';
import { generateClozeQuestion } from '@/ai/flows/generate-cloze-question';
import { generateWordDetails } from '@/ai/flows/generate-word-details';
import { useToast } from '@/hooks/use-toast';

const ClozeGame: FC = () => {
  const { words: libraryWords, updateWordFamiliarity, getDecoyWords, isLoading: vocabLoading } = useVocabulary();
  const { toast } = useToast();

  const [currentQuestion, setCurrentQuestion] = useState<ClozeQuestionType | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [wordDetails, setWordDetails] = useState<GeneratedWordDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [attemptedAnswers, setAttemptedAnswers] = useState<string[]>([]);

  const fetchNewQuestion = useCallback(async () => {
    if (vocabLoading || libraryWords.length < 4) { // Need at least 1 target + 3 decoys
      return;
    }
    
    setIsLoadingQuestion(true);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setWordDetails(null);
    setShowDetails(false);
    setAttemptedAnswers([]);

    // Simple SRS: pick a word that's 'New' or 'Learning', or random if none.
    // A real FSRS would be more complex.
    let targetWord = libraryWords.find(w => w.familiarity === 'New' || w.familiarity === 'Learning');
    if (!targetWord) {
      targetWord = libraryWords[Math.floor(Math.random() * libraryWords.length)];
    }
    
    if (!targetWord) {
        toast({ title: "No words", description: "Add words to your library to play.", variant: "destructive"});
        setIsLoadingQuestion(false);
        return;
    }

    const decoys = getDecoyWords(targetWord.id, 3);
    if (decoys.length < 3) {
        toast({ title: "Not enough decoy words", description: "Add at least 4 unique words to your library.", variant: "destructive"});
        setIsLoadingQuestion(false);
        return;
    }
    
    const decoyTexts = decoys.map(d => d.text);

    try {
      const aiInput = { word: targetWord.text, libraryWords: decoyTexts };
      const clozeData = await generateClozeQuestion(aiInput);
      
      // Shuffle options, ensuring targetWord.text is one of them
      const options = [...clozeData.options];
      if (!options.includes(targetWord.text)) { // AI might not include it if libraryWords was empty or small
          options.pop(); // remove one to make space
          options.push(targetWord.text);
      }
      const shuffledOptions = options.sort(() => 0.5 - Math.random()).slice(0,4);


      setCurrentQuestion({
        sentenceWithBlank: clozeData.sentence,
        options: shuffledOptions,
        correctAnswer: targetWord.text,
        targetWord: targetWord.text, // This is the actual word object for familiarity update
      });
    } catch (error) {
      console.error("Error generating cloze question:", error);
      toast({ title: "AI Error", description: "Could not generate a question. Please try again.", variant: "destructive" });
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [libraryWords, vocabLoading, getDecoyWords, toast]);

  useEffect(() => {
    if (!vocabLoading && libraryWords.length > 0) {
      fetchNewQuestion();
    }
  }, [vocabLoading, libraryWords.length, fetchNewQuestion]); // libraryWords.length to re-trigger if words are added/removed

  const handleAnswerSubmit = async (answer: string) => {
    if (!currentQuestion || isCorrect) return;

    setSelectedAnswer(answer);
    setAttemptedAnswers(prev => [...prev, answer]);
    const correct = answer === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      toast({ title: "Correct!", description: `"${answer}" is the right word.`, className: "bg-green-500 text-white" });
      // Update familiarity based on attempts
      const targetWordObject = libraryWords.find(w => w.text === currentQuestion.targetWord);
      if (targetWordObject) {
          const familiarity = attemptedAnswers.length === 0 ? 'Familiar' : 'Learning'; // Simplified SRS logic
          updateWordFamiliarity(targetWordObject.id, familiarity);
      }

      // Fetch word details
      setIsLoadingDetails(true);
      try {
        const detailsData = await generateWordDetails({ word: currentQuestion.targetWord });
        setWordDetails(detailsData);
        setShowDetails(true);
      } catch (error) {
        console.error("Error fetching word details:", error);
        toast({ title: "AI Error", description: "Could not fetch word details.", variant: "destructive" });
      } finally {
        setIsLoadingDetails(false);
      }
    } else {
      toast({ title: "Incorrect", description: `"${answer}" is not the right word. Try again!`, variant: "destructive" });
    }
  };
  
  if (vocabLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading vocabulary...</span></div>;
  }

  if (libraryWords.length < 4) {
    return (
      <Alert variant="default" className="border-primary">
        <Lightbulb className="h-5 w-5 text-primary" />
        <AlertTitle>Not Enough Words</AlertTitle>
        <AlertDescription>
          You need at least 4 words in your library to play the Cloze game (1 target word + 3 decoys). 
          Please add more words in the Library tab.
        </AlertDescription>
      </Alert>
    );
  }
  

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Cloze Test: Fill in the Blank</CardTitle>
          <CardDescription>Choose the word that best completes the sentence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingQuestion && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-lg text-muted-foreground">Generating new question...</p>
            </div>
          )}
          {!isLoadingQuestion && currentQuestion && (
            <>
              <p className="text-xl md:text-2xl text-center p-6 bg-muted rounded-lg shadow-inner min-h-[80px] flex items-center justify-center">
                {currentQuestion.sentenceWithBlank.replace("___", " ______ ")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {currentQuestion.options.map((option, index) => (
                  <Button
                    key={index}
                    variant={
                      selectedAnswer === option 
                        ? (isCorrect ? 'default' : 'destructive') 
                        : (attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer ? 'outline' : 'outline')
                    }
                    size="lg"
                    className={`text-base py-6 transition-all duration-300 ease-in-out transform hover:scale-105 focus:ring-2 focus:ring-primary
                      ${selectedAnswer === option && isCorrect ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white animate-pulse' : ''}
                      ${selectedAnswer === option && !isCorrect ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white' : ''}
                      ${attemptedAnswers.includes(option) && option !== currentQuestion.correctAnswer && !isCorrect ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => handleAnswerSubmit(option)}
                    disabled={isCorrect !== null && (isCorrect || attemptedAnswers.includes(option))}
                    aria-label={`Choose ${option}`}
                  >
                    {selectedAnswer === option && isCorrect && <CheckCircle className="mr-2 h-5 w-5" />}
                    {selectedAnswer === option && !isCorrect && <XCircle className="mr-2 h-5 w-5" />}
                    {option}
                  </Button>
                ))}
              </div>
            </>
          )}
          {!isLoadingQuestion && !currentQuestion && (
             <Alert variant="default">
                <Lightbulb className="h-5 w-5" />
                <AlertTitle>Ready to Play?</AlertTitle>
                <AlertDescription>
                Click "Next Question" to start or if there was an issue loading.
                </AlertDescription>
            </Alert>
          )}
           {isCorrect && (
            <Button onClick={fetchNewQuestion} className="w-full mt-6" size="lg" variant="default">
              <RefreshCw className="mr-2 h-5 w-5" /> Next Question
            </Button>
          )}
        </CardContent>
      </Card>

      {showDetails && <WordDetailPanel wordDetails={wordDetails} isLoading={isLoadingDetails} />}
    </div>
  );
};

export default ClozeGame;
