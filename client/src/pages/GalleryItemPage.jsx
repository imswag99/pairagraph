import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { PenMark } from '../components/PenMark.jsx';
import { EntryList } from '../components/collaboration/EntryList.jsx';
import { KeywordChips } from '../components/collaboration/KeywordChips.jsx';
import { ReportModal } from '../components/collaboration/ReportModal.jsx';
import { galleryService } from '../services/galleryService.js';

function GalleryItemContent({ id, canReport }) {
  const [piece, setPiece] = useState(null);
  const [error, setError] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    setPiece(null);
    setError('');
    galleryService
      .get(id)
      .then(({ data }) => setPiece(data.piece))
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/discover"
        className="self-start text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal"
      >
        ← Back to Discover
      </Link>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !piece ? (
        <p className="text-sm text-charcoal/40">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-charcoal/10 bg-white/50 p-6">
          <div className="flex items-center gap-2 text-xs text-charcoal/40">
            <span className="rounded-full bg-charcoal/5 px-2.5 py-1 capitalize">{piece.writingType}</span>
            {piece.theme !== 'classic' && (
              <span className="rounded-full bg-indigo-tint px-2.5 py-1 capitalize text-indigo-dark">
                {piece.theme}
              </span>
            )}
          </div>
          <KeywordChips keywords={piece.keywords} />
          <div className="h-px w-full bg-charcoal/10" />
          <EntryList entries={piece.entries} />
          <div className="h-px w-full bg-charcoal/10" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-charcoal/40">
              Written by {piece.authors.join(' & ')} · {new Date(piece.publishedAt).toLocaleDateString()}
            </p>
            {canReport && (
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="text-xs text-charcoal/40 underline decoration-charcoal/20 underline-offset-4 transition hover:text-red-600"
              >
                Report this piece
              </button>
            )}
          </div>
        </div>
      )}

      {canReport && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          collaborationId={id}
          mode="gallery"
        />
      )}
    </div>
  );
}

export function GalleryItemPage() {
  const { currentUser, logout, isLoading } = useAuth();
  const { id } = useParams();

  if (isLoading) return null;

  if (currentUser) {
    return (
      <AppShell currentUser={currentUser} logout={logout}>
        <GalleryItemContent id={id} canReport />
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
        <Link to="/" className="flex items-center gap-2">
          <PenMark className="h-6 w-6 text-indigo" />
          <span className="font-serif text-xl text-charcoal">Pairagraph</span>
        </Link>
        <GalleryItemContent id={id} canReport={false} />
      </div>
    </div>
  );
}
