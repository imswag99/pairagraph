import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inviteService } from '../../services/inviteService.js';
import { WritingTypePicker } from './WritingTypePicker.jsx';
import { ThemePicker } from './ThemePicker.jsx';
import { PickerField } from './PickerField.jsx';

function extractCode(input) {
  const trimmed = input.trim();
  const segments = trimmed.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}

function JoinTab() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    if (!input.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      const { data } = await inviteService.redeem(extractCode(input));
      navigate(`/collaborations/${data.collaborationId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="Paste an invite link or code"
          className="flex-1 rounded-lg border border-charcoal/15 bg-white/70 px-3 py-2 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
        />
        <button
          type="button"
          onClick={handleJoin}
          disabled={isSubmitting || !input.trim()}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
        >
          {isSubmitting ? 'Joining…' : 'Join'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function InvitePanel() {
  const [tab, setTab] = useState('create');
  const [writingType, setWritingType] = useState('story');
  const [theme, setTheme] = useState('classic');
  const [activeInvite, setActiveInvite] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    inviteService.listMine().then(({ data }) => {
      const pending = data.invites.find((invite) => invite.status === 'pending');
      if (pending) setActiveInvite(pending);
    });
  }, []);

  async function handleCreate() {
    setError('');
    setIsSubmitting(true);
    try {
      const { data } = await inviteService.create(writingType, theme);
      setActiveInvite(data.invite);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setIsSubmitting(true);
    try {
      await inviteService.cancel(activeInvite.id);
      setActiveInvite(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopy() {
    const link = `${window.location.origin}/invite/${activeInvite.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-charcoal/10 bg-white/50 p-5">
      <div>
        <h3 className="font-serif text-lg text-charcoal">Invite a friend</h3>
        <p className="text-sm text-charcoal/70">
          {tab === 'create' ? 'Send a link to write with someone.' : 'Have a link or code? Join here.'}
        </p>
      </div>

      <div className="flex rounded-full bg-charcoal/5 p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab('create')}
          aria-pressed={tab === 'create'}
          className={`flex-1 rounded-full py-1.5 transition ${
            tab === 'create' ? 'bg-indigo text-paper shadow-soft' : 'text-charcoal/50 hover:text-charcoal'
          }`}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setTab('join')}
          aria-pressed={tab === 'join'}
          className={`flex-1 rounded-full py-1.5 transition ${
            tab === 'join' ? 'bg-indigo text-paper shadow-soft' : 'text-charcoal/50 hover:text-charcoal'
          }`}
        >
          Join a link
        </button>
      </div>

      {tab === 'join' ? (
        <JoinTab />
      ) : activeInvite ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={`${window.location.origin}/invite/${activeInvite.code}`}
              className="flex-1 rounded-lg border border-charcoal/15 bg-white/70 px-3 py-2 text-xs text-charcoal/70"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-indigo px-3 py-2 text-xs font-medium text-paper transition hover:bg-indigo-dark"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal/70">Waiting for them to join&hellip;</span>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg bg-charcoal/5 p-3">
            <PickerField label="Writing type">
              <WritingTypePicker value={writingType} onChange={setWritingType} />
            </PickerField>
            <PickerField label="Theme">
              <ThemePicker value={theme} onChange={setTheme} />
            </PickerField>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSubmitting}
            className="self-start rounded-full border border-indigo/50 px-5 py-2 text-sm font-medium text-indigo-dark transition hover:border-indigo hover:bg-indigo-tint disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create invite link'}
          </button>
        </>
      )}
    </div>
  );
}
