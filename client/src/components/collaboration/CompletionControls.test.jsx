import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompletionControls } from './CompletionControls.jsx';

function makeCollaboration({ selfApproved = null, otherApproved = null } = {}) {
  return {
    participants: [
      { user: { _id: 'me', displayName: 'Me' }, hasApproved: selfApproved },
      { user: { _id: 'them', displayName: 'Them' }, hasApproved: otherApproved },
    ],
  };
}

test('neither participant has responded: shows the suggest button, which calls onRespond(true)', async () => {
  const user = userEvent.setup();
  const onRespond = vi.fn();
  render(
    <CompletionControls
      collaboration={makeCollaboration()}
      currentUserId="me"
      onRespond={onRespond}
    />
  );

  const button = screen.getByRole('button', { name: 'Suggest wrapping this up' });
  await user.click(button);

  expect(onRespond).toHaveBeenCalledWith(true);
});

test('the current user already approved: shows a waiting message, no buttons', () => {
  render(
    <CompletionControls
      collaboration={makeCollaboration({ selfApproved: true })}
      currentUserId="me"
      onRespond={vi.fn()}
    />
  );

  expect(screen.getByText(/waiting on Them/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('the other participant approved: Agree calls onRespond(true), Decline calls onRespond(false)', async () => {
  const user = userEvent.setup();
  const onRespond = vi.fn();
  render(
    <CompletionControls
      collaboration={makeCollaboration({ otherApproved: true })}
      currentUserId="me"
      onRespond={onRespond}
    />
  );

  expect(screen.getByText(/Them wants to wrap this up/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Decline' }));
  expect(onRespond).toHaveBeenLastCalledWith(false);

  await user.click(screen.getByRole('button', { name: 'Agree' }));
  expect(onRespond).toHaveBeenLastCalledWith(true);
});
