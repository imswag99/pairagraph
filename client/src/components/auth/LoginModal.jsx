import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const inputClasses =
  'w-full rounded-lg border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 transition focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15';

export function LoginModal({ isOpen, onClose, onForgotPassword }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login({ email, password });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log in">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="login-email" className="sr-only">Email</label>
        <input
          id="login-email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClasses}
        />
        <label htmlFor="login-password" className="sr-only">Password</label>
        <input
          id="login-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClasses}
        />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo py-2.5 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
        >
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
        {onForgotPassword && (
          <button
            type="button"
            onClick={onForgotPassword}
            className="w-full text-center text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal"
          >
            Forgot password?
          </button>
        )}
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
