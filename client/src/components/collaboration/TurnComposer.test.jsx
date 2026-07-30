import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TurnComposer } from './TurnComposer.jsx';

// A plain textarea standing in for Tiptap's rich-text editor — Tiptap is a
// well-tested third-party library in its own right, and what's actually
// under test here is TurnComposer's own isBlank gating and submit/error
// handling, not the editor's own behavior.
vi.mock('./RichTextEditor.jsx', () => ({
  RichTextEditor: ({ value, onChange, placeholder }) => (
    <textarea placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

test('submit is disabled while the editor is blank', () => {
  render(<TurnComposer onSubmit={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Add your turn/ })).toBeDisabled();
});

test('submit is disabled for whitespace-only content', async () => {
  const user = userEvent.setup();
  render(<TurnComposer onSubmit={vi.fn()} />);

  await user.type(screen.getByRole('textbox'), '   ');

  expect(screen.getByRole('button', { name: /Add your turn/ })).toBeDisabled();
});

test('typing real content enables submit, which calls onSubmit and clears the editor', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<TurnComposer onSubmit={onSubmit} />);

  const editor = screen.getByRole('textbox');
  await user.type(editor, 'Once upon a time.');
  const button = screen.getByRole('button', { name: /Add your turn/ });
  expect(button).toBeEnabled();

  await user.click(button);

  expect(onSubmit).toHaveBeenCalledWith('Once upon a time.');
  expect(editor).toHaveValue('');
});

test('shows an error and keeps the content when onSubmit rejects', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockRejectedValue(new Error("It's not your turn"));
  render(<TurnComposer onSubmit={onSubmit} />);

  const editor = screen.getByRole('textbox');
  await user.type(editor, 'Once upon a time.');
  await user.click(screen.getByRole('button', { name: /Add your turn/ }));

  expect(await screen.findByText("It's not your turn")).toBeInTheDocument();
  expect(editor).toHaveValue('Once upon a time.');
});
