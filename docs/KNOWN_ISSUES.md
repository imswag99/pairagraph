# Known Issues & Future Warnings

A single running list of what's deliberately left unfinished, in rough priority order. Check here before starting new work — some of these compound with new features (e.g. anything touching auth or CORS should re-check items 1-2 first).

Last reviewed: 2026-07-28, right after the first production deploy (Render + Vercel).

## Deployment-specific (only apply once live)

1. **Render free-tier cold starts.** The instance sleeps after ~15 min idle; the next request takes 30-60s to wake it. During that window, login can hang and Socket.IO connections drop instead of erroring cleanly. No code fix without paying for an always-on instance — consider a "waking up the server…" loading message if this becomes a recurring complaint.
2. **CORS is locked to a single origin** (`CLIENT_URL` env var, currently the production Vercel URL). If a branch/PR is ever deployed, Vercel's auto-generated preview URL won't match and will be silently CORS-blocked. Fine today since only the main URL is used; revisit if preview deploys start getting used.
3. **Env vars now live in three places** with no sync: local `.env` files, Render dashboard, Vercel dashboard. If any secret rotates (e.g. Gemini key, SMTP password), it has to be updated in all three manually.
4. **No staging environment.** Every push to `main` deploys straight to production on both platforms, gated only by the backend test suite in CI (and only if CI finishes before the platform's own auto-deploy kicks off).
5. **Google OAuth origins are manually registered** in Google Cloud Console. If the Vercel URL ever changes (custom domain, project rename), Google Sign-In will break with `origin_mismatch` until the new origin is added there.

## Dependency / security

6. **Four open dependency CVEs**, each needs a breaking major-version bump:
   - `nodemailer` — high severity, v6 → v9
   - `react-router` / `react-router-dom` — moderate, no fix in the 6.x line, needs v6 → v7
   - Vite / esbuild — moderate-high, dev-server only, needs v5 → v8
   - transitive `uuid`/`gaxios` issue via `google-auth-library` — fixing risks breaking Google Sign-In
   All investigated and consciously deferred as separate migration tasks. Free to fix, just real work with real risk of breakage — do one at a time, not bundled with unrelated changes.

## Testing / observability

7. **No frontend automated test coverage** — no Vitest/RTL, no Playwright. Backend has 44 passing tests in CI; frontend has none. The single biggest gap on the frontend side.
8. **No monitoring or error tracking.** If something breaks in production, there's no alert — only a user report. Free tiers exist (e.g. Sentry) but adding one is a new external service, not something to add without asking given the no-added-cost constraint.
9. **No structured logging** — raw `console.log`/`console.error` in a handful of backend places.
10. **No real accessibility audit** beyond a manual icon-only-control pass — contrast ratios, keyboard tab order, and screen-reader flow through multi-step forms haven't been systematically checked.

## Scaling (irrelevant on a single free instance, but will matter if that changes)

11. **Rate limiting is in-memory, single-instance only.** Resets on every process restart (which cold-starts make more frequent than a normal always-on server), and won't work correctly the moment there's more than one server instance.
12. **Socket.IO is single-instance only** — no Redis adapter or similar. Same caveat: fine now, breaks the moment there's more than one backend instance.

## Frontend polish

13. **No error boundary** — an unexpected render error currently white-screens instead of showing a fallback UI.
14. **Large single JS bundle** (>1MB warning on build) — Tiptap, jsPDF, and framer-motion all load upfront. `React.lazy` per route would help; not done.

## Product / cost decisions (not bugs)

15. **Gemini's 20/day free-tier ceiling** for AI-generated keywords — a deliberate cost decision, not a limitation to fix. Falls back to a local keyword pool once exhausted.
16. **Email sent via raw SMTP credentials** rather than a transactional email provider (e.g. SendGrid/Postmark) — works, but has no delivery tracking or bounce handling. A paid-tier consideration, not a free fix.

---

See [`BACKEND.md`](BACKEND.md) and [`FRONTEND.md`](FRONTEND.md) for the full bug-fix history and architecture context behind these.
