import { useState, useCallback, useRef } from 'react';

/**
 * Shared hook for answer/attempt/hint state in word games.
 * Handles answer state, attempts, hint reveal, and correct/incorrect logic.
 */
export function useWordGameAnswerState<T extends { correctAnswer: string }>() {
  const [userInput, setUserInput] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const startTime = useRef<number | null>(null);

  const resetAnswerState = useCallback(() => {
    setUserInput('');
    setIsCorrect(null);
    setAttempts(0);
    setHintRevealed(false);
    setHintUsed(false);
    setShowCorrectAnswer(false);
    startTime.current = null;
  }, []);

  // Hint reveal logic for text input games
  const revealHint = useCallback((question: T) => {
    if (!question || hintRevealed || isCorrect !== null) return;
    let firstDiffIndex = -1;
    for (let i = 0; i < question.correctAnswer.length; i++) {
      if (i >= userInput.length || userInput[i].toLowerCase() !== question.correctAnswer[i].toLowerCase()) {
        firstDiffIndex = i;
        break;
      }
    }
    if (firstDiffIndex === -1 && userInput.length >= question.correctAnswer.length) return;
    const revealUpToIndex = firstDiffIndex === -1 ? question.correctAnswer.length : firstDiffIndex + 1;
    if (revealUpToIndex > question.correctAnswer.length) return;
    const revealedPortion = question.correctAnswer.substring(0, revealUpToIndex);
    setUserInput(revealedPortion);
    setHintRevealed(true);
    setHintUsed(true);
    return revealedPortion;
  }, [userInput, hintRevealed, isCorrect]);

  return {
    userInput,
    setUserInput,
    isCorrect,
    setIsCorrect,
    attempts,
    setAttempts,
    hintRevealed,
    setHintRevealed,
    hintUsed,
    setHintUsed,
    showCorrectAnswer,
    setShowCorrectAnswer,
    startTime,
    resetAnswerState,
    revealHint,
  };
}
