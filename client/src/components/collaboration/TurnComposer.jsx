import { useState } from 'react';
import { RichTextEditor } from './RichTextEditor.jsx';

function isBlank(html) {
  return html.replace(/<[^>]*>/g, '').trim().length === 0;
}

export function TurnComposer({ onSubmit, placeholder = 'Continue the page…' }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (isBlank(content)) return;

    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(content);
      setContent('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <RichTextEditor value={content} onChange={setContent} placeholder={placeholder} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting || isBlank(content)}
        className="self-end rounded-full bg-indigo px-6 py-2 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Add your turn'}
      </button>
    </form>
  );
}
