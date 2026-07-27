import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collaborationService } from '../../services/collaborationService.js';
import { downloadCollaborationPdf } from '../../utils/exportCollaborationPdf.js';

const STATUS_LABEL = {
  in_progress: 'In progress',
  completed: 'Completed',
  private: 'Private',
};

function formatUpdatedAt(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function CollaborationCard({ collaboration, currentUserId }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const other = collaboration.participants.find((p) => p.user._id !== currentUserId);
  const isYourTurn =
    collaboration.status === 'in_progress' && collaboration.turnOwner._id === currentUserId;
  const isCompleted = collaboration.status === 'completed';

  // The dashboard list only carries a summary (no entry content), so the
  // full collaboration is fetched on demand rather than loading it for every card.
  async function handleDownload(event) {
    event.preventDefault();
    setIsDownloading(true);
    try {
      const { data } = await collaborationService.getById(collaboration.id);
      downloadCollaborationPdf(data.collaboration);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-charcoal/10 bg-white/50 px-5 py-4 transition hover:border-indigo/40 hover:shadow-soft">
      <Link
        to={`/collaborations/${collaboration.id}`}
        className="flex min-w-0 flex-1 items-center justify-between gap-3"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-serif text-base text-charcoal">
              {collaboration.writingType === 'poem' ? 'Poem' : 'Story'} with{' '}
              {other?.user.displayName ?? 'someone'}
            </span>
            {isYourTurn && (
              <span className="shrink-0 rounded-full bg-indigo-tint px-2 py-0.5 text-xs text-indigo-dark">
                Your turn
              </span>
            )}
          </div>
          <span className="truncate text-xs text-charcoal/50">
            {STATUS_LABEL[collaboration.status]} · {collaboration.entryCount}{' '}
            {collaboration.entryCount === 1 ? 'entry' : 'entries'} · {formatUpdatedAt(collaboration.updatedAt)}
          </span>
        </div>
        <span aria-hidden="true" className="shrink-0 text-charcoal/30">&rsaquo;</span>
      </Link>
      {isCompleted && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="shrink-0 rounded-full border border-indigo/40 px-3 py-1.5 text-xs font-medium text-indigo-dark transition hover:border-indigo hover:bg-indigo-tint disabled:opacity-60"
        >
          {isDownloading ? 'Preparing…' : 'Download PDF'}
        </button>
      )}
    </div>
  );
}
