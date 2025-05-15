
"use client";

import type { FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Word } from '@/types';
import { useMemo } from 'react';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';

interface WordsAddedChartProps {
  words: Word[];
  isLoading?: boolean;
}

const WordsAddedChart: FC<WordsAddedChartProps> = ({ words, isLoading }) => {
  const chartData = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, 6); // Last 7 days
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const wordsByDate: Record<string, number> = {};
    dateRange.forEach(date => {
      wordsByDate[format(date, 'MMM d')] = 0;
    });

    words.forEach(word => {
      const dateAdded = parseISO(word.dateAdded);
      if (dateAdded >= startDate && dateAdded <= endDate) {
        const formattedDate = format(dateAdded, 'MMM d');
        wordsByDate[formattedDate] = (wordsByDate[formattedDate] || 0) + 1;
      }
    });

    return Object.entries(wordsByDate).map(([name, count]) => ({
      name,
      wordsAdded: count,
    }));
  }, [words]);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <Skeleton className="h-6 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="h-[300px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }
  
  const hasData = chartData.some(d => d.wordsAdded > 0);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Words Added Recently</CardTitle>
        <CardDescription>Activity in the last 7 days.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] sm:h-[350px] p-0 pr-2">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false} 
              />
              <Tooltip
                contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                }}
                formatter={(value: number) => [`${value} words`, "Words Added"]}
              />
              <Legend wrapperStyle={{paddingTop: "20px"}}/>
              <Bar dataKey="wordsAdded" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex justify-center items-center h-full">
            <p className="text-muted-foreground">No words added in the last 7 days.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WordsAddedChart;
