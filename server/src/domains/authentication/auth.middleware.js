import { ApiError } from '../../utils/ApiError.js';
import { verifyAccessToken } from '../../utils/tokens.js';
import { User } from './auth.model.js';

// role/ban status isn't in the JWT payload (just { sub: userId }), so this
// re-checks the DB fresh on every request rather than trusting a stale token
// claim — a ban or role change takes effect on the very next request, not
// just on the next login/refresh. req.user carries the fetched role forward
// so requireAdmin/blockInactiveParticipant don't need their own DB round trip.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    return next(new ApiError(401, 'Invalid or expired access token'));
  }

  const user = await User.findById(decoded.sub).select('role isBanned');
  if (user?.isBanned) {
    return next(new ApiError(403, 'Your account has been suspended.'));
  }

  req.user = { id: decoded.sub, role: user?.role };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'));
  }
  next();
}

// Gates the specific endpoints where a user actually acts as a writing
// participant (joining/redeeming, submitting a turn, chatting). Banning is
// already fully handled by requireAuth above; this only adds the
// admin-can't-participate rule, so promoting someone to admin also
// immediately retires them as a writer.
export function blockInactiveParticipant(req, res, next) {
  if (req.user.role === 'admin') {
    return next(new ApiError(403, "Admin accounts can't participate in collaborations."));
  }
  next();
}
