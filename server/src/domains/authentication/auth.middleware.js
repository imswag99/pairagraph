import { ApiError } from '../../utils/ApiError.js';
import { verifyAccessToken } from '../../utils/tokens.js';

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
