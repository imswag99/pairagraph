import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { leaderboardService } from '../services/leaderboardService.js';
import { LeaderboardRowSkeleton } from '../components/Skeleton.jsx';

const RANGE_LABEL = {
  week: 'This week',
  all: 'All time',
};

function RangeToggle({ range, onChange }) {
  return (
    <div className="flex w-fit rounded-full bg-charcoal/5 p-1 text-sm">
      {Object.entries(RANGE_LABEL).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={range === value}
          className={`rounded-full px-4 py-1.5 transition ${
            range === value ? 'bg-indigo text-paper shadow-soft' : 'text-charcoal/50 hover:text-charcoal'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LeaderboardTable({ entries, currentUserId }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-10 text-center text-sm text-charcoal/50">
        No completed collaborations yet — finish one together to appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-charcoal/10 bg-white/50">
      {entries.map((entry) => {
        const isMe = entry.userId === currentUserId;
        return (
          <div
            key={entry.userId}
            className={`flex items-center justify-between gap-3 border-b border-charcoal/5 px-5 py-3 last:border-b-0 ${
              isMe ? 'bg-indigo-tint/50' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-4">
              <span className="w-6 shrink-0 text-right text-sm text-charcoal/40">{entry.rank}</span>
              <span className={`truncate text-sm ${isMe ? 'font-medium text-indigo-dark' : 'text-charcoal'}`}>
                {entry.displayName}
                {isMe && ' (you)'}
              </span>
            </div>
            <span className="shrink-0 text-sm font-medium text-charcoal/70">{entry.points} pts</span>
          </div>
        );
      })}
    </div>
  );
}

export function LeaderboardPage() {
  const { currentUser, logout, isLoading } = useAuth();
  const [range, setRange] = useState('week');
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    setEntries(null);
    setError('');
    leaderboardService
      .get(range)
      .then(({ data }) => setEntries(data.entries))
      .catch((err) => setError(err.message));
  }, [range, currentUser]);

  if (isLoading) return null;
  if (!currentUser) return <Navigate to="/" replace />;

  return (
    <AppShell currentUser={currentUser} logout={logout}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-2xl text-charcoal">Leaderboard</h1>
          <RangeToggle range={range} onChange={setRange} />
        </div>
        <p className="text-sm text-charcoal/50">
          Finishing a collaboration together earns both writers points.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : entries === null ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-charcoal/10 bg-white/50">
          <LeaderboardRowSkeleton />
          <LeaderboardRowSkeleton />
          <LeaderboardRowSkeleton />
        </div>
      ) : (
        <LeaderboardTable entries={entries} currentUserId={currentUser.id} />
      )}
    </AppShell>
  );
}
