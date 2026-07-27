# Pairagraph — Backend Documentation

Turn-based, two-person collaborative writing app. This document covers the backend: what each domain does, why it's built the way it is, how the pieces fit together, a running log of real bugs found (and fixed), and what's deliberately still left undone.

---

## 1. Architecture at a glance

**Stack:** Node.js, Express, MongoDB (Atlas) via Mongoose, Socket.IO, JWT auth, Google Gemini (AI keywords), Brevo (email, via its HTTP API), Google OAuth (`google-auth-library`), `express-rate-limit`.

**Pattern:** Layered, domain-driven. Each feature area lives under `server/src/domains/<name>/` with the same four files:

| File | Responsibility |
|---|---|
| `*.model.js` | Mongoose schema only |
| `*.service.js` | All business logic — the only layer allowed to touch models directly |
| `*.controller.js` | Thin: parse `req`, call the service, shape the JSON response |
| `*.routes.js` | Express `Router`, wires `requireAuth` + endpoints to controller functions |

Domains: **authentication, collaboration, matchmaking, invite, ai, chat, leaderboard**. Shared infrastructure lives outside the domains: `utils/` (ApiError, asyncHandler, tokens, mailer), `middleware/` (errorHandler), `sockets/` (Socket.IO setup), `testUtils/` (a throwaway Socket.IO server for tests that exercise services which broadcast).

**Why this shape:** the project spec called for "thin controllers, business logic inside services" and domain-based organization so new features (e.g. chat, leaderboard) slot in without touching unrelated code. Every domain has been verified end-to-end against the real database, either via the automated test suite (§12) or live curl/socket scripts during development.

**Error handling convention:** services throw `ApiError(statusCode, message)` for expected failures (validation, permission, not-found). `asyncHandler` wraps every controller so thrown/rejected errors reach the central `errorHandler` middleware, which returns `{ success: false, message }` — operational errors (`ApiError`) pass their message through; anything else becomes a generic 500 and gets logged server-side, so raw stack traces never leak to the client.

---

## 2. Authentication domain

**What:** email/password with email verification, Google OAuth, JWT access+refresh tokens in httpOnly cookies, password reset, and account management (profile, password change, deletion).

**Why JWT access+refresh over sessions:** no Redis, no session store — access token (15 min) is cheap to verify on every request; refresh token (7 days) is rotated on each use and its hash (not the raw token) is stored on the `User` document, so a leaked DB doesn't hand out valid refresh tokens.

**Model (`User`):** `displayName`, `email` (unique), `passwordHash` (absent for Google-only accounts), `authProvider` (`local`/`google`), `googleId` (sparse unique), `isEmailVerified`, `emailVerificationTokenHash` + expiry, `refreshTokenHash`, `passwordResetTokenHash` + expiry, `isDeleted`.

**Endpoints:** `POST /register`, `GET /verify-email/:token`, `POST /login`, `POST /google`, `POST /refresh`, `POST /logout`, `GET /me`, `POST /forgot-password`, `POST /reset-password/:token`, `PATCH /me`, `POST /me/change-password`, `DELETE /me`.

**How verification works:** a random raw token is generated (`crypto.randomBytes`), only its SHA-256 hash is stored, the raw token is emailed as a link; verifying looks up by hash so the raw token never sits in the database. Password reset reuses the exact same hash-only pattern (`passwordResetTokenHash` + 1h expiry).

**How Google sign-in works:** the frontend gets a Google ID token via Google Identity Services (loaded as a script tag — no extra npm wrapper); the backend verifies it with `google-auth-library` and finds-or-creates the `User`. No Passport dependency.

**Password reset design decisions:**
- `requestPasswordReset` always resolves the same way regardless of whether the email exists, to avoid leaking account existence. The one visible difference is *which* email gets sent: a real reset link for local accounts, or a "this account uses Google — sign in that way instead" notice for Google-only accounts (no password to reset). Both are indistinguishable from the API caller's point of view.
- Resetting a password invalidates the user's `refreshTokenHash`, forcibly logging out any existing sessions.

