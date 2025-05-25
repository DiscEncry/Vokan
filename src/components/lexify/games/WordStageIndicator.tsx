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
  New: <Sparkles className="mr-1 h-3 w-3" />,
  Learning: <Flame className="mr-1 h-3 w-3" />,
  Review: <ThumbsUp className="mr-1 h-3 w-3" />,
  Relearning: <BadgeCheck className="mr-1 h-3 w-3" />,
  Unknown: <HelpCircle className="mr-1 h-3 w-3" />,
};

/**
 * Unified stage indicator for word state (badge + familiarity dot).
 * Use everywhere instead of StageIndicator or FamiliarityDot.
 */
export const WordStageIndicator: React.FC<{ state: 'New' | 'Learning' | 'Review' | 'Relearning'; className?: string }> = ({ state, className }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className={`inline-flex items-center gap-1 ${className || ''}`}
        aria-label={`Stage: ${STATE_LABELS[state]}`}
      >
        <Badge variant="outline" className={`text-xs px-2 py-1 flex items-center ${state === 'Relearning' ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700' : ''}`.trim()}>
          {STATE_ICONS[state] || STATE_ICONS.Unknown}
          {STATE_LABELS[state]}
        </Badge>
        <svg viewBox="0 0 32 32" className="w-4 h-4 ml-1">
          <circle cx="16" cy="16" r="13" fill="#f3f4f6" />
          <circle
            cx="16" cy="16" r="13"
            fill="none"
            strokeWidth="4"
            className={STATE_COLORS[state]}
            strokeDasharray={2 * Math.PI * 13}
            strokeDashoffset={2 * Math.PI * 13 * (1 - (state === 'New' ? 0.1 : state === 'Learning' ? 0.4 : state === 'Review' ? 0.7 : 1.0))}
            strokeLinecap="round"
          />
        </svg>
      </span>
    </TooltipTrigger>
    <TooltipContent side="top">{STATE_LABELS[state]}</TooltipContent>
  </Tooltip>
);
