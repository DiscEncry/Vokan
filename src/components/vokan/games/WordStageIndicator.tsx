// Replace the entire WordStageIndicator component in WordStageIndicator.tsx

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sparkles, Flame, ThumbsUp, BadgeCheck, HelpCircle } from "lucide-react";

const STATE_COLORS: Record<string, string> = {
  New: 'stroke-blue-400',
  Learning: 'stroke-yellow-400',
  Review: 'stroke-green-500',
  Relearning: 'stroke-purple-500',
};

const STATE_LABELS: Record<string, string> = {
  New: 'New',
  Learning: 'Learning',
  Review: 'Review',
  Relearning: 'Relearning',
};

const STATE_ICONS: Record<string, React.ReactNode> = {
  New: <Sparkles className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />,
  Learning: <Flame className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />,
  Review: <ThumbsUp className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />,
  Relearning: <BadgeCheck className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />,
  Unknown: <HelpCircle className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />,
};

const STATE_BACKGROUNDS: Record<string, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800',
  Learning: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800',
  Review: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800',
  Relearning: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800',
};

/**
 * Unified stage indicator for word state (badge + familiarity dot).
 * Use everywhere instead of StageIndicator or FamiliarityDot.
 */
export const WordStageIndicator: React.FC<{ 
  state: 'New' | 'Learning' | 'Review' | 'Relearning'; 
  className?: string;
  compact?: boolean; // New prop for mobile-first compact mode
}> = ({ state, className, compact = false }) => {
  
  const progress = state === 'New' ? 0.1 : state === 'Learning' ? 0.4 : state === 'Review' ? 0.7 : 1.0;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span 
          className={`inline-flex items-center gap-1 sm:gap-2 ${className || ''}`}
          aria-label={`Stage: ${STATE_LABELS[state]}`}
        >
          <Badge 
            variant="outline" 
            className={`
              ${compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'} 
              flex items-center font-medium shadow-sm
              ${STATE_BACKGROUNDS[state]}
            `.trim()}
          >
            {STATE_ICONS[state] || STATE_ICONS.Unknown}
            <span className={compact ? 'hidden sm:inline' : ''}>
              {STATE_LABELS[state]}
            </span>
            
            {/* Familiarity/progress dot moved inside the badge, next to the label */}
            <svg viewBox="0 0 32 32" className={compact ? "w-3 h-3 sm:w-4 sm:h-4 ml-1" : "w-4 h-4 ml-1"}>
              <circle 
                cx="16" 
                cy="16" 
                r="13" 
                fill="currentColor" 
                className="text-muted/20"
              />
              <circle
                cx="16" 
                cy="16" 
                r="13"
                fill="none"
                strokeWidth="4"
                className={STATE_COLORS[state]}
                strokeDasharray={2 * Math.PI * 13}
                strokeDashoffset={2 * Math.PI * 13 * (1 - progress)}
                strokeLinecap="round"
              />
            </svg>
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="font-medium">{STATE_LABELS[state]}</div>
        <div className="text-xs opacity-90">
          {state === 'New' && 'Just added to your library'}
          {state === 'Learning' && 'Currently being learned'}
          {state === 'Review' && 'Ready for review'}
          {state === 'Relearning' && 'Needs more practice'}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};