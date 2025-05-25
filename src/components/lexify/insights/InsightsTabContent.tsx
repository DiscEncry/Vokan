"use client";

import { memo, useMemo, type FC, useEffect, useState } from 'react';
import { useVocabulary } from '@/context/VocabularyContext';
import StatsCard from './StatsCard';
import StageDistributionDonutChart from './FamiliarityPieChart';
import { BookOpen, BarChartBig, Brain, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from 'react-error-boundary';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import React from 'react';
import { EmptyState } from "@/components/ui/EmptyState";
import { getQuizLog, QuizLogEntry } from '@/lib/utils';
import { getWordStats } from './getWordStats';

// --- Placeholder implementations for missing functions ---
function getSessionStats(words: any[]) {
  // Example: return total words and session time (dummy)
  return {
    totalWords: words.length,
    sessionTime: 0,
  };
}

function getMasteryForecast(words: any[]) {
  // Example: return dummy forecast values
  return {
    estDaysToMastery: null,
    avgLeveledUp: 0,
    notMastered: words.length,
  };
}

// Error fallback component for charts
const ChartErrorFallback: FC<{ error: Error; resetErrorBoundary: () => void }> = ({ error }) => (
  <Alert variant="destructive" className="h-full min-h-[380px] flex flex-col justify-center items-center">
    <AlertTriangle className="h-6 w-6" />
    <AlertTitle className="mt-2">Chart Error</AlertTitle>
    <AlertDescription className="text-center">
      There was an error loading this visualization.
      <div className="mt-2">
        <pre className="text-xs overflow-auto max-w-full max-h-[100px]">{error.message}</pre>
      </div>
    </AlertDescription>
  </Alert>
);

// Loading state component
const LoadingState: FC = () => (
  <div className="space-y-6 p-2 sm:p-4 md:p-6">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Skeleton className="h-[120px] rounded-lg" />
      <Skeleton className="h-[120px] rounded-lg" />
      <Skeleton className="h-[120px] rounded-lg" />
      <Skeleton className="h-[120px] rounded-lg" />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-[380px] rounded-lg" />
      <Skeleton className="h-[380px] rounded-lg" />
    </div>
  </div>
);

// --- Calendar Heatmap for Study Streaks ---
function getHeatmapData(months = 12) {
  const log: QuizLogEntry[] = getQuizLog();
  const today = new Date();
  const start = new Date(today);
  start.setMonth(today.getMonth() - months + 1);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const days: { date: string; count: number }[] = [];
  const dayMap: Record<string, number> = {};
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dayMap[key] = 0;
  }
  log.forEach((entry) => {
    const d = new Date(entry.timestamp);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    if (key in dayMap) dayMap[key]++;
  });
  Object.entries(dayMap).forEach(([date, count]) => days.push({ date, count }));
  return days;
}

function getStreak(heatmap: { date: string; count: number }[]) {
  let maxStreak = 0, curStreak = 0, streak = 0;
  for (let i = 0; i < heatmap.length; i++) {
    if (heatmap[i].count > 0) {
      curStreak++;
      if (curStreak > maxStreak) maxStreak = curStreak;
    } else {
      curStreak = 0;
    }
  }
  // Current streak (ending today)
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i].count > 0) streak++;
    else break;
  }
  return { maxStreak, streak };
}

const CalendarHeatmap: FC = () => {
  const days = getHeatmapData(12);
  const { maxStreak, streak } = getStreak(days);
  // Arrange as weeks (columns)
  const weeks: { date: string; count: number }[][] = [];
  let week: { date: string; count: number }[] = [];
  days.forEach((d, i) => {
    const dayOfWeek = new Date(d.date).getDay();
    if (week.length === 0 && dayOfWeek !== 0) {
      for (let j = 0; j < dayOfWeek; j++) week.push({ date: '', count: 0 });
    }
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length) {
    while (week.length < 7) week.push({ date: '', count: 0 });
    weeks.push(week);
  }
  // Color scale
  const colors = ['#f3f4f6', '#d1fae5', '#6ee7b7', '#34d399', '#059669'];
  function getColor(count: number) {
    if (count === 0) return colors[0];
    if (count === 1) return colors[1];
    if (count <= 3) return colors[2];
    if (count <= 6) return colors[3];
    return colors[4];
  }
  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="font-semibold">Study Streaks</span>
        <span className="text-xs text-muted-foreground">Current streak: <b>{streak}</b> days &nbsp;|&nbsp; Max streak: <b>{maxStreak}</b> days</span>
      </div>
      <div className="overflow-x-auto">
        <svg width={weeks.length * 14} height={7 * 14}>
          {weeks.map((week, x) =>
            week.map((d, y) =>
              d.date ? (
                <rect
                  key={d.date}
                  x={x * 14}
                  y={y * 14}
                  width={12}
                  height={12}
                  rx={2}
                  fill={getColor(d.count)}
                >
                  <title>{`${d.date}: ${d.count} activity`}</title>
                </rect>
              ) : null
            )
          )}
        </svg>
      </div>
      <div className="flex gap-2 items-center mt-2 text-xs">
        <span>Less</span>
        {colors.map((c, i) => (
          <span key={i} className="inline-block w-4 h-4 rounded" style={{ background: c }}></span>
        ))}
        <span>More</span>
      </div>
    </div>
  );
};