**Account deletion is anonymization, not a hard delete.** `deleteAccount` scrubs `displayName` → `"Deleted user"`, randomizes `email` to `deleted-<id>@pairagraph.invalid`, clears `passwordHash`/`googleId`/all tokens, and sets `isDeleted: true` — the document itself is kept. This matters because collaborations and chat messages reference `User` by ObjectId; hard-deleting would leave the other participant looking at a dangling reference (`entry.author` populating to `null`, crashing anything that reads `.displayName` off it). Deletion also cancels the user's pending invites and removes any matchmaking queue entry.

---

## 3. Collaboration domain

**What:** the actual turn-based writing loop and completion approval.

**Model (`Collaboration`):** `participants` (exactly 2, schema-validated), `writingType` (`story`/`poem`), `turnOwner`, `entries` (`{author, content, submittedAt}`), `keywords` (5 words), `status` (`in_progress`/`completed`/`private`).

**Why this state machine:** the spec required turn-taking, immutable history, and mutual-approval completion, but left the edge cases undefined — these were resolved deliberately during design, not guessed:
- Submitting a new turn **resets both participants' `hasApproved` to `null`** — prevents completing off a stale approval given before new content existed.
- Turn submission is **always allowed** while `in_progress`, independent of a pending approval — no separate "pending completion" status.
- A single rejection (`approve:false`) immediately sets `status:'private'`; two `true` approvals set `status:'completed'`, which also triggers the leaderboard's `awardCompletionPoints` (§8) exactly once, guarded by the same "no longer in progress" check that blocks any further completion responses on that collaboration.
- One-line-per-turn (poem) / one-paragraph-per-turn (story) is enforced server-side by counting `<p>` tags and rejecting any `<br>` in poem content — defense-in-depth against a client that bypasses the editor's own restriction (see the editor's Enter-key blocking, front-end side).

**Endpoints:** `GET /collaborations` (list mine, summarized, paginated + filterable), `GET /collaborations/turn-count` (count of `in_progress` collaborations where it's this user's turn — a dedicated lightweight endpoint for the nav badge, cheaper than fetching full collaboration data just to derive a number), `GET /collaborations/:id` (full detail, populated), `POST /collaborations/:id/turns`, `POST /collaborations/:id/completion`.

**Pagination:** `GET /collaborations?status=<comma-separated>&page=&limit=` — `status` filters (e.g. `in_progress`, or `completed,private` for "past"), defaults to `page=1&limit=10`. Returns `{collaborations, hasMore, total}` rather than a bare array; `hasMore` is computed from an actual `countDocuments`, not a "did we get a full page" heuristic, since the query is cheap enough to just count.

**Real-time:** both `submitTurn` and `respondToCompletion` broadcast `collaboration:updated` (the full populated document) to both participants' socket rooms after saving, so neither side needs to refresh to see the other's move.

---

## 4. Matchmaking domain

**What:** "Quick Match" — pairs two users waiting for the same `writingType`.

**How:** a `MatchQueueEntry` (`user` unique, `writingType`) is created when no waiting partner exists; `findOneAndDelete` atomically claims a waiting partner if one does; on a match, a `Collaboration` is created (random `turnOwner` — a deliberate, neutral choice) and the *other* (already-waiting) participant is notified via the `matchmaking:matched` Socket.IO event, since their HTTP request returned long before the match happened.

**Endpoints:** `POST/GET/DELETE /matchmaking/quick-match` (join / check status / cancel).

---

## 5. Invite domain

**What:** the second way to start a collaboration — create a shareable link, someone else redeems it.

**How:** `Invite` (`creator`, `writingType`, `code` — a random token reusing the same `generateRawToken` helper as email verification, `status`, `collaboration`). Redeeming validates the code is still `pending`, rejects self-redemption, creates the `Collaboration` (random `turnOwner`, same as Quick Match for consistency), and emits `invite:redeemed` to the creator's socket room.

**Endpoints:** `POST /invites` (create), `POST /invites/:code/redeem`, `DELETE /invites/:id` (cancel), `GET /invites` (list mine).

---

## 6. AI Keywords domain

**What:** exactly 5 single-word keywords generated for every new collaboration.

**Why Gemini over Claude:** Gemini has a genuine ongoing free tier suited to this low-complexity task; Claude's API doesn't have a comparable standing free tier for production use.

