import { forwardRef, useImperativeHandle } from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { RegisterModal } from './RegisterModal.jsx';

// RegisterModal renders <Link>s to /terms and /privacy, which need a router
// context to exist at all — a MemoryRouter is the standard way to provide
// one in tests without a real browser URL.
function renderRegisterModal(props) {
  return render(
    <MemoryRouter>
      <RegisterModal isOpen onClose={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

const { mockRegister, mockReset } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock('./GoogleSignInButton.jsx', () => ({
  GoogleSignInButton: () => null,
}));

// A single button standing in for the real Cloudflare widget — clicking it
// fires onVerify the same way a solved CAPTCHA would, and reset() is exposed
// via the same forwardRef/useImperativeHandle contract the real component
// uses, so RegisterModal's ref-based reset call can actually be observed.
vi.mock('./TurnstileWidget.jsx', () => ({
  TurnstileWidget: forwardRef(function TurnstileWidgetStub({ onVerify }, ref) {
    useImperativeHandle(ref, () => ({ reset: mockReset }));
    return (
      <button type="button" onClick={() => onVerify('fake-token')}>
        Simulate CAPTCHA
      </button>
    );
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillAndVerifyCaptcha(user) {
  await user.type(screen.getByPlaceholderText('Display name'), 'Alice');
  await user.type(screen.getByPlaceholderText('Email'), 'alice@example.com');
  await user.type(screen.getByPlaceholderText(/Password/), 'correct-horse-1');
  await user.click(screen.getByRole('button', { name: 'Simulate CAPTCHA' }));
}

test('submit is disabled until CAPTCHA is verified', () => {
  renderRegisterModal();
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
});

describe('the CAPTCHA single-use-token regression', () => {
  test('resets the CAPTCHA token after a failed submission for an unrelated reason', async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue(new Error('An account with that email already exists'));

    renderRegisterModal();
    await fillAndVerifyCaptcha(user);

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(await screen.findByText('An account with that email already exists')).toBeInTheDocument();
    // The token Cloudflare issued was already spent by this failed attempt —
    // the widget must be told to issue a fresh one, and the submit button
    // must go back to disabled until that happens.
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();
  });
});

test('submits successfully and shows the success message when CAPTCHA and registration both succeed', async () => {
  const user = userEvent.setup();
  mockRegister.mockResolvedValue({ message: 'Check your email to verify your account.' });

  renderRegisterModal();
  await fillAndVerifyCaptcha(user);
  await user.click(screen.getByRole('button', { name: 'Create account' }));

  expect(await screen.findByText('Check your email to verify your account.')).toBeInTheDocument();
  expect(mockRegister).toHaveBeenCalledWith({
    displayName: 'Alice',
    email: 'alice@example.com',
    password: 'correct-horse-1',
    captchaToken: 'fake-token',
  });
});
