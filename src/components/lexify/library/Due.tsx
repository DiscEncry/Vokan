import { CalendarClock } from 'lucide-react';

/**
 * Due badge/icon for words that are due for review.
 * Usage: <Due isDue={true} />
 */
export function Due({ isDue }: { isDue: boolean }) {
  if (!isDue) return null;
  return (
    <span title="Review due!" className="ml-1 text-orange-500 dark:text-orange-300 animate-pulse">
      <CalendarClock className="inline h-4 w-4" />
    </span>
  );
}
