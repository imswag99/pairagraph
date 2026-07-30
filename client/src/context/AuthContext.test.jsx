import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { authService } from '../services/authService.js';

vi.mock('../services/authService.js', () => ({
  authService: {
    me: vi.fn(),
    refresh: vi.fn(),
    login: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    verifyEmail: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('session restore', () => {
  test('sets currentUser when /auth/me succeeds', async () => {
    authService.me.mockResolvedValue({ data: { user: { id: '1', displayName: 'Alice' } } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentUser).toEqual({ id: '1', displayName: 'Alice' });
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  test('falls back to refresh then retries /auth/me when the first /auth/me fails', async () => {
    authService.me
      .mockRejectedValueOnce(new Error('no session'))
      .mockResolvedValueOnce({ data: { user: { id: '2', displayName: 'Bob' } } });
    authService.refresh.mockResolvedValue({});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(authService.me).toHaveBeenCalledTimes(2);
    expect(result.current.currentUser).toEqual({ id: '2', displayName: 'Bob' });
  });

  test('leaves currentUser null when both /auth/me and refresh fail', async () => {
    authService.me.mockRejectedValue(new Error('no session'));
    authService.refresh.mockRejectedValue(new Error('refresh failed'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentUser).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('login / logout', () => {
  test('login sets currentUser from the response', async () => {
    authService.me.mockRejectedValue(new Error('no session'));
    authService.refresh.mockRejectedValue(new Error('no refresh'));
    authService.login.mockResolvedValue({ data: { user: { id: '3', displayName: 'Carol' } } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ email: 'carol@example.com', password: 'x' });
    });

    expect(result.current.currentUser).toEqual({ id: '3', displayName: 'Carol' });
    expect(result.current.isAuthenticated).toBe(true);
  });

  test('logout clears currentUser', async () => {
    authService.me.mockResolvedValue({ data: { user: { id: '4', displayName: 'Dana' } } });
    authService.logout.mockResolvedValue({});

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentUser).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.currentUser).toBeNull();
  });
});
