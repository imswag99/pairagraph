import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchmakingService } from '../../services/matchmakingService.js';
import { WritingTypePicker } from './WritingTypePicker.jsx';
import { ThemePicker } from './ThemePicker.jsx';
import { PickerField } from './PickerField.jsx';

export function QuickMatchPanel() {
  const navigate = useNavigate();
  const [writingType, setWritingType] = useState('story');
  const [theme, setTheme] = useState('classic');
  const [isWaiting, setIsWaiting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    matchmakingService.status().then(({ data }) => {
      if (data.waiting) {
        setIsWaiting(true);
        setWritingType(data.writingType);
        if (data.theme) setTheme(data.theme);
      }
    });
  }, []);

  async function handleStart() {
    setError('');
    setIsSubmitting(true);
    try {
      const { data } = await matchmakingService.join(writingType, theme);
      if (data.matched) {
        navigate(`/collaborations/${data.collaborationId}`);
      } else {
        setIsWaiting(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setIsSubmitting(true);
    try {
      await matchmakingService.cancel();
      setIsWaiting(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-charcoal/10 bg-white/50 p-5">
      <div>
        <h3 className="font-serif text-lg text-charcoal">Quick Match</h3>
        <p className="text-sm text-charcoal/70">Get paired with someone waiting right now.</p>
      </div>

      {isWaiting ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-charcoal/70">
            Waiting for a {writingType} partner&hellip;
          </span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal disabled:opacity-60"
          >
            Cancel
          </button>
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
            onClick={handleStart}
            disabled={isSubmitting}
            className="self-start rounded-full bg-indigo px-5 py-2 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Starting…' : 'Start Quick Match'}
          </button>
        </>
      )}
    </div>
  );
}
