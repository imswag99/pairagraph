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
