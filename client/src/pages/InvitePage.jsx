import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { inviteService } from '../services/inviteService.js';
import { LoginModal } from '../components/auth/LoginModal.jsx';
import { RegisterModal } from '../components/auth/RegisterModal.jsx';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal.jsx';
import { PenMark } from '../components/PenMark.jsx';

export function InvitePage() {
  const { code } = useParams();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null);
  const [error, setError] = useState('');
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (isAuthLoading || !currentUser || hasAttempted.current) return;
    hasAttempted.current = true;
    inviteService
      .redeem(code)
      .then(({ data }) => navigate(`/collaborations/${data.collaborationId}`))
      .catch((err) => setError(err.message));
  }, [isAuthLoading, currentUser, code, navigate]);

  if (isAuthLoading) return null;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
        <p className="text-sm text-charcoal/60">{error}</p>
        <Link
          to="/"
          className="text-sm text-indigo-dark underline decoration-indigo/30 underline-offset-4 transition hover:text-indigo"
        >
          Back to Pairagraph
        </Link>
      </div>
    );
  }

  if (currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-charcoal/50">
        Joining…
      </div>
    );
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
      <div className="relative flex max-w-sm flex-col items-center gap-6 text-center animate-fade-in">
        <PenMark className="h-9 w-9 text-indigo" />
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-serif text-2xl text-charcoal">
            You've been invited to write together
          </h1>
          <p className="text-sm text-charcoal/60">Log in or create an account to join.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveModal('login')}
            className="rounded-full bg-indigo px-6 py-2.5 text-sm font-medium text-paper shadow-soft transition hover:-translate-y-0.5 hover:bg-indigo-dark hover:shadow-modal"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('register')}
            className="rounded-full border border-indigo/50 px-6 py-2.5 text-sm font-medium text-indigo-dark transition hover:-translate-y-0.5 hover:border-indigo hover:bg-indigo-tint"
          >
            Sign up
          </button>
        </div>
      </div>
      <LoginModal
        isOpen={activeModal === 'login'}
        onClose={() => setActiveModal(null)}
        onForgotPassword={() => setActiveModal('forgot-password')}
      />
      <RegisterModal isOpen={activeModal === 'register'} onClose={() => setActiveModal(null)} />
      <ForgotPasswordModal
        isOpen={activeModal === 'forgot-password'}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
