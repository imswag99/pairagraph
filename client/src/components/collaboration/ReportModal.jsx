import { useState } from 'react';
import { Modal } from '../auth/Modal.jsx';
import { moderationService } from '../../services/moderationService.js';

const inputClasses =
  'w-full rounded-lg border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 transition focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15';

const REASONS = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
];

export function ReportModal({ isOpen, onClose, collaborationId, mode = 'participant' }) {
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function handleClose() {
    setReason('harassment');
    setDetails('');
    setError('');
    setMessage('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'gallery') {
        await moderationService.reportGalleryContent(collaborationId, reason, details);
      } else {
        await moderationService.reportUser(collaborationId, reason, details);
      }
      setMessage("Thanks — we've received your report.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={mode === 'gallery' ? 'Report this piece' : 'Report this user'}>
      {message ? (
        <p role="status" className="text-sm text-charcoal/70">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="report-reason" className="sr-only">Reason</label>
          <select
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClasses}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <label htmlFor="report-details" className="sr-only">Anything else we should know? (optional)</label>
          <textarea
            id="report-details"
            placeholder="Anything else we should know? (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={4}
            className={inputClasses}
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo py-2.5 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting…' : 'Submit report'}
          </button>
        </form>
      )}
    </Modal>
  );
}
