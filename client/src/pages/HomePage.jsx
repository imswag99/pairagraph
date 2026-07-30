import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { LoginModal } from '../components/auth/LoginModal.jsx';
import { RegisterModal } from '../components/auth/RegisterModal.jsx';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal.jsx';
import { PenMark } from '../components/PenMark.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { QuickMatchPanel } from '../components/collaboration/QuickMatchPanel.jsx';
import { InvitePanel } from '../components/collaboration/InvitePanel.jsx';
import { BADGES, BADGE_ORDER } from '../constants/badges.js';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Purely atmospheric — a small taste of the kind of word the AI keyword
// feature hands you once a collaboration actually starts. No API call here;
// burning real Gemini quota (a hard 20/day cap) on hero decoration isn't worth it.
const SPARK_WORDS = [
  'ember', 'threshold', 'tide', 'wildfire', 'echo',
  'lantern', 'horizon', 'bloom', 'undertow', 'reverie',
];

function useRotatingWord(words, intervalMs = 2800) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [words, intervalMs]);

  return words[index];
}

const heroContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function Hero({ onOpenModal }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 30%, rgba(91,93,148,0.08), transparent 70%)',
        }}
      />

      <div className="relative flex max-w-md flex-col items-center gap-7 text-center animate-fade-in">
        <PenMark className="h-9 w-9 text-indigo" />

        <div className="flex flex-col items-center gap-3">
          <h1 className="font-serif text-4xl tracking-tight text-charcoal">Pairagraph</h1>
          <div className="h-px w-10 bg-indigo/40" />
          <p className="font-serif text-lg italic leading-relaxed text-charcoal/70">
            A quiet page for two, written one turn at a time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenModal('login')}
            className="rounded-full bg-indigo px-6 py-2.5 text-sm font-medium text-paper shadow-soft transition hover:-translate-y-0.5 hover:bg-indigo-dark hover:shadow-modal"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('register')}
            className="rounded-full border border-indigo/50 px-6 py-2.5 text-sm font-medium text-indigo-dark transition hover:-translate-y-0.5 hover:border-indigo hover:bg-indigo-tint"
          >
            Sign up
          </button>
        </div>

        <Link
          to="/discover"
          className="text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal"
        >
          Browse the gallery
        </Link>

        <div className="mt-2 flex items-center gap-3 text-xs text-charcoal/40">
          <Link to="/privacy" className="underline decoration-charcoal/20 underline-offset-4 hover:text-charcoal/70">
            Privacy
          </Link>
          <span>·</span>
          <Link to="/terms" className="underline decoration-charcoal/20 underline-offset-4 hover:text-charcoal/70">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardHero({ displayName }) {
  const sparkWord = useRotatingWord(SPARK_WORDS);

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-charcoal/10 bg-white/50 px-8 py-10 shadow-soft"
      initial="hidden"
      animate="visible"
      variants={heroContainerVariants}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: [
            'radial-gradient(60% 80% at 85% 15%, rgba(91,93,148,0.14), transparent 70%)',
            'radial-gradient(60% 80% at 70% 30%, rgba(91,93,148,0.18), transparent 70%)',
            'radial-gradient(60% 80% at 85% 15%, rgba(91,93,148,0.14), transparent 70%)',
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex flex-col items-start gap-3">
        <motion.p variants={heroItemVariants} className="text-sm text-charcoal/50">
          {getGreeting()}, {displayName}
        </motion.p>
        <motion.h1
          variants={heroItemVariants}
          className="font-serif text-3xl tracking-tight text-charcoal"
        >
          Where should today's page begin?
        </motion.h1>
        <motion.p
          variants={heroItemVariants}
          className="max-w-md font-serif text-base italic leading-relaxed text-charcoal/70"
        >
          A quiet page for two, written one turn at a time.
        </motion.p>

        <motion.div variants={heroItemVariants} className="mt-1 flex items-center gap-2 text-sm">
          <span className="text-charcoal/40">Today's spark&hellip;</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={sparkWord}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="rounded-full bg-indigo-tint px-3 py-1 font-medium text-indigo-dark"
            >
              {sparkWord}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

function BadgeProgressTeaser({ currentUser }) {
  const earned = new Set(currentUser.badges ?? []);
  const nextBadgeId = BADGE_ORDER.find((id) => !earned.has(id));

  return (
    <Link
      to="/leaderboard"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-charcoal/10 bg-white/50 px-4 py-2 text-sm transition hover:border-indigo/30 hover:bg-indigo-tint/40"
    >
      <span className="font-medium text-indigo-dark">
        {earned.size}/{BADGE_ORDER.length} badges
      </span>
      {nextBadgeId && (
        <span className="text-charcoal/50">
          Next up: <span className="font-medium text-charcoal/70">{BADGES[nextBadgeId].label}</span>
          {' — '}
          {BADGES[nextBadgeId].description}
        </span>
      )}
    </Link>
  );
}

function Dashboard({ currentUser, logout }) {
  if (currentUser.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <AppShell currentUser={currentUser} logout={logout}>
      <DashboardHero displayName={currentUser.displayName} />

      <BadgeProgressTeaser currentUser={currentUser} />

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-charcoal">Start something new</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <QuickMatchPanel />
          <InvitePanel />
        </div>
      </section>
    </AppShell>
  );
}

export function HomePage() {
  const { currentUser, isLoading, isSlow, logout } = useAuth();
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    if (currentUser) {
      setActiveModal(null);
    }
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-paper text-sm text-charcoal/50">
        <p>Loading…</p>
        {isSlow && (
          <p className="max-w-xs text-center text-xs text-charcoal/40">
            Waking up the server after a period of inactivity — this can take up to a minute.
          </p>
        )}
      </div>
    );
  }

  if (currentUser) {
    return <Dashboard currentUser={currentUser} logout={logout} />;
  }

  return (
    <>
      <Hero onOpenModal={setActiveModal} />
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
    </>
  );
}
