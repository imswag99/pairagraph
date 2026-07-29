import { ApiError } from '../../utils/ApiError.js';
import { verifyAccessToken } from '../../utils/tokens.js';
import { User } from './auth.model.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired access token'));
  }
}

// role isn't in the JWT payload (just { sub: userId }), so this re-checks the
// DB fresh on every request rather than trusting a stale token claim — a role
// change takes effect immediately, with no re-login required.
export async function requireAdmin(req, res, next) {
  const user = await User.findById(req.user.id).select('role');
  if (user?.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'));
  }
  next();
}

// Gates the specific endpoints where a user actually acts as a writing
// participant (joining/redeeming, submitting a turn, chatting). A ban only
// blocks login going forward — an already-issued access token still passes
// requireAuth until it expires (JWT_ACCESS_EXPIRES) — so this is what makes a
// ban take effect immediately on the entry points that matter, same
// fresh-DB-check pattern as requireAdmin. Admin accounts are blocked here too
// so promoting someone to admin also immediately retires them as a writer.
export async function blockInactiveParticipant(req, res, next) {
  const user = await User.findById(req.user.id).select('role isBanned');
  if (user?.isBanned) {
    return next(new ApiError(403, 'Your account has been suspended.'));
  }
  if (user?.role === 'admin') {
    return next(new ApiError(403, "Admin accounts can't participate in collaborations."));
  }
  next();
}
