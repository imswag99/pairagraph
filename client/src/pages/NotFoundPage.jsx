import { Link } from 'react-router-dom';
import { PenMark } from '../components/PenMark.jsx';

export function NotFoundPage() {
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
        <h1 className="font-serif text-2xl text-charcoal">This page is blank</h1>
        <p className="text-sm text-charcoal/60">There's nothing written at this address.</p>
        <Link
          to="/"
          className="mt-2 text-sm text-indigo-dark underline decoration-indigo/30 underline-offset-4 transition hover:text-indigo"
        >
          Back to Pairagraph
        </Link>
      </div>
    </div>
  );
}
