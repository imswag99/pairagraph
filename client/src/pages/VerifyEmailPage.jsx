import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PenMark } from '../components/PenMark.jsx';

export function VerifyEmailPage() {
  const { token } = useParams();
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    verifyEmail(token)
      .then(({ message: successMessage }) => {
        if (!cancelled) {
          setStatus('success');
          setMessage(successMessage);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setMessage(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, verifyEmail]);

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

        {status === 'verifying' && (
          <p className="text-sm text-charcoal/60">Verifying your email…</p>
        )}

        {status === 'success' && (
          <>
            <h1 className="font-serif text-2xl text-charcoal">Email verified</h1>
            <p className="text-sm text-charcoal/70">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="font-serif text-2xl text-charcoal">Verification failed</h1>
            <p className="text-sm text-charcoal/70">{message}</p>
          </>
        )}

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
