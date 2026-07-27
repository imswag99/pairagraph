import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const inputClasses =
  'w-full rounded-lg border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 transition focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15';

export function ForgotPasswordModal({ isOpen, onClose }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleClose() {
    setEmail('');
    setMessage('');
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      setMessage(
        "If an account exists for that email, a reset link is on its way. Don't see it? Check your spam folder."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reset your password">
      {message ? (
        <p className="text-sm text-charcoal/70">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-charcoal/60">
            Enter your email and we'll send you a link to choose a new password.
          </p>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClasses}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo py-2.5 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </Modal>
  );
}