**How:** `generateKeywords(writingType)` tries Gemini first (model **`gemini-flash-latest`** — see bug log below for why not `gemini-2.0-flash`), parses the response into 5 lowercase words; **any** failure (quota, network, bad response, missing key) falls through to a hand-authored fallback pool — two curated lists of 120 unique words each (`story`, `poem`), so a fallback keyword set still feels tailored to the writing type. Callers never know which source they got.

**Diversity fix:** left at defaults, Gemini kept converging on the same handful of "safe" words (`ember`, `threshold`, `resonance`...) across unrelated calls. Fixed by setting `temperature`/`topP`/`topK` explicitly, randomizing a prompt "angle" per request (a themed hint like "a coastal town at dusk"), and naming the worst repeat offenders directly in the prompt as words to avoid.

**⚠️ Known ceiling:** this model's free tier caps at **20 requests/day, total, across all users** on this API key. Once exhausted, *every* subsequent keyword generation silently falls back to the local word pool for the rest of the day — by design (never a user-visible failure), but it means the "AI" feature degrades to a fixed 120-word pool almost immediately under any real usage. Fixing this for real requires either a paid Gemini tier or redesigning around the ceiling (e.g. pre-generating a larger batch once per day instead of one call per collaboration) — not something to reach for casually since it's a cost decision, not just a code change.

---

## 7. Chat domain

**What:** persisted chat tied to a collaboration, plus a live typing indicator. Explicitly secondary per the spec — writing is the primary focus.

**Model (`ChatMessage`):** `collaboration`, `sender`, `content`, `createdAt` — a separate collection (not embedded in `Collaboration`) since chat volume is unbounded, unlike turn entries.

**Endpoints:** `GET/POST /collaborations/:collaborationId/chat`. Sending broadcasts `chat:message` to both participants' socket rooms (not just "the other one" — covers the sender's other open tabs too).

**Pagination:** `GET .../chat?limit=&before=` — cursor-based on `createdAt`, fetched newest-first server-side and reversed back to chronological order before returning. `hasMore` is a "did we get a full page" heuristic (`messages.length === limit`) rather than a separate count query — cheap, with a known edge case (a false positive if exactly `limit` messages remain with nothing older), which just costs one harmless extra "Load earlier" click that returns an empty page.

**Typing indicator:** purely a Socket.IO relay (`chat:typing`) — client emits, server looks up the collaboration to find "the other participant" and relays to them. No REST endpoint, no persistence. The frontend hides the indicator if no new ping arrives within ~2.5s, since the server only ever relays "typing right now," never "stopped."

---

## 8. Leaderboard domain

**What:** points awarded for finishing a collaboration together, with weekly and all-time rankings.

**Model (`PointsEntry`):** a ledger, not a running total — one row per `(user, collaboration)` pair: `{user, collaboration, points, createdAt}`. A unique index on `(user, collaboration)` guards against ever double-awarding the same completion. A ledger (rather than a counter on `User`) is what makes "this week" computable at all — it's just a `createdAt` range query, no reset job needed.

**How points are awarded:** `awardCompletionPoints` is called from `collaboration.service.js` the instant a collaboration's status flips to `completed` (§3) — both participants get a flat **10 points** each. There's no scaling by writing type or entry count; kept deliberately simple for v1.

**How ranking works:** `getLeaderboard(range)` aggregates `PointsEntry`, optionally filtered to `createdAt >= start of the current ISO week` (Monday 00:00 UTC — the same window for every user regardless of timezone, rather than trying to compute a "week" per viewer). Anonymized (`isDeleted`) accounts are joined and filtered out *before* grouping/ranking, not after — filtering after would let a deleted account's slot silently bump a real user out of the top 50 instead of backfilling the next real one in.

**Endpoint:** `GET /leaderboard?range=week|all`.

**Decision, not a bug:** existing completed collaborations at the time this feature shipped were **not** backfilled with points — only completions from that point on count. A deliberate choice, made explicitly rather than assumed.

---

## 9. Sockets

