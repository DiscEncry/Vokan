import type { Word } from '@/types';

export interface StageDistributionDatum {
  name: string;
  value: number;
  percent: number;
  state: 'New' | 'Learning' | 'Review' | 'Relearning';
}

export function getStageDistribution(words: Word[]): StageDistributionDatum[] {
  const LABELS: Record<string, string> = {
    New: 'New',
    Learning: 'Learning',
    Review: 'Review',
    Relearning: 'Relearning',
  };
  const counts: Record<string, number> = { New: 0, Learning: 0, Review: 0, Relearning: 0 };
  words.forEach(word => { counts[word.fsrsCard.state]++; });
  const total = words.length || 1;
  return (Object.keys(counts) as Array<'New' | 'Learning' | 'Review' | 'Relearning'>)
    .map(state => ({
      name: LABELS[state],
      value: counts[state],
      percent: Math.round((counts[state] / total) * 100),
      state,
    }))
    .filter(item => item.value > 0);
}
