import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PenMark } from '../components/PenMark.jsx';

const inputClasses =
  'w-full rounded-lg border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 transition focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15';

export function ResetPasswordPage() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setIsDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
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

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 text-center animate-fade-in">
        <PenMark className="h-8 w-8 text-indigo" />

        {isDone ? (
          <>
            <h1 className="font-serif text-2xl text-charcoal">Password updated</h1>
            <p role="status" className="text-sm text-charcoal/70">You can now log in with your new password.</p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl text-charcoal">Choose a new password</h1>
            <form onSubmit={handleSubmit} className="w-full space-y-3 text-left">
              <label htmlFor="reset-password" className="sr-only">New password (min 8 characters)</label>
              <input
                id="reset-password"
                type="password"
                placeholder="New password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputClasses}
              />
              <label htmlFor="reset-password-confirm" className="sr-only">Confirm new password</label>
              <input
                id="reset-password-confirm"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={inputClasses}
              />
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-indigo py-2.5 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
              >
                {isSubmitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        <Link
          to="/"
          className="text-sm text-indigo-dark underline decoration-indigo/30 underline-offset-4 transition hover:text-indigo"
        >
          Back to Pairagraph
        </Link>
      </div>
    </div>
  );
}
