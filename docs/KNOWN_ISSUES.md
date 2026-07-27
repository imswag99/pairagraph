# Known Issues & Future Warnings

A single running list of what's deliberately left unfinished, in rough priority order. Check here before starting new work — some of these compound with new features (e.g. anything touching auth or CORS should re-check items 1-2 first).

Last reviewed: 2026-07-28, after fixing the forgot-password/email pipeline post-deploy.

## Deployment-specific (only apply once live)

1. **Render free-tier cold starts.** The instance sleeps after ~15 min idle; the next request takes 30-60s to wake it. During that window, login can hang and Socket.IO connections drop instead of erroring cleanly. No code fix without paying for an always-on instance — consider a "waking up the server…" loading message if this becomes a recurring complaint.
2. **CORS is locked to a single origin** (`CLIENT_URL` env var, currently the production Vercel URL). If a branch/PR is ever deployed, Vercel's auto-generated preview URL won't match and will be silently CORS-blocked. Fine today since only the main URL is used; revisit if preview deploys start getting used.
3. **Render blocks outbound raw SMTP connections.** Discovered when both Gmail's and SendGrid's SMTP servers timed out identically (`ETIMEDOUT` on `CONN`) from Render, despite working fine locally. Fixed by switching email sending to SendGrid's HTTP API instead of SMTP (see `BACKEND.md` §13, bug #14) — but worth remembering if any future integration is tempted to use raw SMTP/sockets on Render: prefer an HTTPS-based API instead.
4. **Env vars now live in three places** with no sync: local `.env` files, Render dashboard, Vercel dashboard. If any secret rotates (e.g. Gemini key, SendGrid API key), it has to be updated in all three manually.
5. **No staging environment.** Every push to `main` deploys straight to production on both platforms, gated only by the backend test suite in CI (and only if CI finishes before the platform's own auto-deploy kicks off).
6. **Google OAuth origins are manually registered** in Google Cloud Console. If the Vercel URL ever changes (custom domain, project rename), Google Sign-In will break with `origin_mismatch` until the new origin is added there.

## Dependency / security

7. **Three open dependency CVEs** (was four — removing `nodemailer` when email moved to SendGrid's HTTP API cleared its high-severity CVE as a side effect), each needs a breaking major-version bump:
   - `react-router` / `react-router-dom` — moderate, no fix in the 6.x line, needs v6 → v7
   - Vite / esbuild — moderate-high, dev-server only, needs v5 → v8
   - transitive `uuid`/`gaxios` issue via `google-auth-library` — fixing risks breaking Google Sign-In
   All investigated and consciously deferred as separate migration tasks. Free to fix, just real work with real risk of breakage — do one at a time, not bundled with unrelated changes.

## Testing / observability

8. **No frontend automated test coverage** — no Vitest/RTL, no Playwright. Backend has 44 passing tests in CI; frontend has none. The single biggest gap on the frontend side.
9. **No monitoring or error tracking.** If something breaks in production, there's no alert — only a user report. Free tiers exist (e.g. Sentry) but adding one is a new external service, not something to add without asking given the no-added-cost constraint.
10. **No structured logging** — raw `console.log`/`console.error` in a handful of backend places.
11. **No real accessibility audit** beyond a manual icon-only-control pass — contrast ratios, keyboard tab order, and screen-reader flow through multi-step forms haven't been systematically checked.

## Scaling (irrelevant on a single free instance, but will matter if that changes)

12. **Rate limiting is in-memory, single-instance only.** Resets on every process restart (which cold-starts make more frequent than a normal always-on server), and won't work correctly the moment there's more than one server instance.
13. **Socket.IO is single-instance only** — no Redis adapter or similar. Same caveat: fine now, breaks the moment there's more than one backend instance.

## Frontend polish

14. **No error boundary** — an unexpected render error currently white-screens instead of showing a fallback UI.
15. **Large single JS bundle** (>1MB warning on build) — Tiptap, jsPDF, and framer-motion all load upfront. `React.lazy` per route would help; not done.

## Product / cost decisions (not bugs)

16. **Gemini's 20/day free-tier ceiling** for AI-generated keywords — a deliberate cost decision, not a limitation to fix. Falls back to a local keyword pool once exhausted.
17. **`EMAIL_FROM` is a free Gmail address, not a verified custom domain** — confirmed in production testing: SendGrid reports 100% delivery, but the email lands in Gmail's Spam folder rather than the inbox (Gmail treats mail claiming to be `@gmail.com` but not sent through Google's own servers as suspicious, especially Gmail-to-Gmail). Fixing it properly means buying a domain, which isn't free — for now, the UI/support messaging should tell users to check spam if a reset/verification email seems missing.

---

See [`BACKEND.md`](BACKEND.md) and [`FRONTEND.md`](FRONTEND.md) for the full bug-fix history and architecture context behind these.
