import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

const STATE_PROGRESS: Record<string, number> = {
  New: 0.1,
  Learning: 0.4,
  Review: 0.7,
  Relearning: 1.0,
};

export const FamiliarityDot: React.FC<{ state: 'New' | 'Learning' | 'Review' | 'Relearning'; className?: string }> = ({ state, className }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className={`inline-flex items-center justify-center w-6 h-6 relative ${className || ''}`}
        aria-label={`Stage: ${STATE_LABELS[state]}`}
      >
        <svg viewBox="0 0 32 32" className="w-6 h-6">
          <circle cx="16" cy="16" r="13" fill="#f3f4f6" />
          <circle
            cx="16" cy="16" r="13"
            fill="none"
            strokeWidth="4"
            className={STATE_COLORS[state]}
            strokeDasharray={2 * Math.PI * 13}
            strokeDashoffset={2 * Math.PI * 13 * (1 - STATE_PROGRESS[state])}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
          {STATE_LABELS[state][0]}
        </span>
      </span>
    </TooltipTrigger>
    <TooltipContent side="top">{STATE_LABELS[state]}</TooltipContent>
  </Tooltip>
);

export default FamiliarityDot;
