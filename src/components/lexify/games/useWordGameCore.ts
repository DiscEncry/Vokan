import { useRef, useState, useCallback } from 'react';
import type { Word } from '@/types';
import { useGameEngine } from './useGameEngine';
import { useWordDetailsPanelState } from './useWordDetailsPanelState';
import { useWordDetails } from './useWordDetails';
import { useVocabulary } from '@/context/VocabularyContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Shared hook for core word game logic (question state, loading, abort, lifecycle, details panel).
 * Used by both TextInputGame and ClozeGame.
 */
export function useWordGameCore<TQuestion>({
  minWords,
  generateSingleQuestion,
  getDecoyWords,
}: {
  minWords: number;
  generateSingleQuestion: (targetWord: Word, abortController: AbortController) => Promise<TQuestion | null>;
  getDecoyWords?: (targetId: string, count: number) => Word[];
}) {
  // Game engine (words, selection, etc)
  const {
    libraryWords,
    isMounted,
    gameInitialized,
    setGameInitialized,
    safeSetState,
    hasEnoughWords,
    selectTargetWord,
    vocabLoading,
  } = useGameEngine({ minWords });

  // Word details panel
  const wordDetailsApi = useWordDetails();
  const { showDetails, detailsWord, showPanelForWord, resetPanel } = useWordDetailsPanelState();

  // SRS update, decoys, toast
  const { updateWordSRS } = useVocabulary();
  const { toast } = useToast();

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<TQuestion | null>(null);
  const [nextQuestion, setNextQuestion] = useState<TQuestion | null>(null);
  const [isLoadingCurrentQuestion, setIsLoadingCurrentQuestion] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);

  // Abort controllers
  const currentQuestionAbortController = useRef<AbortController | null>(null);
  const nextQuestionAbortController = useRef<AbortController | null>(null);

  // Game lifecycle helpers
  const isLoadingTransition = useRef(false);

  // Reset question state (to be extended by game)
  const resetQuestionState = useCallback(() => {
    safeSetState<TQuestion | null>(setCurrentQuestion, null);
    safeSetState<TQuestion | null>(setNextQuestion, null);
    resetPanel();
  }, [safeSetState, resetPanel]);

  // Prefetch next question
  const fetchAndStoreNextQuestion = useCallback(async () => {
    nextQuestionAbortController.current?.abort('Next question fetch aborted');
    nextQuestionAbortController.current = new AbortController();
    const targetWordObj = selectTargetWord();
    if (!targetWordObj) {
      safeSetState<boolean>(setIsLoadingNextQuestion, false);
      return;
    }
    safeSetState<boolean>(setIsLoadingNextQuestion, true);
    try {
      const question = await generateSingleQuestion(targetWordObj, nextQuestionAbortController.current);
      if (isMounted.current) {
        safeSetState<TQuestion | null>(setNextQuestion, question);
      }
    } catch {
      // Error handling is in generateSingleQuestion
    } finally {
      if (isMounted.current) safeSetState<boolean>(setIsLoadingNextQuestion, false);
    }
  }, [selectTargetWord, generateSingleQuestion, isMounted, safeSetState]);

  // Load current and prepare next
  const loadCurrentAndPrepareNext = useCallback(async () => {
    if (!isMounted.current || vocabLoading || !hasEnoughWords || isLoadingTransition.current) return;
    isLoadingTransition.current = true;
    currentQuestionAbortController.current?.abort('New current question load');
    currentQuestionAbortController.current = new AbortController();
    resetQuestionState();
    safeSetState<boolean>(setIsLoadingCurrentQuestion, true);
    let questionToLoad: TQuestion | null = null;
    if (nextQuestion) {
      questionToLoad = nextQuestion;
      safeSetState<TQuestion | null>(setCurrentQuestion, questionToLoad);
      safeSetState<TQuestion | null>(setNextQuestion, null);
      safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
      fetchAndStoreNextQuestion();
    } else {
      const targetWordObj = selectTargetWord();
      if (!targetWordObj) {
        safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
        isLoadingTransition.current = false;
        return;
      }
      try {
        questionToLoad = await generateSingleQuestion(targetWordObj, currentQuestionAbortController.current);
        if (isMounted.current) {
          safeSetState<TQuestion | null>(setCurrentQuestion, questionToLoad);
          if (questionToLoad) fetchAndStoreNextQuestion();
        }
      } catch {
        // Error handling is in generateSingleQuestion
      } finally {
        if (isMounted.current) safeSetState<boolean>(setIsLoadingCurrentQuestion, false);
      }
    }
    isLoadingTransition.current = false;
  }, [isMounted, vocabLoading, hasEnoughWords, isLoadingTransition, nextQuestion, selectTargetWord, generateSingleQuestion, fetchAndStoreNextQuestion, resetQuestionState, safeSetState]);

  return {
    // Game engine
    libraryWords,
    isMounted,
    gameInitialized,
    setGameInitialized,
    safeSetState,
    hasEnoughWords,
    selectTargetWord,
    vocabLoading,
    // Question state
    currentQuestion,
    setCurrentQuestion,
    nextQuestion,
    setNextQuestion,
    isLoadingCurrentQuestion,
    setIsLoadingCurrentQuestion,
    isLoadingNextQuestion,
    setIsLoadingNextQuestion,
    // Abort controllers
    currentQuestionAbortController,
    nextQuestionAbortController,
    isLoadingTransition,
    // Lifecycle
    resetQuestionState,
    fetchAndStoreNextQuestion,
    loadCurrentAndPrepareNext,
    // Details panel
    wordDetailsApi,
    showDetails,
    detailsWord,
    showPanelForWord,
    resetPanel,
    // SRS, decoys, toast
    updateWordSRS,
    getDecoyWords,
    toast,
  };
}
