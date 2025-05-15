
"use client";

import type { FC } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Word, FamiliarityLevel } from '@/types';
import { useMemo } from 'react';

interface FamiliarityPieChartProps {
  words: Word[];
  isLoading?: boolean;
}

const COLORS: Record<FamiliarityLevel, string> = {
  New: 'hsl(var(--chart-1))',       // Blue-ish
  Learning: 'hsl(var(--chart-2))',  // Yellow-ish/Orange-ish
  Familiar: 'hsl(var(--chart-3))',  // Green-ish
  Mastered: 'hsl(var(--chart-4))',  // Purple-ish/Teal-ish
};

const FamiliarityPieChart: FC<FamiliarityPieChartProps> = ({ words, isLoading }) => {
  const data = useMemo(() => {
    const counts: Record<FamiliarityLevel, number> = {
      New: 0,
      Learning: 0,
      Familiar: 0,
      Mastered: 0,
    };
    words.forEach(word => {
      counts[word.familiarity]++;
    });
    return (Object.keys(counts) as FamiliarityLevel[])
      .map(level => ({
        name: level,
        value: counts[level],
      }))
      .filter(item => item.value > 0); // Only show levels with words
  }, [words]);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <Skeleton className="h-6 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px]">
          <Skeleton className="h-[250px] w-[250px] rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Familiarity Distribution</CardTitle>
          <CardDescription>How well you know your words.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px]">
          <p className="text-muted-foreground">No words to display in the chart yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Familiarity Distribution</CardTitle>
        <CardDescription>How well you know your words.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] sm:h-[350px] p-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius="80%"
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
                const RADIAN = Math.PI / 180;
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                if (value === 0) return null; // Don't render label if value is 0
                return (
                  <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px" fontWeight="bold">
                    {`${name} (${(percent * 100).toFixed(0)}%)`}
                  </text>
                );
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.name as FamiliarityLevel]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
              formatter={(value: number, name: string) => [`${value} words`, name]}
            />
            <Legend wrapperStyle={{paddingTop: "20px"}}/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default FamiliarityPieChart;
