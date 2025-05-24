"use client";

import type { FC } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Word } from '@/types';
import { useMemo } from 'react';

const DONUT_COLORS: Record<string, string> = {
  New: '#60a5fa', // blue-400
  Learning: '#facc15', // yellow-400
  Review: '#22c55e', // green-500
  Relearning: '#a78bfa', // purple-400
};
const LABELS: Record<string, string> = {
  New: 'New',
  Learning: 'Learning',
  Review: 'Review',
  Relearning: 'Relearning',
};

const StageDistributionDonutChart: React.FC<{ words: Word[]; isLoading?: boolean }> = ({ words, isLoading }) => {
  const data = useMemo(() => {
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
  }, [words]);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Stage Distribution</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px]">
          <div className="animate-pulse rounded-full bg-muted w-[220px] h-[220px]" />
        </CardContent>
      </Card>
    );
  }
  if (data.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Stage Distribution</CardTitle>
          <CardDescription>No words in your library yet.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px]">
          <div className="text-muted-foreground">Add words to see your progress!</div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Stage Distribution</CardTitle>
        <CardDescription>Current breakdown of your vocabulary by learning stage.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="w-full max-w-xs">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                isAnimationActive
                stroke="none"
              >
                {data.map((entry, idx) => (
                  <Cell key={entry.state} fill={DONUT_COLORS[entry.state]} aria-label={entry.name} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-xs">{d.value} words ({d.percent}%)</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {data.map(d => (
            <span key={d.state} className="flex items-center text-xs">
              <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: DONUT_COLORS[d.state] }} aria-hidden />
              {d.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StageDistributionDonutChart;