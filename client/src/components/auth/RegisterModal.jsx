import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from './Modal.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const inputClasses =
  'w-full rounded-lg border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 transition focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15';

export function RegisterModal({ isOpen, onClose }) {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      const { message: successMessage } = await register({ displayName, email, password });
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create account">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className={inputClasses}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClasses}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className={inputClasses}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-indigo-dark">{message}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo py-2.5 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-charcoal/40">
          By signing up, you agree to Pairagraph's{' '}
          <Link to="/terms" className="underline decoration-charcoal/20 underline-offset-4 hover:text-charcoal/60">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline decoration-charcoal/20 underline-offset-4 hover:text-charcoal/60">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-charcoal/35">
        <div className="h-px flex-1 bg-charcoal/10" />
        or
        <div className="h-px flex-1 bg-charcoal/10" />
      </div>
      <div className="flex justify-center">
        <GoogleSignInButton onSuccess={onClose} onError={setError} />
      </div>
    </Modal>
  );
}
