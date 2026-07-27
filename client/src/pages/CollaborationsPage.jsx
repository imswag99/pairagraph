import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { collaborationService } from '../services/collaborationService.js';
import { AppShell } from '../components/layout/AppShell.jsx';
import { CollaborationCard } from '../components/collaboration/CollaborationCard.jsx';
import { CollaborationCardSkeleton } from '../components/Skeleton.jsx';

const PAST_PAGE_SIZE = 10;

export function CollaborationsPage() {
  const { currentUser, logout, isLoading: isAuthLoading } = useAuth();
  const [activeCollaborations, setActiveCollaborations] = useState(null);
  const [pastCollaborations, setPastCollaborations] = useState(null);
  const [pastPage, setPastPage] = useState(1);
  const [pastHasMore, setPastHasMore] = useState(false);
  const [isLoadingMorePast, setIsLoadingMorePast] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    collaborationService
      .getMine({ status: 'in_progress', limit: 50 })
      .then(({ data }) => setActiveCollaborations(data.collaborations));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    collaborationService
      .getMine({ status: 'completed,private', page: 1, limit: PAST_PAGE_SIZE })
      .then(({ data }) => {
        setPastCollaborations(data.collaborations);
        setPastHasMore(data.hasMore);
        setPastPage(1);
      });
  }, [currentUser]);

  async function handleLoadMorePast() {
    setIsLoadingMorePast(true);
    try {
      const nextPage = pastPage + 1;
      const { data } = await collaborationService.getMine({
        status: 'completed,private',
        page: nextPage,
        limit: PAST_PAGE_SIZE,
      });
      setPastCollaborations((prev) => [...prev, ...data.collaborations]);
      setPastHasMore(data.hasMore);
      setPastPage(nextPage);
    } finally {
      setIsLoadingMorePast(false);
    }
  }

  if (isAuthLoading) return null;
  if (!currentUser) return <Navigate to="/" replace />;

  return (
    <AppShell currentUser={currentUser} logout={logout}>
      <h1 className="font-serif text-2xl text-charcoal">Collaborations</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-charcoal">Continue writing</h2>
        {activeCollaborations === null ? (
          <div className="flex flex-col gap-3">
            <CollaborationCardSkeleton />
            <CollaborationCardSkeleton />
          </div>
        ) : activeCollaborations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-6 text-center text-sm text-charcoal/50">
            Nothing in progress right now.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {activeCollaborations.map((collaboration) => (
              <CollaborationCard
                key={collaboration.id}
                collaboration={collaboration}
                currentUserId={currentUser.id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-charcoal">Past collaborations</h2>
        {pastCollaborations === null ? (
          <div className="flex flex-col gap-3">
            <CollaborationCardSkeleton />
            <CollaborationCardSkeleton />
            <CollaborationCardSkeleton />
          </div>
        ) : pastCollaborations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-6 text-center text-sm text-charcoal/50">
            Finished pieces will show up here.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {pastCollaborations.map((collaboration) => (
                <CollaborationCard
                  key={collaboration.id}
                  collaboration={collaboration}
                  currentUserId={currentUser.id}
                />
              ))}
            </div>
            {pastHasMore && (
              <button
                type="button"
                onClick={handleLoadMorePast}
                disabled={isLoadingMorePast}
                className="self-center rounded-full border border-charcoal/15 px-5 py-2 text-sm text-charcoal/60 transition hover:border-indigo/40 hover:text-charcoal disabled:opacity-60"
              >
                {isLoadingMorePast ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
