import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { collaborationService } from '../services/collaborationService.js';
import { socket } from '../sockets/socket.js';
import { PenMark } from '../components/PenMark.jsx';
import { KeywordChips } from '../components/collaboration/KeywordChips.jsx';
import { EntryList } from '../components/collaboration/EntryList.jsx';
import { TurnComposer } from '../components/collaboration/TurnComposer.jsx';
import { CompletionControls } from '../components/collaboration/CompletionControls.jsx';
import { ChatPanel } from '../components/collaboration/ChatPanel.jsx';
import { ReportModal } from '../components/collaboration/ReportModal.jsx';
import { downloadCollaborationPdf } from '../utils/exportCollaborationPdf.js';
import { moderationService } from '../services/moderationService.js';

const STATUS_LABEL = {
  in_progress: 'In progress',
  completed: 'Completed',
  private: 'Private',
  left: 'Ended',
};

export function CollaborationPage() {
  const { id } = useParams();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [collaboration, setCollaboration] = useState(null);
  const [error, setError] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isConfirmingBlock, setIsConfirmingBlock] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  useEffect(() => {
    collaborationService
      .getById(id)
      .then(({ data }) => setCollaboration(data.collaboration))
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    function handleUpdate(updated) {
      if (updated._id === id) {
        setCollaboration(updated);
      }
    }
    socket.on('collaboration:updated', handleUpdate);
    return () => socket.off('collaboration:updated', handleUpdate);
  }, [id]);

  if (isAuthLoading) return null;
  if (!currentUser) return <Navigate to="/" replace />;

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

  if (!collaboration) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-charcoal/50">
        Loading…
      </div>
    );
  }

  const other = collaboration.participants.find((p) => p.user._id !== currentUser.id);
  const self = collaboration.participants.find((p) => p.user._id === currentUser.id);
  const isYourTurn =
    collaboration.status === 'in_progress' && collaboration.turnOwner._id === currentUser.id;

  async function handleSubmitTurn(content) {
    const { data } = await collaborationService.submitTurn(id, content);
    setCollaboration(data.collaboration);
  }

  async function handleRespond(approve) {
    const { data } = await collaborationService.respondToCompletion(id, approve);
    setCollaboration(data.collaboration);
  }

  async function handleTogglePublished(published) {
    const { data } = await collaborationService.setPublished(id, published);
    setCollaboration(data.collaboration);
  }

  async function handleToggleConsent(consent) {
    const { data } = await collaborationService.setPublishConsent(id, consent);
    setCollaboration(data.collaboration);
  }

  async function handleBlock() {
    try {
      await moderationService.blockUser(id);
      setBlockMessage('Blocked');
    } catch (err) {
      setBlockMessage(err.message);
    } finally {
      setIsConfirmingBlock(false);
    }
  }

  async function handleLeave() {
    try {
      const { data } = await collaborationService.leave(id);
      setCollaboration(data.collaboration);
    } catch (err) {
      setLeaveError(err.message);
    } finally {
      setIsConfirmingLeave(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 animate-fade-in">
        <header className="flex flex-wrap items-center justify-between gap-y-2">
          <Link to="/" className="flex items-center gap-2">
            <PenMark className="h-6 w-6 text-indigo" />
            <span className="font-serif text-xl text-charcoal">Pairagraph</span>
          </Link>
          <div className="flex max-w-full items-center gap-2">
            <span className="truncate text-sm text-charcoal/50">
              {collaboration.writingType === 'poem' ? 'Poem' : 'Story'} with{' '}
              {other?.user.displayName}
            </span>
            {other && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  className="rounded-full border border-charcoal/15 px-2.5 py-1 text-xs text-charcoal/50 transition hover:border-red-300 hover:text-red-600"
                >
                  Report
                </button>
                {isConfirmingBlock ? (
                  <span className="flex items-center gap-1.5 text-xs text-charcoal/50">
                    Block?
                    <button
                      type="button"
                      onClick={handleBlock}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingBlock(false)}
                      className="hover:underline"
                    >
                      Cancel
                    </button>
                  </span>
                ) : blockMessage ? (
                  <span className="text-xs text-charcoal/50">{blockMessage}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingBlock(true)}
                    className="rounded-full border border-charcoal/15 px-2.5 py-1 text-xs text-charcoal/50 transition hover:border-red-300 hover:text-red-600"
                  >
                    Block
                  </button>
                )}
                {collaboration.status === 'in_progress' &&
                  (isConfirmingLeave ? (
                    <span className="flex items-center gap-1.5 text-xs text-charcoal/50">
                      Leave?
                      <button
                        type="button"
                        onClick={handleLeave}
                        className="font-medium text-red-600 hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsConfirmingLeave(false)}
                        className="hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingLeave(true)}
                      className="rounded-full border border-charcoal/15 px-2.5 py-1 text-xs text-charcoal/50 transition hover:border-red-300 hover:text-red-600"
                    >
                      Leave
                    </button>
                  ))}
                {leaveError && <span className="text-xs text-red-600">{leaveError}</span>}
              </div>
            )}
          </div>
        </header>

        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          collaborationId={id}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="flex flex-col gap-8">
            {collaboration.status === 'in_progress' && (
              <p className="rounded-lg bg-indigo-tint px-4 py-2.5 text-center text-sm text-indigo-dark">
                {collaboration.writingType === 'poem'
                  ? 'One line per turn — take it slow, make it count.'
                  : 'One paragraph per turn — pass the page when you\'re done.'}
              </p>
            )}

            <div className="flex flex-col gap-4 rounded-2xl border border-charcoal/10 bg-white/50 p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-charcoal/40">
                  {STATUS_LABEL[collaboration.status]}
                </span>
                {collaboration.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => downloadCollaborationPdf(collaboration)}
                    className="rounded-full border border-indigo/40 px-3 py-1.5 text-xs font-medium text-indigo-dark transition hover:border-indigo hover:bg-indigo-tint"
                  >
                    Download PDF
                  </button>
                )}
              </div>
              <KeywordChips keywords={collaboration.keywords} />
              <div className="h-px w-full bg-charcoal/10" />
              <EntryList entries={collaboration.entries} />
            </div>

            {collaboration.status === 'completed' && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-charcoal/5 px-4 py-3 text-xs text-charcoal/60">
                <span>
                  {collaboration.isPublished
                    ? 'Published to the public gallery.'
                    : 'Not published — only you two can see this.'}{' '}
                  Either of you can publish or unpublish it, and each of you decides separately
                  whether your own name is shown.
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={self?.hasConsentedToPublish ?? false}
                      onChange={(e) => handleToggleConsent(e.target.checked)}
                    />
                    Show my name
                  </label>
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(!collaboration.isPublished)}
                    className="rounded-full border border-indigo/40 px-3 py-1.5 font-medium text-indigo-dark transition hover:border-indigo hover:bg-indigo-tint"
                  >
                    {collaboration.isPublished ? 'Remove from gallery' : 'Publish to gallery'}
                  </button>
                </div>
              </div>
            )}

            {collaboration.status === 'in_progress' ? (
              isYourTurn ? (
                <TurnComposer
                  onSubmit={handleSubmitTurn}
                  placeholder={
                    collaboration.writingType === 'poem' ? 'Write your line…' : 'Write your paragraph…'
                  }
                />
              ) : (
                <p className="text-center text-sm text-charcoal/50">
                  Waiting for {other?.user.displayName}'s turn.
                </p>
              )
            ) : collaboration.status === 'left' ? (
              <p className="text-center text-sm text-charcoal/50">
                {collaboration.leftBy === currentUser.id
                  ? 'You left this collaboration.'
                  : `${other?.user.displayName} left this collaboration.`}
              </p>
            ) : (
              <p className="text-center text-sm text-charcoal/50">
                This collaboration is {STATUS_LABEL[collaboration.status].toLowerCase()}.
              </p>
            )}

            {collaboration.status === 'in_progress' && (
              <CompletionControls
                collaboration={collaboration}
                currentUserId={currentUser.id}
                onRespond={handleRespond}
              />
            )}
          </div>

          <ChatPanel
            collaborationId={id}
            currentUserId={currentUser.id}
            isActive={collaboration.status === 'in_progress'}
          />
        </div>
      </div>
    </div>
  );
}
