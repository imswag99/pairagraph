const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Bypassed entirely (always "human") when no secret key is configured — the
// same graceful-degradation convention GEMINI_API_KEY already uses, so local
// dev and CI need no setup and only an environment with the real key
// (production) actually gets bot protection.
async function verifyToken(token, remoteip) {
  const secret = process.env.CAPTCHA_SECRET_KEY;
  if (!secret) {
    return true;
  }

  const body = new URLSearchParams({ secret, response: token ?? '' });
  if (remoteip) {
    body.set('remoteip', remoteip);
  }

  const res = await fetch(VERIFY_URL, { method: 'POST', body });
  const data = await res.json();
  return Boolean(data.success);
}

// Exported as a single mutable object (rather than a named export) so tests
// can swap it with node:test's mock.method without hitting the real API —
// same reason utils/mailer.js is shaped this way.
export const turnstile = { verifyToken };
