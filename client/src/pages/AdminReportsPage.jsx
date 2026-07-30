import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AdminShell } from '../components/layout/AdminShell.jsx';
import { moderationService } from '../services/moderationService.js';
import { adminService } from '../services/adminService.js';

const REASON_LABEL = {
  harassment: 'Harassment',
  spam: 'Spam',
  inappropriate_content: 'Inappropriate content',
  other: 'Other',
};

function formatDate(dateString) {
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function CollaborationPreview({ collaborationId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isUnpublishing, setIsUnpublishing] = useState(false);

  useEffect(() => {
    adminService
      .getCollaboration(collaborationId)
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.message));
  }, [collaborationId]);

  async function handleUnpublish() {
    setIsUnpublishing(true);
    try {
      await adminService.unpublishCollaboration(collaborationId);
      setData((prev) => ({
        ...prev,
        collaboration: { ...prev.collaboration, isPublished: false },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUnpublishing(false);
    }
  }

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!data) return <p className="text-xs text-charcoal/40">Loading…</p>;

  const { collaboration, messages } = data;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-charcoal/[0.03] p-4">
      {collaboration.isPublished && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-indigo-tint px-3 py-2 text-xs text-indigo-dark">
          <span>This piece is currently published to the public gallery.</span>
          <button
            type="button"
            onClick={handleUnpublish}
            disabled={isUnpublishing}
            className="rounded-full border border-indigo/40 px-3 py-1 font-medium transition hover:border-indigo hover:bg-white/50 disabled:opacity-60"
          >
            {isUnpublishing ? 'Unpublishing…' : 'Unpublish'}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <span className="text-xs uppercase tracking-wide text-charcoal/40">Entries</span>
        {collaboration.entries.length === 0 ? (
          <p className="text-sm text-charcoal/40">No entries yet.</p>
        ) : (
          collaboration.entries.map((entry, index) => (
            <div key={index} className="flex flex-col gap-1">
              <div
                className="break-words font-serif text-sm leading-relaxed text-charcoal [&_p]:m-0"
                dangerouslySetInnerHTML={{ __html: entry.content }}
              />
              <span className="text-xs text-charcoal/40">— {entry.author.displayName}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-charcoal/40">Chat</span>
        {messages.length === 0 ? (
          <p className="text-sm text-charcoal/40">No chat messages.</p>
        ) : (
          messages.map((message) => (
            <p key={message._id} className="text-sm text-charcoal">
              <strong>{message.sender.displayName}:</strong> {message.content}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function ReportRow({ report, onMarkReviewed }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  async function handleMarkReviewed() {
    setIsSaving(true);
    try {
      await onMarkReviewed(report._id);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-charcoal/10 bg-white/50 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-charcoal/40">
          {REASON_LABEL[report.reason] ?? report.reason}
        </span>
        <span className="text-xs text-charcoal/40">{formatDate(report.createdAt)}</span>
      </div>

      <p className="text-sm text-charcoal">
        <strong>{report.reporter?.displayName ?? 'Deleted user'}</strong> ({report.reporter?.email})
        {report.source === 'gallery' ? (
          ' reported a published piece'
        ) : (
          <>
            {' → '}
            <strong>{report.reportedUser?.displayName ?? 'Deleted user'}</strong> ({report.reportedUser?.email})
          </>
        )}
      </p>

      {report.details && <p className="text-sm text-charcoal/70">{report.details}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="text-xs text-indigo-dark underline decoration-indigo/30 underline-offset-4 hover:text-indigo"
        >
          {isExpanded ? 'Hide collaboration' : 'View collaboration'}
        </button>
        {report.status === 'reviewed' ? (
          <span className="text-xs text-charcoal/40">Reviewed</span>
        ) : (
          <button
            type="button"
            onClick={handleMarkReviewed}
            disabled={isSaving}
            className="rounded-full border border-charcoal/15 px-3 py-1 text-xs text-charcoal/70 transition hover:border-indigo/40 hover:text-charcoal disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Mark reviewed'}
          </button>
        )}
      </div>

      {isExpanded && <CollaborationPreview collaborationId={report.collaboration} />}
    </div>
  );
}

export function AdminReportsPage() {
  const { currentUser, logout, isLoading } = useAuth();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    moderationService
      .listReports()
      .then(({ data }) => setReports(data.reports))
      .catch((err) => setError(err.message));
  }, [currentUser]);

  async function handleMarkReviewed(reportId) {
    const { data } = await moderationService.markReportReviewed(reportId);
    setReports((prev) => prev.map((r) => (r._id === reportId ? data.report : r)));
  }

  if (isLoading) return null;
  if (currentUser?.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <AdminShell currentUser={currentUser} logout={logout}>
      <h1 className="font-serif text-2xl text-charcoal">Reports</h1>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : reports === null ? (
        <p className="text-sm text-charcoal/50">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-10 text-center text-sm text-charcoal/50">
          No reports have been filed.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <ReportRow key={report._id} report={report} onMarkReviewed={handleMarkReviewed} />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
