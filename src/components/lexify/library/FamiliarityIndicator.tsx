
"use client";

import type { FC } from 'react';
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { FamiliarityLevel } from '@/types';
import { Sparkles, Flame, ThumbsUp, BadgeCheck, HelpCircle } from 'lucide-react';

// This component is now part of WordList.tsx and can be removed if not used elsewhere.
// For now, keeping it as it might be useful for other parts of the app or refactoring.
const FamiliarityIndicator: FC<{ level: FamiliarityLevel }> = memo(({ level }) => {
  switch (level) {
    case 'New':
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700"><Sparkles className="mr-1 h-3 w-3" />New</Badge>;
    case 'Learning':
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700"><Flame className="mr-1 h-3 w-3" />Learning</Badge>;
    case 'Familiar':
      return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700"><ThumbsUp className="mr-1 h-3 w-3" />Familiar</Badge>;
    case 'Mastered':
      return <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700"><BadgeCheck className="mr-1 h-3 w-3" />Mastered</Badge>;
    default:
      return <Badge variant="secondary"><HelpCircle className="mr-1 h-3 w-3" />Unknown</Badge>;
  }
});

FamiliarityIndicator.displayName = 'FamiliarityIndicator';

export default FamiliarityIndicator;
