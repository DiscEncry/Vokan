// src/lib/srs.ts

import type { Word, FamiliarityLevel } from '@/types';

/**
 * This is a placeholder for FSRS v4.5 or any other Spaced Repetition System logic.
 * The actual implementation of FSRS is complex and involves concepts like:
 * - Card states (New, Learning, Review, Relearning)
 * - Review outcomes (Again, Hard, Good, Easy)
 * - Stability (how long a card is likely to be remembered)
 * - Difficulty (how hard a card is intrinsically)
 * - Scheduling next review based on these parameters.
 *
 * For the current scope, we're simplifying familiarity updates directly.
 * A full SRS implementation would update Word's srsData and nextReviewDate.
 */

export interface FSRSParameters {
  requestRetention: number; // e.g., 0.9 (90% desired retention rate)
  maximumInterval: number; // e.g., 36500 (100 years in days)
  // ... other FSRS-specific parameters
}

export interface SRSCardState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: 'New' | 'Learning' | 'Review' | 'Relearning';
  last_review?: Date;
}

// Placeholder function to get the next word to review
export const getNextWordForReview = (words: Word[]): Word | null => {
  if (words.length === 0) return null;

  // Simple logic: prioritize 'New', then 'Learning', then by oldest 'lastReviewed' or 'dateAdded'
  const sortedWords = [...words].sort((a, b) => {
    const familiarityOrder = { New: 0, Learning: 1, Familiar: 2, Mastered: 3 };
    if (familiarityOrder[a.familiarity] !== familiarityOrder[b.familiarity]) {
      return familiarityOrder[a.familiarity] - familiarityOrder[b.familiarity];
    }
    const dateA = a.lastReviewed ? new Date(a.lastReviewed) : new Date(a.dateAdded);
    const dateB = b.lastReviewed ? new Date(b.lastReviewed) : new Date(b.dateAdded);
    return dateA.getTime() - dateB.getTime(); // Oldest first
  });

  return sortedWords[0];
};

// Placeholder function to update a word's SRS state after a review
export const updateSRSData = (
  word: Word, 
  outcome: 'CorrectFirstTry' | 'CorrectMultiTry' | 'Incorrect' // Simplified outcomes
): Word => {
  // This would interact with FSRS algorithm to update stability, difficulty, next review date.
  // For now, we link this to familiarity in the VocabularyContext.
  let newFamiliarity: FamiliarityLevel = word.familiarity;
  if (outcome === 'CorrectFirstTry') {
    if (word.familiarity === 'New') newFamiliarity = 'Learning';
    else if (word.familiarity === 'Learning') newFamiliarity = 'Familiar';
    else if (word.familiarity === 'Familiar') newFamiliarity = 'Mastered';
  } else if (outcome === 'CorrectMultiTry') {
    if (word.familiarity === 'New') newFamiliarity = 'Learning';
    else if (word.familiarity === 'Mastered') newFamiliarity = 'Familiar';
    // Stays 'Learning' or 'Familiar' if already there
  } else if (outcome === 'Incorrect') {
    if (word.familiarity === 'Mastered') newFamiliarity = 'Familiar';
    else if (word.familiarity === 'Familiar') newFamiliarity = 'Learning';
    // Stays 'Learning' or 'New'
  }

  return {
    ...word,
    familiarity: newFamiliarity,
    lastReviewed: new Date().toISOString(),
    // nextReviewDate would be calculated by FSRS
  };
};

// Note: A full FSRS implementation would require importing or writing the FSRS algorithm itself.
// See https://github.com/open-spaced-repetition/fsrs4anki for reference.
