import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export function generateAccessToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES,
  });
}

export function generateRefreshToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// Used for email verification tokens and for hashing refresh tokens before
// storing them on the User document, so the raw token never touches the DB.
export function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
