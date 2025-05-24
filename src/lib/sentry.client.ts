import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '', // Set your Sentry DSN in env
  tracesSampleRate: 1.0, // Adjust for production
  environment: process.env.NODE_ENV,
});