const InsightsTabContent: FC = () => {
  const { words, isLoading } = useVocabulary();
  // Use shared stats utility
  const stats = useMemo(() => getWordStats(words), [words]);
  
  const sessionStats = useMemo(() => getSessionStats(words), [words]);
  const masteryForecast = useMemo(() => getMasteryForecast(words), [words]);
  
  // For charts, force re-render on mount to get latest localStorage
  const [_, setRerender] = useState(0);
  useEffect(() => { setRerender(x => x + 1); }, []);
  
  // Handle loading state
  if (isLoading) {
    return <LoadingState />;
  }
  
  // Handle empty state
  if (!stats || words.length === 0) {
    return <EmptyState 
      title="No Data Yet"
      description="Start adding words to your library and playing games to see your learning insights here!"
      icon={<AlertTriangle className="h-6 w-6 text-primary mx-auto mb-2" />} 
    />;
  }

  return (
    <div className="space-y-8 p-2 sm:p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorBoundary FallbackComponent={ChartErrorFallback}>
          <StageDistributionDonutChart words={words} isLoading={isLoading} />
        </ErrorBoundary>
        <div className="grid grid-cols-2 gap-4">
          <StatsCard
            title="Total Words"
            value={stats.totalWords}
            icon={<BookOpen className="h-5 w-5 text-blue-400" />}
            description="Words in your library."
          />
          <StatsCard
            title="Games Played Today"
            value={(() => {
              const log = getQuizLog();
              const today = new Date();
              today.setHours(0,0,0,0);
              let count = 0;
              log.forEach(r => {
                const dt = new Date(r.timestamp);
                dt.setHours(0,0,0,0);
                if (dt.getTime() === today.getTime()) count++;
              });
              return count;
            })()}
            icon={<BarChartBig className="h-5 w-5 text-yellow-400" />}
            description="Number of games played today."
          />
          <StatsCard
            title="Mastered Words Today"
            value={words.filter(w => w.fsrsCard.state === 'Review' && w.fsrsCard.last_review && new Date(w.fsrsCard.last_review).setHours(0,0,0,0) === new Date().setHours(0,0,0,0)).length}
            icon={<BarChartBig className="h-5 w-5 text-green-500" />}
            description="Words that reached 'mastered' (Review) state today."
          />
          <StatsCard
            title="Retention Rate (7d)"
            value={(() => {
              const log = getQuizLog();
              const today = new Date();
              let total = 0, correct = 0;
              for (let i = 0; i < 7; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                d.setHours(0,0,0,0);
                const key = d.toISOString().slice(0,10);
                log.forEach(r => {
                  const dt = new Date(r.timestamp);
                  dt.setHours(0,0,0,0);
                  if (dt.getTime() === d.getTime()) {
                    total++;
                    if (r.correct) correct++;
                  }
                });
              }
              return total ? Math.round((correct/total)*100) + '%' : '—';
            })()}
            icon={<Brain className="h-5 w-5 text-purple-400" />}
            description="% of correct answers in the last 7 days."
          />
        </div>
        <div className="col-span-2 text-xs text-muted-foreground mt-2">
          <b>Note:</b> "Mastered" means a word is in the <b>Review</b> state (long-term memory). "Relearning" means a word was mastered but lapsed and is being re-learned. Higher state is not always better.
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mastered Words Over Time Chart */}
        <div className="bg-background rounded-lg border p-4 shadow-md col-span-2">
          <div className="font-semibold mb-2">Total Mastered Words Over Time</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={useMemo(() => {
              // Build a time series of total mastered words by day
              const byDay: Record<string, number> = {};
              words.forEach(w => {
                // Use 'Review' as the mastered state (per FSRS logic)
                if (w.fsrsCard?.state === 'Review' && w.fsrsCard?.last_review) {
                  const d = w.fsrsCard.last_review.slice(0, 10);
                  byDay[d] = (byDay[d] || 0) + 1;
                }
              });
              // Build cumulative sum by day
              const allDays = Object.keys(byDay).sort();
              let cumulative = 0;
              const data = allDays.map(date => {
                cumulative += byDay[date];
                return { date: date.slice(5), mastered: cumulative };
              });
              // Fill in missing days (for last 30 days)
              const today = new Date();
              const days: { date: string; mastered: number }[] = [];
              let lastValue = 0;
              for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                const found = data.find(x => x.date === key.slice(5));
                if (found) lastValue = found.mastered;
                days.push({ date: key.slice(5), mastered: lastValue });
              }
              return days;
            }, [words])} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis label={{ value: 'Words', angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="mastered" stroke="#10b981" name="Mastered Words" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground mt-2">Shows your cumulative total of mastered words (FSRS state = Review) over the last 30 days.</div>
        </div>
      </div>
      <div className="rounded-lg border bg-background p-4 shadow-md">
        <CalendarHeatmap />
      </div>
      {/* Mastery Forecast Section */}
      <div className="rounded-lg border bg-background p-4 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <div className="text-lg font-semibold mb-1">Mastery Forecast</div>
            <div className="text-muted-foreground text-sm mb-2">
              Time-to-mastery estimator predicts how long it will take to master your current word set at your current pace.
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="font-medium">Estimated days to mastery: </span>
                <span className="font-mono">{masteryForecast.estDaysToMastery !== null ? masteryForecast.estDaysToMastery : '∞'}</span>
              </div>
              <div>
                <span className="font-medium">Current learning speed: </span>
                <span className="font-mono">{masteryForecast.avgLeveledUp.toFixed(2)}</span> words/day
              </div>
              <div>
                <span className="font-medium">Words not yet mastered: </span>
                <span className="font-mono">{masteryForecast.notMastered}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders of the entire component
export default memo(InsightsTabContent);