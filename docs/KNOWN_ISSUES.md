# Known Issues & Future Warnings

A single running list of what's deliberately left unfinished, in rough priority order. Check here before starting new work — some of these compound with new features (e.g. anything touching auth or CORS should re-check items 1-2 first).

Last reviewed: 2026-07-29, after separating the admin path from the writer path and adding user ban/delete management.

## Deployment-specific (only apply once live)

1. **Render free-tier cold starts.** The instance sleeps after ~15 min idle; the next request takes 30-60s to wake it. During that window, login can hang and Socket.IO connections drop instead of erroring cleanly. No code fix without paying for an always-on instance — consider a "waking up the server…" loading message if this becomes a recurring complaint.
2. **CORS is locked to a single origin** (`CLIENT_URL` env var, currently the production Vercel URL). If a branch/PR is ever deployed, Vercel's auto-generated preview URL won't match and will be silently CORS-blocked. Fine today since only the main URL is used; revisit if preview deploys start getting used.
3. **Render blocks outbound raw SMTP connections.** Discovered when both Gmail's and SendGrid's SMTP servers timed out identically (`ETIMEDOUT` on `CONN`) from Render, despite working fine locally. Fixed by switching email sending to an HTTP API instead of SMTP (see `BACKEND.md` §14, bugs #14 and #16) — but worth remembering if any future integration is tempted to use raw SMTP/sockets on Render: prefer an HTTPS-based API instead. **Rules out any SMTP relay (Brevo's included) as a fallback** — only HTTP APIs work here.
4. **Env vars now live in three places** with no sync: local `.env` files, Render dashboard, Vercel dashboard. If any secret rotates (e.g. Gemini key, Brevo API key), it has to be updated in all three manually.
5. **No staging environment.** Every push to `main` deploys straight to production on both platforms, gated only by the backend test suite in CI (and only if CI finishes before the platform's own auto-deploy kicks off).
6. **Google OAuth origins are manually registered** in Google Cloud Console. If the Vercel URL ever changes (custom domain, project rename), Google Sign-In will break with `origin_mismatch` until the new origin is added there.

## Dependency / security

7. **Three open dependency CVEs** (was four — removing `nodemailer` when email moved to an HTTP API cleared its high-severity CVE as a side effect), each needs a breaking major-version bump:
   - `react-router` / `react-router-dom` — moderate, no fix in the 6.x line, needs v6 → v7
   - Vite / esbuild — moderate-high, dev-server only, needs v5 → v8
   - transitive `uuid`/`gaxios` issue via `google-auth-library` — fixing risks breaking Google Sign-In
   All investigated and consciously deferred as separate migration tasks. Free to fix, just real work with real risk of breakage — do one at a time, not bundled with unrelated changes.
8. **A ban doesn't take effect on an already-issued access token until it naturally expires** (≤15 min). Login and token refresh both reject a banned account outright, and `blockInactiveParticipant` closes the gap on the specific writer-action endpoints (Quick Match, invite create/redeem, turn submission, completion response, chat send), but `requireAuth` itself never queries the database — so a banned user's current token still passes on routes that only require plain auth (e.g. reading history) until it expires. Fixing this fully means a DB lookup on every authenticated request app-wide; not worth it to shrink an already-small, self-expiring window.

## Testing / observability

9. **No frontend automated test coverage** — no Vitest/RTL, no Playwright. Backend has 79 passing tests in CI; frontend has none. The single biggest gap on the frontend side.
10. **No monitoring or error tracking.** If something breaks in production, there's no alert — only a user report. Free tiers exist (e.g. Sentry) but adding one is a new external service, not something to add without asking given the no-added-cost constraint.
11. **No structured logging** — raw `console.log`/`console.error` in a handful of backend places.
12. **No real accessibility audit** beyond a manual icon-only-control pass — contrast ratios, keyboard tab order, and screen-reader flow through multi-step forms haven't been systematically checked.

## Scaling (irrelevant on a single free instance, but will matter if that changes)

13. **Rate limiting is in-memory, single-instance only.** Resets on every process restart (which cold-starts make more frequent than a normal always-on server), and won't work correctly the moment there's more than one server instance.
14. **Socket.IO is single-instance only** — no Redis adapter or similar. Same caveat: fine now, breaks the moment there's more than one backend instance.

## Frontend polish

15. **No error boundary** — an unexpected render error currently white-screens instead of showing a fallback UI.
16. **Large single JS bundle** (>1MB warning on build) — Tiptap, jsPDF, and framer-motion all load upfront. `React.lazy` per route would help; not done.

## Product / cost decisions (not bugs)

17. **Gemini's 20/day free-tier ceiling** for AI-generated keywords — a deliberate cost decision, not a limitation to fix. Falls back to a local keyword pool once exhausted.
18. **`EMAIL_FROM` is a free Gmail address, not a verified custom domain.** On SendGrid this landed in Gmail Spam (Gmail treats unauthenticated `@gmail.com` senders as suspicious). On Brevo, the behavior is different: since the domain isn't DKIM-authenticated, **Brevo automatically substitutes it with its own authenticated subdomain** (observed: `pairagraph.app@gmail.com` → `pairagraph.app@11762822.brevosend.com`) to satisfy Gmail/Yahoo's sender-authentication rules (mandatory since Feb 2024) — this is what's actually landing emails in the inbox now. Trade-off: recipients see an unfamiliar `brevosend.com` address rather than the real one (display name "Pairagraph" still shows). Fixing this properly means authenticating a real owned domain with Brevo, which isn't free.
19. **No "Sent with Brevo" branding observed on transactional emails** in practice, despite that being commonly described for Brevo's free plan — that branding appears to be specific to the marketing/campaigns product, not the transactional email API this project uses.

---

See [`BACKEND.md`](BACKEND.md) and [`FRONTEND.md`](FRONTEND.md) for the full bug-fix history and architecture context behind these.
