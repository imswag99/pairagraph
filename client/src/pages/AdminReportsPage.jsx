import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { moderationService } from '../services/moderationService.js';

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

function ReportRow({ report, onMarkReviewed }) {
  const [isSaving, setIsSaving] = useState(false);

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
        {' → '}
        <strong>{report.reportedUser?.displayName ?? 'Deleted user'}</strong> ({report.reportedUser?.email})
      </p>

      {report.details && <p className="text-sm text-charcoal/60">{report.details}</p>}

      <div className="flex items-center gap-3">
        <Link
          to={`/collaborations/${report.collaboration}`}
          className="text-xs text-indigo-dark underline decoration-indigo/30 underline-offset-4 hover:text-indigo"
        >
          View collaboration
        </Link>
        {report.status === 'reviewed' ? (
          <span className="text-xs text-charcoal/40">Reviewed</span>
        ) : (
          <button
            type="button"
            onClick={handleMarkReviewed}
            disabled={isSaving}
            className="rounded-full border border-charcoal/15 px-3 py-1 text-xs text-charcoal/60 transition hover:border-indigo/40 hover:text-charcoal disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Mark reviewed'}
          </button>
        )}
      </div>
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
    <AppShell currentUser={currentUser} logout={logout}>
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
    </AppShell>
  );
}
