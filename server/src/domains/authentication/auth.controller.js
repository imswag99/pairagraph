import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { verifyRefreshToken } from '../../utils/tokens.js';
import * as authService from './auth.service.js';

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // matches JWT_ACCESS_EXPIRES default (15m)
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches JWT_REFRESH_EXPIRES default (7d)

// In dev, frontend (localhost:5173) and API (localhost:5000) are different
// ports but the same site, so 'lax' + no Secure flag works over plain http.
// In production they're different domains entirely (vercel.app / onrender.com)
// — that's genuinely cross-site, so the cookie needs SameSite=None, which
// browsers only honor when Secure is also set (i.e. real HTTPS).
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerHandler = asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'A valid email is required');
  }
  if (!password || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }
  if (!displayName || !displayName.trim()) {
    throw new ApiError(400, 'Display name is required');
  }

  const user = await authService.register({ email, password, displayName: displayName.trim() });
  res.status(201).json({
    success: true,
    message: "Account created. Check your email to verify your address (don't see it? check spam).",
    data: { user },
  });
});

export const verifyEmailHandler = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const user = await authService.verifyEmail(token);
  res.json({ success: true, message: 'Email verified', data: { user } });
});

export const loginHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const { user, accessToken, refreshToken } = await authService.login({ email, password });
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ success: true, data: { user } });
});

export const googleLoginHandler = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    throw new ApiError(400, 'Google ID token is required');
  }

  const { user, accessToken, refreshToken } = await authService.googleLogin(idToken);
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ success: true, data: { user } });
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.refresh(req.cookies?.refreshToken);
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ success: true, data: { user } });
});

export const logoutHandler = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await authService.logout(decoded.sub);
    } catch {
      // Refresh token already invalid/expired — nothing to clear server-side.
    }
  }
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out' });
});

export const meHandler = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ success: true, data: { user } });
});

export const forgotPasswordHandler = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'A valid email is required');
  }

  await authService.requestPasswordReset(email);
  res.json({
    success: true,
    message: 'If an account exists for that email, a reset link is on its way.',
  });
});

export const resetPasswordHandler = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  const user = await authService.resetPassword(req.params.token, password);
  res.json({ success: true, message: 'Password updated. You can now log in.', data: { user } });
});

export const updateProfileHandler = asyncHandler(async (req, res) => {
  const { displayName } = req.body;
  if (!displayName || !displayName.trim()) {
    throw new ApiError(400, 'Display name is required');
  }

  const user = await authService.updateProfile(req.user.id, { displayName: displayName.trim() });
  res.json({ success: true, data: { user } });
});

export const changePasswordHandler = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'Current password and a new password (min 8 characters) are required');
  }

  await authService.changePassword(req.user.id, { currentPassword, newPassword });
  res.json({ success: true, message: 'Password updated' });
});

export const deleteAccountHandler = asyncHandler(async (req, res) => {
  await authService.deleteAccount(req.user.id);
  clearAuthCookies(res);
  res.json({ success: true, message: 'Account deleted' });
});
