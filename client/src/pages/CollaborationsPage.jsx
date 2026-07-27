import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { collaborationService } from '../services/collaborationService.js';
import { AppShell } from '../components/layout/AppShell.jsx';
import { CollaborationCard } from '../components/collaboration/CollaborationCard.jsx';

export function CollaborationsPage() {
  const { currentUser, logout, isLoading: isAuthLoading } = useAuth();
  const [collaborations, setCollaborations] = useState(null);

  useEffect(() => {
    collaborationService.getMine().then(({ data }) => setCollaborations(data.collaborations));
  }, []);

  if (isAuthLoading) return null;
  if (!currentUser) return <Navigate to="/" replace />;

  const activeCollaborations = collaborations?.filter((c) => c.status === 'in_progress') ?? [];
  const pastCollaborations = collaborations?.filter((c) => c.status !== 'in_progress') ?? [];

  return (
    <AppShell currentUser={currentUser} logout={logout}>
      <h1 className="font-serif text-2xl text-charcoal">Collaborations</h1>

      {collaborations === null ? (
        <p className="text-sm text-charcoal/50">Loading…</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-lg text-charcoal">Continue writing</h2>
            {activeCollaborations.length === 0 ? (
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
            {pastCollaborations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-6 text-center text-sm text-charcoal/50">
                Finished pieces will show up here.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {pastCollaborations.map((collaboration) => (
                  <CollaborationCard
                    key={collaboration.id}
                    collaboration={collaboration}
                    currentUserId={currentUser.id}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
