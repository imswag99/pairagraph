import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlow, setIsSlow] = useState(false);

  // Render's free tier sleeps the backend after ~15 min idle; the first
  // request can take 30-60s to wake it. Only surface a "this is slow"
  // signal once it's actually been a few seconds, so a normal fast load
  // never shows it.
  useEffect(() => {
    if (!isLoading) {
      setIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    async function restoreSession() {
      try {
        const { data } = await authService.me();
        setCurrentUser(data.user);
      } catch {
        try {
          await authService.refresh();
          const { data } = await authService.me();
          setCurrentUser(data.user);
        } catch {
          setCurrentUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const register = useCallback((payload) => authService.register(payload), []);

  const verifyEmail = useCallback((token) => authService.verifyEmail(token), []);

  const login = useCallback(async (payload) => {
    const { data } = await authService.login(payload);
    setCurrentUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    const { data } = await authService.googleLogin(idToken);
    setCurrentUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
  }, []);

  const forgotPassword = useCallback((email) => authService.forgotPassword(email), []);

  const resetPassword = useCallback(
    (token, password) => authService.resetPassword(token, password),
    []
  );

  const updateProfile = useCallback(async (displayName) => {
    const { data } = await authService.updateProfile(displayName);
    setCurrentUser(data.user);
    return data.user;
  }, []);

  const changePassword = useCallback(
    (currentPassword, newPassword) => authService.changePassword(currentPassword, newPassword),
    []
  );

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    setCurrentUser(null);
  }, []);

  const value = {
    currentUser,
    isLoading,
    isSlow,
    isAuthenticated: Boolean(currentUser),
    register,
    verifyEmail,
    login,
    loginWithGoogle,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
