import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeywords } from './ai.service.js';

// GEMINI_API_KEY is deliberately unset in CI (see docs/BACKEND.md §6), so
// every call here exercises the fallback pool path, never the real API.

test('generateKeywords returns 5 fallback words for the default (classic) theme', async () => {
  const keywords = await generateKeywords('story');
  assert.equal(keywords.length, 5);
});

test('generateKeywords returns 5 fallback words for a themed request', async () => {
  // The fallback pool doesn't vary by theme (deliberate v1 trade-off, see
  // BACKEND.md) — a themed call should still succeed and return a valid result.
  const keywords = await generateKeywords('poem', 'mystery');
  assert.equal(keywords.length, 5);
});