Every domain that needs to push a real-time notification (matchmaking, invite, collaboration, chat) shares one Socket.IO server (`sockets/index.js`):
- **Auth:** a connection-level middleware reads the `accessToken` cookie from the handshake headers (hand-parsed — no new dependency) and verifies it with the same JWT logic as HTTP's `requireAuth`.
- **Addressing:** every authenticated socket joins a room named `user:<userId>`, so any service can do `io.to('user:<id>').emit(...)` to reach a specific user regardless of how many tabs/devices they have open, without threading socket references through every layer — `getIO()` is exported for that.

**⚠️ Known limitation:** single-instance only. There's no Redis (or other) adapter, so rooms only exist within one Node process's memory. This is fine for the current single-server deployment, but real-time delivery would silently break for any user connected to a different instance the moment this runs behind a load balancer or on more than one process.

---

## 10. Rate limiting

`express-rate-limit`, applied in `app.js`:
- A general baseline across all of `/api`: 300 requests / 15 min per IP.
- A stricter limiter specifically on `/auth/register`, `/auth/login`, `/auth/google`, `/auth/forgot-password`, and `/auth/reset-password`: 20 requests / 15 min per IP — the endpoints actually worth brute-forcing or spamming.

**⚠️ Known limitation:** the default store is in-memory. It resets on every server restart and doesn't share counts across multiple instances — real protection against a determined or distributed attacker would need a shared store (e.g. Redis-backed).

---

## 11. Automated testing

`npm test` (in `server/`) runs `node --test "src/**/*.test.js"` — Node's built-in test runner, zero new dependencies. Tests are colocated with the service they cover (`*.service.test.js`), and hit the **real** MongoDB Atlas dev database directly (matching this project's established practice of testing against real infrastructure rather than mocks), with explicit cleanup in every test.

- **Mailer mocking:** `utils/mailer.js` exports a single mutable object (`{ sendVerificationEmail, sendPasswordResetEmail, sendGoogleAccountNoticeEmail }`) rather than named exports, specifically so `node:test`'s `mock.method()` can swap individual methods in auth tests — ES module named-export bindings are frozen and can't be mocked this way, a plain object's properties can.
- **Socket-dependent services:** `testUtils/testSocket.js` spins up a throwaway HTTP server + `initIO()` so services that call `getIO()` (matchmaking, invite, collaboration) don't throw in tests — nothing needs to actually connect, `io.to(room).emit(...)` is a safe no-op with zero listening sockets.
- **Coverage:** auth (register/login/verify/reset/change-password/delete), collaboration (turn ownership, one-line/one-paragraph enforcement, completion approve/reject, pagination + status filtering, turn-count), invites (create/redeem/cancel/self-redeem-block), matchmaking (pairing logic), leaderboard (idempotency, ranking, week-boundary exclusion, deleted-account exclusion). 44 tests total, all passing.
- **What's deliberately not covered:** raw Socket.IO event delivery over the wire (verified manually/via live scripts during development instead — a full socket-server integration harness was judged not worth the added complexity for the confidence gained), and there is currently no frontend test coverage at all (no Vitest/RTL/Playwright) — everything on the client has been verified by manual reasoning and live curl/socket scripts.

---

## 12. CI/CD

`.github/workflows/server-tests.yml` runs the backend test suite (§11) on every push and pull request, on any branch: checkout → `actions/setup-node@v4` (Node 22) → `npm ci` (server/) → `npm test`.

