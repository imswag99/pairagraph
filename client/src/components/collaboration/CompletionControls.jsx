import { useState } from 'react';

export function CompletionControls({ collaboration, currentUserId, onRespond }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const self = collaboration.participants.find((p) => p.user._id === currentUserId);
  const other = collaboration.participants.find((p) => p.user._id !== currentUserId);

  async function respond(approve) {
    setIsSubmitting(true);
    try {
      await onRespond(approve);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (self.hasApproved === true) {
    return (
      <p className="text-sm text-charcoal/50">
        You've suggested wrapping this up — waiting on {other.user.displayName}.
      </p>
    );
  }

  if (other.hasApproved === true) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-indigo-tint px-4 py-3">
        <span className="text-sm text-indigo-dark">
          {other.user.displayName} wants to wrap this up.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => respond(true)}
            disabled={isSubmitting}
            className="rounded-full bg-indigo px-4 py-1.5 text-xs font-medium text-paper transition hover:bg-indigo-dark disabled:opacity-60"
          >
            Agree
          </button>
          <button
            type="button"
            onClick={() => respond(false)}
            disabled={isSubmitting}
            className="rounded-full border border-charcoal/20 px-4 py-1.5 text-xs text-charcoal/70 transition hover:border-charcoal/40 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => respond(true)}
      disabled={isSubmitting}
      className="self-start text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal disabled:opacity-60"
    >
      Suggest wrapping this up
    </button>
  );
}
