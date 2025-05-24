import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can log error to an error reporting service here
    // e.g., Sentry.captureException(error, { extra: errorInfo });
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error("Global error boundary caught an error:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="mb-2">An unexpected error occurred. Please refresh the page or try again later.</p>
          <pre className="text-xs text-red-500 overflow-x-auto max-w-full">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