- **Secrets required:** `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (repo Settings → Secrets and variables → Actions). Tests hit the same real Atlas dev database as local development — consistent with this project's practice of testing against real infrastructure, though it does mean CI and local dev share state.
- **`GEMINI_API_KEY` is deliberately left unset in CI** — with no key, `generateKeywords()` falls straight through to the local fallback pool (§6), so running the suite never spends any of the 20-requests/day Gemini quota.
- **No frontend job yet** — there's no frontend test suite to run (§ see `docs/FRONTEND.md`), so the workflow only covers `server/`.

---

## 13. Bugs found and fixed

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | `GET /collaborations/:id` returned 403 for actual participants | Populated `participants.user` into full documents **before** checking membership; the check compared a populated doc against a raw ID string and always failed | Check access on the raw (unpopulated) document first, populate only for the response |
| 2 | Google Sign-In 500'd for an email that already had a local account | `googleLogin` only looked up existing users by `googleId`; a first-time Google login for an existing email tried to `create` a second user, colliding with the unique email index | Fall back to a lookup by email and **link** the Google identity to the existing account instead of creating a duplicate |
| 3 | Google Sign-In appeared to do nothing after picking an account | The button's callback had no error handling — a failure (like bug #2, before it was fixed) failed silently in the browser | Added `try/catch` + an `onError` callback wired to the modal's visible error text |
| 4 | Google Sign-In button sometimes never rendered | `useEffect` checked for `window.google` once on mount; the GIS script loads `async defer` and could still be loading | Poll until the script is ready instead of a one-shot check |
| 5 | Email verification link did nothing (blank page) | Backend endpoint existed, but no frontend route was ever built for `/verify-email/:token` | Added `VerifyEmailPage` + route |
| 6 | Login/signup modal stayed open after a successful Google sign-in | Local email/password login called `onClose()` on success; the Google path never did | Wired `onSuccess={onClose}`, and separately added a `useEffect` on `currentUser` in the dashboard that force-closes any open modal the moment auth state flips — robust to any future auth method, not just this one |
| 7 | Gemini calls 429'd with `limit: 0` on `gemini-2.0-flash` | That specific model wasn't in this API key's free-tier allocation | Switched to `gemini-flash-latest`, confirmed to have real quota on this key |
| 8 | **Crash after submitting a turn: blank screen, `Cannot read properties of undefined (reading 'hasApproved')`** | `submitTurn` and `respondToCompletion` returned the raw Mongoose document (`participants[].user` as a bare ObjectId), but the frontend expected the same populated shape (`{_id, displayName}`) that `getById` returns | Populate the collaboration the same way `getById` does before returning it from both `submitTurn` and `respondToCompletion` |
| 9 | Invalid Tailwind `theme()` call broke the whole stylesheet | Used `theme('colors.charcoal / 40%')` — not a supported syntax for a nested/opacity color lookup in this Tailwind version | Replaced with a direct `rgb(35 35 32 / 0.4)` value |
| 10 | Gemini kept returning near-identical keyword sets across unrelated collaborations | Generic prompt, no temperature set — the model converged on the same "safe" evocative words every time | Explicit `temperature`/`topP`/`topK`, a randomized prompt "angle" per call, and naming repeat offenders to avoid |
| 11 | Real Gemini calls turned out to be silently exhausted (429) for most of a session's testing | Free-tier daily quota (20/day) had already been burned through by dev testing; every call was quietly falling back to the local pool, which read as "keywords feel repetitive" rather than "AI isn't running at all" | Not a code fix — root-caused via direct logging against the live API, documented as a known ceiling (§6) |
| 12 | New `PointsEntry` rows were leaking on every full test-suite run | `collaboration.service.test.js` predates the leaderboard feature; its "both approve → completed" test now triggers real point-awarding as a side effect of `respondToCompletion`, but that test file's cleanup was written before `PointsEntry` existed and never accounted for it | Added `PointsEntry` cleanup to that test file's `after()` hook; verified zero leftover rows across repeated full-suite runs |
| 13 | CI failed at `npm ci` with `EUSAGE`, "package-lock.json in sync" error, on a repo that installed fine locally | `package-lock.json` was missing several nested transitive dependencies (`mongoose` carries its own optional `gcp-metadata@5.3.0`, distinct from `google-auth-library`'s `gcp-metadata@6.1.1`) — apparently omitted due to an npm-version-specific quirk when the lockfile was originally generated; `npm ci` validates strictly, `npm install` doesn't, and the locally-installed npm version didn't flag it as inconsistent either | Regenerated `package-lock.json` from a clean `node_modules`, verified `npm ci` succeeds and the full suite still passes, before committing the fix |
| 14 | Forgot-password stuck on "Sending…" forever in production | `requestPasswordReset` awaited the actual SMTP send before the HTTP response returned; once deployed, the SMTP connection (first Gmail, then a second provider) hung with `ETIMEDOUT` on `CONN` — very likely Render blocking outbound SMTP ports (25/465/587) entirely, not a credential/config issue, since two completely different SMTP hosts failed identically | Stopped awaiting the mail send in the request path (fires in the background, errors logged server-side instead of blocking the response); added explicit nodemailer timeouts as a stopgap; ultimately replaced SMTP entirely with an HTTP API-based provider (port 443) since that's not subject to the same port-blocking risk — see §2 and the CVE note in §15 |
| 15 | `express-rate-limit` threw `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` in production logs | Render sits behind a reverse proxy that sets `X-Forwarded-For`; Express's `trust proxy` setting defaults to `false`, so the rate limiter couldn't safely resolve the real client IP | `app.set('trust proxy', 1)` in `app.js` — trusts exactly the one proxy hop Render adds, matching the same fix Heroku deployments need |
| 16 | Migrated email from SendGrid to Brevo before SendGrid's 60-day trial expired | SendGrid's dashboard confirmed (and its own pricing page corroborated) that the trial is genuinely time-limited with no permanent free tier — continuing past ~2026-09-25 would require a paid plan ($19.95/mo+), which conflicts with this project's no-added-cost constraint | Rewrote `mailer.js` to use `@getbrevo/brevo`'s `transactionalEmails.sendTransacEmail` instead of `@sendgrid/mail` (same `mailer` object shape, no other code touched); Brevo's free tier (300 emails/day) has no trial expiration. Done proactively, ~2 months ahead of the deadline, rather than waiting |

## 14. Operational incidents (not code bugs, but shaped a lot of this build)

- **MongoDB Atlas connectivity outage:** login and turn-submission both 500'd with a raw TLS/`ReplicaSetNoPrimary` error from Mongoose. Root cause was Atlas's Network Access list no longer matching the current public IP (common with dynamic ISP addresses) — fixed by widening it to `0.0.0.0/0`. Not a code issue; confirmed by testing the exact same request before/after the allow-list change.
- **Orphaned dev-server processes:** every manual restart this session killed only the process holding port 5000, never the `npm run dev` → `nodemon` parent chain that spawned it. Over many restarts this left **16 orphaned nodemon instances** silently running, all watching the same files and racing each other to rebind the port after any edit — whichever won a given restart could be serving stale code from hours earlier. Fixed by identifying and killing every `nodemon.js .../server.js` and `npm-cli.js run dev` process by exact command line before any subsequent restart.

## 15. Known limitations (deliberately deferred, not overlooked)

- **Three open dependency CVEs** (down from four — removing `nodemailer` in favor of an HTTP API-based email provider cleared its high-severity CVE as a side effect, not a dedicated fix), each requiring a breaking upgrade: `react-router`/`react-router-dom` (moderate, no fix exists in the 6.x line — needs a v6→v7 migration), Vite/esbuild (moderate-high, dev-server only, needs v5→v8), and a transitive `uuid`/`gaxios` issue pulled in via `google-auth-library` (fixing it means bumping that library, risking the Google Sign-In flow). All three were investigated and consciously deferred as separate migration tasks rather than bundled into unrelated work.
- **Gemini's 20/day free-tier ceiling** (§6) — a product/cost decision, not a bug.
- **Rate limiting and Socket.IO are single-instance only** (§9, §10) — fine for the current deployment, real gaps the moment this runs on more than one process.
- **No frontend test coverage** — see `docs/FRONTEND.md`.
- No structured logging (raw `console.log`/`console.error` in a handful of places), no error-tracking/monitoring service.
- **Email deliverability:** `EMAIL_FROM` is a free Gmail address rather than a verified custom domain, since the project has no domain to verify. On SendGrid this landed in Gmail's Spam folder (Gmail treats unauthenticated `@gmail.com` senders as suspicious). On Brevo (the current provider), Brevo instead auto-substitutes its own authenticated subdomain in place of the unauthenticated one (observed: mail arrives "from" `...@<id>.brevosend.com` rather than the real Gmail address) to satisfy Gmail/Yahoo's mandatory sender-authentication rules — this is why delivery to the inbox improved, at the cost of an unfamiliar-looking sender address. No code fix without a paid custom domain to properly authenticate — worth still surfacing "check your spam folder" in the UI copy as a safety net.
