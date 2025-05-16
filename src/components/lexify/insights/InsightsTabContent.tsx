"use client";

import { memo, useMemo, type FC } from 'react';
import { useVocabulary } from '@/context/VocabularyContext';
import StatsCard from './StatsCard';
import FamiliarityPieChart from './FamiliarityPieChart';
import WordsAddedChart from './WordsAddedChart';
import { BookOpen, PieChart as PieChartIcon, BarChartBig, Brain, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from 'react-error-boundary';

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

// Empty state component
const EmptyState: FC = () => (
  <div className="p-2 sm:p-4 md:p-6 flex justify-center items-center min-h-[calc(100vh-250px)]">
    <Alert variant="default" className="max-w-lg text-center border-primary">
      <AlertTriangle className="h-6 w-6 text-primary mx-auto mb-2" />
      <AlertTitle className="text-xl font-semibold">No Data Yet</AlertTitle>
      <AlertDescription>
        Start adding words to your library and playing games to see your learning insights here!
      </AlertDescription>
    </Alert>
  </div>
);

const InsightsTabContent: FC = () => {
  const { words, isLoading } = useVocabulary();
  
  // Memoize derived stats to prevent recalculations on every render
  const stats = useMemo(() => {
    if (!words.length) return null;
    
    return {
      totalWords: words.length,
      masteredWords: words.filter(w => w.familiarity === 'Mastered').length,
      // Add more derived stats here if needed
    };
  }, [words]);
  
  // Handle loading state
  if (isLoading) {
    return <LoadingState />;
  }
  
  // Handle empty state
  if (!stats || words.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Words"
          value={stats.totalWords}
          icon={<BookOpen className="h-5 w-5" />}
          description="Words currently in your library."
          isLoading={isLoading}
        />
        <StatsCard
          title="Mastered Words"
          value={stats.masteredWords}
          icon={<Brain className="h-5 w-5" />}
          description="Words you've marked as mastered."
          isLoading={isLoading}
        />
        {/* Placeholder for future stats */}
        <StatsCard
          title="Accuracy (Coming Soon)"
          value="N/A"
          icon={<BarChartBig className="h-5 w-5 text-muted-foreground" />}
          description="Your game accuracy over time."
          isLoading={false} 
        />
        <StatsCard
          title="Learning Streak (Coming Soon)"
          value="N/A"
          icon={<PieChartIcon className="h-5 w-5 text-muted-foreground" />}
          description="Your daily learning consistency."
          isLoading={false}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <ErrorBoundary FallbackComponent={ChartErrorFallback}>
          <FamiliarityPieChart words={words} isLoading={isLoading} />
        </ErrorBoundary>
        
        <ErrorBoundary FallbackComponent={ChartErrorFallback}>
          <WordsAddedChart words={words} isLoading={isLoading} />
        </ErrorBoundary>
      </div>
      {/* Add more charts or insights components here in the future */}
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders of the entire component
export default memo(InsightsTabContent);
