
"use client";

import type { FC, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  isLoading?: boolean;
  description?: string;
}

const StatsCard: FC<StatsCardProps> = ({ title, value, icon, isLoading, description }) => {
  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-5 w-24" />
          {icon && <Skeleton className="h-6 w-6 rounded-sm" />}
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-12 mb-1" />
          {description && <Skeleton className="h-4 w-full" />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-primary">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
