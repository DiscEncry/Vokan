import type { Word } from '@/types';

export interface WordStats {
  totalWords: number;
  New: number;
  Learning: number;
  Review: number;
  Relearning: number;
  avgState: number;
  leveledUpToday: number;
  leveledDownToday: number;
  addedToday: number;
}

export function getWordStats(words: Word[]): WordStats {
  const byState: Record<'New' | 'Learning' | 'Review' | 'Relearning', number> = {
    New: 0,
    Learning: 0,
    Review: 0,
    Relearning: 0,
  };
  let stateSum = 0;
  let leveledUpToday = 0;
  let leveledDownToday = 0;
  let addedToday = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  words.forEach(w => {
    byState[w.fsrsCard.state]++;
    const stateScore = w.fsrsCard.state === 'New' ? 1 : w.fsrsCard.state === 'Learning' ? 2 : w.fsrsCard.state === 'Review' ? 3 : 4;
    stateSum += stateScore;
    if (w.fsrsCard.last_review) {
      const reviewedDate = new Date(w.fsrsCard.last_review);
      reviewedDate.setHours(0, 0, 0, 0);
      if (reviewedDate.getTime() === today.getTime() && w.fsrsCard.state !== 'New') {
        if (w.fsrsCard.reviewChange === 'up') {
          leveledUpToday++;
        } else if (w.fsrsCard.reviewChange === 'down') {
          leveledDownToday++;
        }
      }
    }
    const addedDate = new Date(w.dateAdded);
    addedDate.setHours(0, 0, 0, 0);
    if (addedDate.getTime() === today.getTime()) {
      addedToday++;
    }
  });
  const avgState = words.length ? stateSum / words.length : 0;
  return {
    totalWords: words.length,
    ...byState,
    avgState,
    leveledUpToday,
    leveledDownToday,
    addedToday,
  };
}
