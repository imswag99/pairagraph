import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './app/App.jsx';
import './styles/index.css';

// Error tracking only, same as the backend — no performance tracing (no
// browserTracingIntegration added, tracesSampleRate: 0). No-ops automatically
// if VITE_SENTRY_DSN is unset, so local dev needs no Sentry setup at all
// unless the var is explicitly added.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0,
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
