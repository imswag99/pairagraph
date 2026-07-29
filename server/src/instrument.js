import * as Sentry from '@sentry/node';

// Error tracking only — tracesSampleRate: 0 keeps this from also opting into
// performance tracing/APM, a separate product with its own quota that isn't
// what was actually asked for. No-ops automatically if SENTRY_DSN is unset,
// same convention GEMINI_API_KEY/CAPTCHA_SECRET_KEY already use, so local dev
// and CI need no Sentry setup at all unless the var is explicitly added.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
});
