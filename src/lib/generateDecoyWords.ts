import type { Word } from '@/types';

/**
 * Shared utility to generate decoy words for a question.
 * Excludes the target word and returns a shuffled array of decoys.
 */
export function generateDecoyWords(words: Word[], targetWordId: string, count: number): Word[] {
  const availableCount = Math.min(count, words.length > 0 ? words.length - 1 : 0);
  if (availableCount <= 0) return [];
  return words.filter(word => word.id !== targetWordId).sort(() => 0.5 - Math.random()).slice(0, availableCount);
}
