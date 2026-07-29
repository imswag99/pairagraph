import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { turnstile } from './turnstile.js';

let originalSecret;

beforeEach(() => {
  originalSecret = process.env.CAPTCHA_SECRET_KEY;
  process.env.CAPTCHA_SECRET_KEY = 'test-secret';
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CAPTCHA_SECRET_KEY;
  } else {
    process.env.CAPTCHA_SECRET_KEY = originalSecret;
  }
  mock.restoreAll();
});

test('verifyToken returns true when Cloudflare reports success', async () => {
  mock.method(globalThis, 'fetch', async () => ({
    json: async () => ({ success: true }),
  }));

  const result = await turnstile.verifyToken('a-real-token', '1.2.3.4');
  assert.equal(result, true);
});

test('verifyToken returns false when Cloudflare reports failure', async () => {
  mock.method(globalThis, 'fetch', async () => ({
    json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
  }));

  const result = await turnstile.verifyToken('a-bad-token');
  assert.equal(result, false);
});

test('verifyToken bypasses (returns true, never calls fetch) when no secret key is configured', async () => {
  delete process.env.CAPTCHA_SECRET_KEY;
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('fetch should not be called when unconfigured');
  });

  const result = await turnstile.verifyToken('anything');
  assert.equal(result, true);
  assert.equal(fetchMock.mock.calls.length, 0);
});
