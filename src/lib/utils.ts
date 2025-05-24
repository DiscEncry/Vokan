import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns true if the given due date is today or earlier.
 */
export function isDue(due: string | undefined | null): boolean {
  if (!due) return false;
  const dueDate = new Date(due);
  const now = new Date();
  dueDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return dueDate <= now;
}

/**
 * Append a quiz/game result to localStorage (keeps last 200).
 */
export function logQuizResult(
  result: {
    word: string;
    correct: boolean;
    duration: number;
    game: string;
    timestamp: number;
  }
) {
  const QUIZ_LOG_KEY = "lexify-quiz-log-v1";
  try {
    const prev = JSON.parse(localStorage.getItem(QUIZ_LOG_KEY) || "[]");
    prev.push(result);
    while (prev.length > 200) prev.shift();
    localStorage.setItem(QUIZ_LOG_KEY, JSON.stringify(prev));
  } catch {}
}
