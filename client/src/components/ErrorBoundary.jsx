import { Component } from 'react';
import * as Sentry from '@sentry/react';
import { PenMark } from './PenMark.jsx';

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info.componentStack);
    Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-6">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 45% at 50% 30%, rgba(91,93,148,0.08), transparent 70%)',
          }}
        />
        <div className="relative flex max-w-sm flex-col items-center gap-5 text-center animate-fade-in">
          <PenMark className="h-8 w-8 text-indigo" />
          <h1 className="font-serif text-2xl text-charcoal">Something went wrong</h1>
          <p className="text-sm text-charcoal/60">
            This page hit an unexpected error. Reloading usually fixes it.
          </p>
          <a
            href="/"
            className="mt-2 rounded-full bg-indigo px-6 py-2.5 text-sm font-medium text-paper shadow-soft transition hover:-translate-y-0.5 hover:bg-indigo-dark hover:shadow-modal"
          >
            Reload Pairagraph
          </a>
        </div>
      </div>
    );
  }
}
