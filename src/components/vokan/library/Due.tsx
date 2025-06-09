import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CalendarClock } from 'lucide-react';

/**
 * Due badge/icon for words that are due for review.
 * Usage: <Due isDue={true} />
 */
export function Due({ isDue }: { isDue: boolean }) {
  if (!isDue) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-1 inline-flex items-center">
          <Badge variant="outline" className="px-1.5 py-0.5 text-xs flex items-center gap-1 border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700 animate-pulse">
            <CalendarClock className="h-3 w-3 mr-1" />
            Due
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Review due!</TooltipContent>
    </Tooltip>
  );
}
