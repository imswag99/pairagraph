import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { PenMark } from '../components/PenMark.jsx';
import { BadgeGrid } from '../components/BadgeGrid.jsx';
import { GalleryCard } from '../components/collaboration/GalleryCard.jsx';
import { profileService } from '../services/profileService.js';

function ProfileContent({ id }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setProfile(null);
    setError('');
    profileService
      .get(id)
      .then(({ data }) => setProfile(data.profile))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-10 text-center text-sm text-charcoal/50">
        This profile isn't available — either it doesn't exist or the writer hasn't made it public.
      </p>
    );
  }

  if (!profile) {
    return <p className="text-sm text-charcoal/40">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-charcoal">{profile.displayName}</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-charcoal/70">
          <span>
            <span className="font-medium text-charcoal">{profile.totalCompletions}</span> completed
            <span className="text-charcoal/40">
              {' '}
              ({profile.storyCompletions} stories, {profile.poemCompletions} poems)
            </span>
          </span>
          <span>
            <span className="font-medium text-charcoal">{profile.currentStreak}</span> day streak
            {profile.longestStreak > 0 && (
              <span className="text-charcoal/40"> (best {profile.longestStreak})</span>
            )}
          </span>
          <span className="text-charcoal/40">
            Written with {profile.partnerCount} different {profile.partnerCount === 1 ? 'partner' : 'partners'}
          </span>
        </div>
      </div>

      <BadgeGrid earnedBadgeIds={profile.badges} />

      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-charcoal">Published work</h2>
        {profile.pieces.length === 0 ? (
          <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-10 text-center text-sm text-charcoal/50">
            Nothing published here yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.pieces.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { currentUser, logout, isLoading } = useAuth();
  const { id } = useParams();

  if (isLoading) return null;

  if (currentUser) {
    return (
      <AppShell currentUser={currentUser} logout={logout}>
        <ProfileContent id={id} />
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <Link to="/" className="flex items-center gap-2">
          <PenMark className="h-6 w-6 text-indigo" />
          <span className="font-serif text-xl text-charcoal">Pairagraph</span>
        </Link>
        <ProfileContent id={id} />
      </div>
    </div>
  );
}
