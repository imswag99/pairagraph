# Pairagraph — Backend Documentation

Turn-based, two-person collaborative writing app. This document covers the backend: what each domain does, why it's built the way it is, how the pieces fit together, a running log of real bugs found (and fixed), and what's deliberately still left undone.

---

## 1. Architecture at a glance

**Stack:** Node.js, Express, MongoDB (Atlas) via Mongoose, Socket.IO, JWT auth, Google Gemini (AI keywords), Brevo (email, via its HTTP API), Google OAuth (`google-auth-library`), `express-rate-limit`, Cloudflare Turnstile (`utils/turnstile.js`), Sentry (`@sentry/node`, error tracking only).

**Pattern:** Layered, domain-driven. Each feature area lives under `server/src/domains/<name>/` with the same four files:

| File | Responsibility |
|---|---|
| `*.model.js` | Mongoose schema only |
| `*.service.js` | All business logic — the only layer allowed to touch models directly |
| `*.controller.js` | Thin: parse `req`, call the service, shape the JSON response |
| `*.routes.js` | Express `Router`, wires `requireAuth` + endpoints to controller functions |

Domains: **authentication, collaboration, matchmaking, invite, ai, chat, leaderboard, moderation, admin, gallery**. Shared infrastructure lives outside the domains: `utils/` (ApiError, asyncHandler, tokens, mailer, logger, turnstile), `middleware/` (errorHandler), `sockets/` (Socket.IO setup), `testUtils/` (a throwaway Socket.IO server for tests that exercise services which broadcast).

**Why this shape:** the project spec called for "thin controllers, business logic inside services" and domain-based organization so new features (e.g. chat, leaderboard) slot in without touching unrelated code. Every domain has been verified end-to-end against the real database, either via the automated test suite (§13) or live curl/socket scripts during development.

**Error handling convention:** services throw `ApiError(statusCode, message)` for expected failures (validation, permission, not-found). `asyncHandler` wraps every controller so thrown/rejected errors reach the central `errorHandler` middleware, which returns `{ success: false, message }` — operational errors (`ApiError`) pass their message through; anything else becomes a generic 500 and gets logged server-side, so raw stack traces never leak to the client.

**Structured logging:** `utils/logger.js` is a tiny hand-rolled module (`logger.info`/`.warn`/`.error`), no new dependency — every call writes one JSON line (`{level, message, timestamp, ...meta}`) to stdout (`error` goes to stderr instead), replacing what used to be free-form `console.log`/`console.error` calls scattered across `config/db.js`, `server.js`, `errorHandler.js`, and the two mailer-failure catch blocks in auth/moderation. The point isn't a logging *platform* — it's that every log line is now machine-parseable instead of arbitrary string concatenation, which is what actually made adding real monitoring (below) a matter of piping errors somewhere, not a rewrite.

**Error tracking (Sentry):** `instrument.js` calls `Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 })` and is imported first thing in `server.js` (after `dotenv/config`, so the DSN is actually populated by the time `init` reads it). `tracesSampleRate: 0` is deliberate — the ask was error tracking, not performance monitoring/APM, and that's a separate product with its own quota on Sentry's free tier; no reason to opt into it. `app.js` wires `Sentry.setupExpressErrorHandler(app, { shouldHandleError })` right before the existing `errorHandler`, filtered by the exact same `!error.isOperational` check `errorHandler` already uses — an `ApiError` (bad password, not found, a failed CAPTCHA) is expected everyday traffic, not an incident, and reporting it anyway would just burn quota on non-bugs. Same bypass convention as `GEMINI_API_KEY`/`CAPTCHA_SECRET_KEY`: unset `SENTRY_DSN` and the SDK no-ops entirely. Live-verified (not just read) by deliberately triggering a real unhandled `CastError` with Sentry's `debug: true` temporarily enabled — confirmed `"Captured error event ..."` in the SDK's own debug log before turning debug mode back off.

**One cosmetic warning, understood and left as-is:** startup logs `[Sentry] express is not instrumented. Please make sure to initialize Sentry in a separate file that you --import when running node...`. This is Sentry's OpenTelemetry auto-instrumentation complaining it couldn't patch the `express` module before it was first imported — relevant for *tracing* (route names/spans on performance data), not for exception capturing, which `setupExpressErrorHandler` registers as plain Express middleware regardless. Since tracing is deliberately off (`tracesSampleRate: 0`), fixing this would mean reworking `dev`/`start` to preload `instrument.js` via Node's `--import` flag (fragile through `nodemon`, for a feature not being used) — not worth it for a warning about a product this project isn't using.

---

## 2. Authentication domain

**What:** email/password with email verification, Google OAuth, JWT access+refresh tokens in httpOnly cookies, password reset, and account management (profile, password change, deletion).

**Why JWT access+refresh over sessions:** no Redis, no session store — access token (15 min) is cheap to verify on every request; refresh token (7 days) is rotated on each use and its hash (not the raw token) is stored on the `User` document, so a leaked DB doesn't hand out valid refresh tokens.

**Model (`User`):** `displayName`, `email` (unique), `passwordHash` (absent for Google-only accounts), `authProvider` (`local`/`google`), `googleId` (sparse unique), `isEmailVerified`, `emailVerificationTokenHash` + expiry, `refreshTokenHash`, `passwordResetTokenHash` + expiry, `isDeleted`, `isBanned`, `blockedUsers` (§9), `role` (`user`/`admin`, default `user`).

**Admin access (§9, §10):** `requireAdmin` — a second middleware alongside `requireAuth`, added when the admin reports panel needed it — does its own fresh `User.findById(req.user.id).select('role')` on every request rather than trusting anything in the JWT. This matters because `requireAuth` never touches the database at all (it just verifies the token and sets `req.user = { id: decoded.sub }` from the payload, which is only ever `{ sub: userId }`) — so a `role` change takes effect on the very next request, no re-login or token reissue needed. There is deliberately no API to grant admin; it's set exactly once, directly in the database, by the project owner on their own account — a self-service "promote to admin" endpoint would be a real privilege-escalation surface for zero benefit on a single-admin hobby project.

**Blocking admin/banned accounts from writer actions:** a third middleware, `blockInactiveParticipant`, does the same fresh `User.findById(req.user.id).select('role isBanned')` check and rejects (403) if the caller is either banned or an admin. Applied to the specific endpoints where a user actually *acts* as a writing participant — joining Quick Match, creating/redeeming an invite, submitting a turn, responding to completion, sending a chat message — rather than to every route in those domains, so read-only access (viewing a collaboration/history you're already part of) is unaffected. This is what makes an admin promotion or a ban take effect immediately on the actions that matter, on the same "fresh DB check, not JWT trust" model as `requireAdmin`.

**Banning has a bounded, accepted blind spot.** `login()` and `googleLogin()` both reject a banned user outright (403), and banning also clears `refreshTokenHash` so they can't silently mint a new access token via `/refresh` either. But `requireAuth` itself never touches the database, so an *already-issued* access token (≤15 min, `JWT_ACCESS_EXPIRES`) still passes on routes `blockInactiveParticipant` doesn't cover (e.g. reading chat/collaboration history) until it naturally expires. Adding a DB lookup to `requireAuth` would close that gap but puts a query on every authenticated request app-wide — not worth it to shrink an already-small, self-expiring window. Tracked in `docs/KNOWN_ISSUES.md`.

**Endpoints:** `POST /register`, `GET /verify-email/:token`, `POST /login`, `POST /google`, `POST /refresh`, `POST /logout`, `GET /me`, `POST /forgot-password`, `POST /reset-password/:token`, `PATCH /me`, `POST /me/change-password`, `DELETE /me`.

**How verification works:** a random raw token is generated (`crypto.randomBytes`), only its SHA-256 hash is stored, the raw token is emailed as a link; verifying looks up by hash so the raw token never sits in the database. Password reset reuses the exact same hash-only pattern (`passwordResetTokenHash` + 1h expiry).

**How Google sign-in works:** the frontend gets a Google ID token via Google Identity Services (loaded as a script tag — no extra npm wrapper); the backend verifies it with `google-auth-library` and finds-or-creates the `User`. No Passport dependency.

**CAPTCHA on registration only:** `register` (not `login`, not password reset — this exists specifically to stop spam registrations from burning through Brevo's 300-emails/day quota via verification emails, a risk neither of those other flows share) calls `turnstile.verifyToken(captchaToken, ip)` (`utils/turnstile.js`) as its very first step, before touching the database, throwing `ApiError(400, ...)` if it fails. `verifyToken` POSTs to Cloudflare's `siteverify` endpoint and is shaped as a single mutable object (`export const turnstile = { verifyToken }`), same reason `mailer` is — so tests can swap it with `mock.method()`. **Bypassed entirely when `CAPTCHA_SECRET_KEY` isn't set**, same graceful-degradation convention `GEMINI_API_KEY` already uses (§6) — local dev and CI need no Turnstile setup at all, at the accepted cost that only an environment with the real key configured (production) actually gets bot protection. The frontend widget (`docs/FRONTEND.md` §3) mirrors `GoogleSignInButton`'s exact pattern: a script tag in `index.html`, no npm wrapper, poll-until-ready before rendering.

**Password reset design decisions:**
- `requestPasswordReset` always resolves the same way regardless of whether the email exists, to avoid leaking account existence. The one visible difference is *which* email gets sent: a real reset link for local accounts, or a "this account uses Google — sign in that way instead" notice for Google-only accounts (no password to reset). Both are indistinguishable from the API caller's point of view.
- Resetting a password invalidates the user's `refreshTokenHash`, forcibly logging out any existing sessions.

**Account deletion is anonymization, not a hard delete.** `deleteAccount` scrubs `displayName` → `"Deleted user"`, randomizes `email` to `deleted-<id>@pairagraph.invalid`, clears `passwordHash`/`googleId`/all tokens, and sets `isDeleted: true` — the document itself is kept. This matters because collaborations and chat messages reference `User` by ObjectId; hard-deleting would leave the other participant looking at a dangling reference (`entry.author` populating to `null`, crashing anything that reads `.displayName` off it). Deletion also cancels the user's pending invites and removes any matchmaking queue entry.

---

## 3. Collaboration domain

**What:** the actual turn-based writing loop and completion approval.

**Model (`Collaboration`):** `participants` (exactly 2, schema-validated — each with `user`, `hasApproved`, `lastTurnNotifiedAt`, and `hasConsentedToPublish`), `writingType` (`story`/`poem`), `theme` (flavor only — see §6), `turnOwner`, `entries` (`{author, content, submittedAt}`), `keywords` (5 words), `status` (`in_progress`/`completed`/`private`/`left`), `leftBy` (set only when `status === 'left'`), `isPublished`/`publishedAt` (public gallery visibility — see §11).

**Why this state machine:** the spec required turn-taking, immutable history, and mutual-approval completion, but left the edge cases undefined — these were resolved deliberately during design, not guessed:
- Submitting a new turn **resets both participants' `hasApproved` to `null`** — prevents completing off a stale approval given before new content existed.
- Turn submission is **always allowed** while `in_progress`, independent of a pending approval — no separate "pending completion" status.
- A single rejection (`approve:false`) immediately sets `status:'private'`; two `true` approvals set `status:'completed'`, which also triggers the leaderboard's `awardCompletionPoints` (§8) exactly once, guarded by the same "no longer in progress" check that blocks any further completion responses on that collaboration.
- One-line-per-turn (poem) / one-paragraph-per-turn (story) is enforced server-side by counting `<p>` tags and rejecting any `<br>` in poem content — defense-in-depth against a client that bypasses the editor's own restriction (see the editor's Enter-key blocking, front-end side).
- **`leave` (added for the moderation follow-up, §9)** sets `status:'left'` and records `leftBy` — deliberately a distinct value from `'private'` (mutual decline) so the UI can tell the two apart and say who actually left, rather than showing the same generic label for a polite disagreement and someone escaping harassment. Reuses the exact same "no longer in progress" guard `submitTurn`/`respondToCompletion` already had, so both are automatically rejected on a left collaboration with zero changes to either function.

**Endpoints:** `GET /collaborations` (list mine, summarized, paginated + filterable), `GET /collaborations/turn-count` (count of `in_progress` collaborations where it's this user's turn — a dedicated lightweight endpoint for the nav badge, cheaper than fetching full collaboration data just to derive a number), `GET /collaborations/:id` (full detail, populated), `POST /collaborations/:id/turns`, `POST /collaborations/:id/completion`, `POST /collaborations/:id/leave`, `PATCH /collaborations/:id/publish` and `PATCH /collaborations/:id/publish-consent` (gallery opt-in, §11).

**Pagination:** `GET /collaborations?status=<comma-separated>&page=&limit=` — `status` filters (e.g. `in_progress`, or `completed,private` for "past"), defaults to `page=1&limit=10`. Returns `{collaborations, hasMore, total}` rather than a bare array; `hasMore` is computed from an actual `countDocuments`, not a "did we get a full page" heuristic, since the query is cheap enough to just count.

**Real-time:** both `submitTurn` and `respondToCompletion` broadcast `collaboration:updated` (the full populated document) to both participants' socket rooms after saving, so neither side needs to refresh to see the other's move.

**"It's your turn" email:** `submitTurn` also sends an email to the new turn-owner when `turnOwner` flips, via a new `mailer.sendYourTurnEmail`. There's no cron/queue infrastructure in this stack (the only scheduled-task precedent, the uptime pinger, is an external free service, not in-app code — see `KNOWN_ISSUES.md` #1), so rather than a delayed "notify once idle" job, the email is sent synchronously at handoff, gated by a **4-hour cooldown per (user, collaboration)** stored as `lastTurnNotifiedAt` on that participant's subdocument. This bounds the worst case — two people playing many fast rounds back-to-back — without needing any new infrastructure, and is scoped per-collaboration rather than globally per-user so someone with several concurrent partners still gets notified about each pairing independently. The recipient's email is fetched with a separate targeted `User.findById(id).select('email')` query rather than by adding `email` to `PARTICIPANT_POPULATE` — that populate feeds the collaboration payload both participants receive over the API, so adding email there would leak a writer's email address to their partner. The send itself is fire-and-forget (`.catch` logs via `logger.error`, matching the existing `sendPasswordResetEmail`/`sendGoogleAccountNoticeEmail` pattern in `auth.service.js`) so a slow or failed email never blocks the turn-submission response. See `KNOWN_ISSUES.md` for the Brevo-quota trade-off this introduces.

---

## 4. Matchmaking domain

**What:** "Quick Match" — pairs two users waiting for the same `writingType`.

**How:** a `MatchQueueEntry` (`user` unique, `writingType`, `theme`) is created when no waiting partner exists; `findOneAndDelete` atomically claims a waiting partner if one does; on a match, a `Collaboration` is created (random `turnOwner` — a deliberate, neutral choice) and the *other* (already-waiting) participant is notified via the `matchmaking:matched` Socket.IO event, since their HTTP request returned long before the match happened.

**Theme resolution:** matching itself is still keyed on `writingType` only — adding `theme` to the match criteria would fragment the queue and slow down pairing for a purely cosmetic preference. Instead, when two differently-themed entries match, the resulting collaboration's `theme` is resolved with the same 50/50 coin flip already used for `turnOwner` (`Math.random() < 0.5 ? theme : partnerEntry.theme`) — consistent with how turn order is already randomly decided between two matched strangers rather than user-chosen.

**Endpoints:** `POST/GET/DELETE /matchmaking/quick-match` (join / check status / cancel).

---

## 5. Invite domain

**What:** the second way to start a collaboration — create a shareable link, someone else redeems it.

**How:** `Invite` (`creator`, `writingType`, `theme`, `code` — a random token reusing the same `generateRawToken` helper as email verification, `status`, `collaboration`). Redeeming validates the code is still `pending`, rejects self-redemption, creates the `Collaboration` (random `turnOwner`, same as Quick Match for consistency; `theme` is the creator's choice, carried through untouched — the redeemer has no say, exactly like `writingType`), and emits `invite:redeemed` to the creator's socket room.

**Endpoints:** `POST /invites` (create), `POST /invites/:code/redeem`, `DELETE /invites/:id` (cancel), `GET /invites` (list mine).

---

## 6. AI Keywords domain

**What:** exactly 5 single-word keywords generated for every new collaboration.

**Why Gemini over Claude:** Gemini has a genuine ongoing free tier suited to this low-complexity task; Claude's API doesn't have a comparable standing free tier for production use.

**How:** `generateKeywords(writingType, theme = 'classic')` tries Gemini first (model **`gemini-flash-latest`** — see bug log below for why not `gemini-2.0-flash`), parses the response into 5 lowercase words; **any** failure (quota, network, bad response, missing key) falls through to a hand-authored fallback pool — two curated lists of 120 unique words each (`story`, `poem`), so a fallback keyword set still feels tailored to the writing type. Callers never know which source they got.

**Theme (genre/prompt variety):** a `theme` field (`classic`, `mystery`, `horror`, `romance`, `sci-fi`, `fantasy`, defined in `collaboration/collaboration.constants.js`'s `THEMES`) is chosen alongside `writingType` at Quick-Match-join/invite-creation time and stored on `Collaboration`/`MatchQueueEntry`/`Invite`. It's deliberately a *separate* field from `writingType`, not a new `writingType` enum value — `writingType` keeps governing turn structure (paragraph vs. line) untouched, and "genre" already means `story`/`poem` elsewhere in this app (the leaderboard's `both_genres`/`story_specialist`/`poem_specialist` badges, §8), so a second unrelated meaning of "genre" would collide with that. `theme` only flavors the Gemini prompt (`"a ${theme} ${writingType}"` when not `'classic'`) — **the fallback pool doesn't vary by theme**, a deliberate v1 trade-off: curating a themed pool for every theme × `writingType` combination is real content-authoring work disproportionate to this being explicitly the cheap phase of genre variety (structural formats like screenplay layout, which would need new turn-validation rules and a new PDF export branch, stay deferred entirely).

**Diversity fix:** left at defaults, Gemini kept converging on the same handful of "safe" words (`ember`, `threshold`, `resonance`...) across unrelated calls. Fixed by setting `temperature`/`topP`/`topK` explicitly, randomizing a prompt "angle" per request (a themed hint like "a coastal town at dusk"), and naming the worst repeat offenders directly in the prompt as words to avoid.

**⚠️ Known ceiling:** this model's free tier caps at **20 requests/day, total, across all users** on this API key. Once exhausted, *every* subsequent keyword generation silently falls back to the local word pool for the rest of the day — by design (never a user-visible failure), but it means the "AI" feature degrades to a fixed 120-word pool almost immediately under any real usage. Fixing this for real requires either a paid Gemini tier or redesigning around the ceiling (e.g. pre-generating a larger batch once per day instead of one call per collaboration) — not something to reach for casually since it's a cost decision, not just a code change.

---

## 7. Chat domain

**What:** persisted chat tied to a collaboration, plus a live typing indicator. Explicitly secondary per the spec — writing is the primary focus.

**Model (`ChatMessage`):** `collaboration`, `sender`, `content`, `createdAt` — a separate collection (not embedded in `Collaboration`) since chat volume is unbounded, unlike turn entries.

**Endpoints:** `GET/POST /collaborations/:collaborationId/chat`. Sending broadcasts `chat:message` to both participants' socket rooms (not just "the other one" — covers the sender's other open tabs too).

**Freezing on leave (§9):** `sendMessage` rejects with a 409 once the collaboration's `status` is anything other than `in_progress` — this guard didn't exist until the "Leave collaboration" feature needed it (previously chat kept working forever regardless of collaboration status, even after a mutual completion decline). Reading history (`getHistory`) is deliberately **not** gated the same way — old messages stay visible to both sides no matter how the collaboration ended, only *new* sends are blocked.

**Pagination:** `GET .../chat?limit=&before=` — cursor-based on `createdAt`, fetched newest-first server-side and reversed back to chronological order before returning. `hasMore` is a "did we get a full page" heuristic (`messages.length === limit`) rather than a separate count query — cheap, with a known edge case (a false positive if exactly `limit` messages remain with nothing older), which just costs one harmless extra "Load earlier" click that returns an empty page.

**Typing indicator:** purely a Socket.IO relay (`chat:typing`) — client emits, server looks up the collaboration to find "the other participant" and relays to them. No REST endpoint, no persistence. The frontend hides the indicator if no new ping arrives within ~2.5s, since the server only ever relays "typing right now," never "stopped."

---

## 8. Leaderboard domain

**What:** points awarded for finishing a collaboration together, with weekly, monthly, and all-time rankings, plus per-user streaks and badges.

**Model (`PointsEntry`):** a ledger, not a running total — one row per `(user, collaboration)` pair: `{user, collaboration, points, createdAt}`. A unique index on `(user, collaboration)` guards against ever double-awarding the same completion. A ledger (rather than a counter on `User`) is what makes "this week"/"this month" computable at all — it's just a `createdAt` range query, no reset job needed.

**How points are awarded:** `awardCompletionPoints(collaboration)` is called from `collaboration.service.js` the instant a collaboration's status flips to `completed` (§3). Points are weighted by effort rather than flat: `BASE_COMPLETION_POINTS (6) + min(turnsContributedByThatUser, MAX_BONUS_TURNS 20) × POINTS_PER_TURN (1)`, computed per participant from `collaboration.entries`. A one-line piece nets close to the old flat award; a long one pays out more, up to the cap.

**Streaks and badges:** tracked as denormalized fields on `User` (not derived from `PointsEntry`), owned and updated by the auth domain rather than the leaderboard domain, since it's a write to the `User` model. `collaboration.service.js` calls `authService.recordCompletionActivity(userId, { writingType, partnerId, turnCount })` once per participant, right alongside `awardCompletionPoints` — `partnerId` comes from the existing `getOtherParticipant` helper, `turnCount` is computed the same way `awardCompletionPoints` computes it (filtering `collaboration.entries` by author). It increments `totalCompletions`/`storyCompletions`/`poemCompletions`, dedupes `partnerId` into a `partners: [ObjectId]` array (tracking distinct co-writers), updates `currentStreak`/`longestStreak`/`lastActiveDate` (UTC-day granularity — same day is a no-op, exactly one day later increments, any other gap resets to 1), and unlocks badges into a `badges: [String]` array. Thresholds live in three lookup objects (`COMPLETION_MILESTONES`, `STREAK_MILESTONES`, plus standalone constants for the rest) so adding another milestone tier is a one-line change:

| id | display name (`LeaderboardPage.jsx`'s `BADGE_LABEL`) | unlocked when |
|---|---|---|
| `first_completion` | Fresh Ink | 1st completed collaboration |
| `ten_completions` | Prolific Pen | 10th completed collaboration |
| `twentyfive_completions` | Wordsmith | 25th completed collaboration |
| `fifty_completions` | Legendary Quill | 50th completed collaboration |
| `streak_3` | Warming Up | 3-day completion streak |
| `streak_7` | On a Roll | 7-day completion streak |
| `streak_14` | In the Zone | 14-day completion streak |
| `streak_30` | Unstoppable | 30-day completion streak |
| `both_genres` | Genre Bender | at least 1 story and 1 poem completed |
| `story_specialist` | Storyteller | 10+ completed stories |
| `poem_specialist` | Poet Laureate | 10+ completed poems |
| `social_butterfly` | Social Butterfly | 5+ distinct writing partners |
| `marathon_writer` | Went the Distance | 15+ turns contributed to a single collaboration |

Badge ids are stable storage keys and never renamed once shipped (a user's earned badge shouldn't silently vanish); only the display name in `BADGE_LABEL` is free to change. These fields ride along on every response that already returns the current user (`toSafeUser` in `auth.service.js`) — no new endpoint needed for a user to see their own stats.

**How ranking works:** `getLeaderboard(range)` aggregates `PointsEntry`, optionally filtered to `createdAt >= start of the current ISO week` (Monday 00:00 UTC) or `>= start of the current UTC month`, the same window for every user regardless of timezone rather than trying to compute one per viewer. Anonymized (`isDeleted`) accounts are joined and filtered out *before* grouping/ranking, not after — filtering after would let a deleted account's slot silently bump a real user out of the top 50 instead of backfilling the next real one in. Ties on `totalPoints` are broken deterministically by a secondary sort on `_id`, so rank order doesn't shuffle between identical requests.

**Endpoint:** `GET /leaderboard?range=week|month|all`.

**Decision, not a bug:** existing completed collaborations at the time this feature shipped were **not** backfilled with points, streaks, or badges — only completions from that point on count. A deliberate choice, made explicitly rather than assumed.

---

## 9. Moderation domain

**What:** a minimal but complete report/block mechanism — the highest-priority safety gap before considering any public launch, since Quick Match pairs complete strangers into a live chat + shared writing session with no prior moderation.

**Model (`Report`):** `reporter` (required ref), `reportedUser` (optional ref, default `null` — see gallery reports below), `collaboration` (required ref), `reason` (enum `harassment`/`spam`/`inappropriate_content`/`other`), `details` (string, max 1000), `source` (enum `participant`/`gallery`, default `participant`). A unique compound index on `(reporter, collaboration)` makes repeated "Report" clicks on the same collaboration a no-op rather than a fresh notification each time — the same idempotency idiom as the leaderboard's unique-index-plus-`try/catch`-11000 pattern (§8). Applies equally to both report sources.

**Key design decision:** both `reportUser` and `blockUser` take a `collaborationId`, never a raw target user ID. The service verifies the caller is a participant (mirroring chat's `requireParticipant` check, §7), then derives the *other* participant as the target automatically. This makes self-report/self-block structurally impossible (a collaboration's two participants are always distinct) and rules out reporting/blocking an arbitrary unrelated user — there's no user directory or profile browsing anywhere in the app, so a collaboration is the only context in which one user ever learns another's identity.

**Blocking:** stored as `blockedUsers` on the `User` document (authentication domain). `getMutuallyBlockedIds(userId)` combines "users I've blocked" with "users who've blocked me" into one list, reused by both matchmaking's `joinQueue` (excluded from the partner-claim query) and invite's `redeemInvite` (rejected with a deliberately vague 403 — never confirms a block occurred either way).

**Reporting:** filing a report fires a fire-and-forget email to the project owner's own inbox (`mailer.sendReportNotificationEmail`) — the first email in the app to embed arbitrary user-submitted text (the `details` field) rather than only server-generated tokens/URLs, so it's run through a small local `escapeHtml` helper before interpolation. `Report` also carries a `status` (`open`/`reviewed`) so a report can be tracked as handled rather than the email being the only trace it ever existed.

**Gallery reports (`reportGalleryContent`):** the counterpart added once the public gallery (§11) needed a visitor-facing report path — the existing `reportUser`/`findTargetParticipant` couldn't be reused as-is, since it *requires* the caller to be a participant, which is structurally the opposite of "a random visitor reports a piece they had no part in." `reportGalleryContent` checks the collaboration is actually published (`isPublished === true`, 404 otherwise, mirroring `gallery.service.js`'s `getPublished` guard) but deliberately skips the participant check entirely. Stores `reportedUser: null` and `source: 'gallery'` — the piece was co-written, so there's no single "other" person to name the way a participant report has one. Notifies via a separate `mailer.sendGalleryReportNotificationEmail` (same fire-and-forget pattern, references "a published piece" rather than naming someone). The shared reason/details validation was factored out of `reportUser` into `validateReportInput`, used by both functions rather than duplicated. Still requires `requireAuth` (reporting needs a login, same bar as the rest of this domain) — not fully anonymous, to keep the report system itself from being spammable.

**Admin reports panel:** `listReports()` (all reports, newest first, `reporter`/`reportedUser` populated with `displayName`/`email` — populating a `null` `reportedUser` is a safe no-op) and `markReportReviewed(reportId)` back a gated `/admin` page — the answer to "reports have no admin UI" beyond the one-off email. Both are admin-only (`requireAdmin`, §2); everything else in this domain stays reachable by any authenticated user. Acting on a report — banning, deleting, reviewing the collaboration it's about, or unpublishing a reported gallery piece — lives in a separate `admin` domain (§10), since those actions operate on `User`/`Collaboration` data rather than `Report` data.

**Endpoints:** `POST /moderation/reports`, `POST /moderation/gallery-reports`, `POST /moderation/blocks`, `GET /moderation/blocks`, `DELETE /moderation/blocks/:userId` (the one exception to the collaboration-derived-target rule — safe since `$pull` only ever removes from the caller's own array), `GET /moderation/reports` (admin), `PATCH /moderation/reports/:id` (admin).

**Leaving an in-progress collaboration:** originally an explicit scope cut ("blocking only prevents future re-matching, not an ongoing conversation") — closed as a follow-up once it was clear that gap mattered for severe cases. `POST /collaborations/:id/leave` (owned by the collaboration domain, §3, since it's a collaboration state transition, not a block/report action) freezes the collaboration for both participants — no more turns, no more chat (§7) — **without deleting anything either side wrote**. Rejected alternative: deleting the collaboration on leave, which would have destroyed the exact evidence a filed report needs, and let one person unilaterally erase content the other person co-authored and may have done nothing to deserve losing. Consistent with the project's existing anonymize-don't-delete precedent for account deletion (§2).

---

## 10. Admin domain

**What:** everything an admin does *about* a reported user, beyond just reading the report — list every user with their open-report count, ban or unban an account, delete (anonymize) one, and read a reported collaboration's full content (entries + chat) for context. A separate domain from moderation (§9) on purpose: this one operates on `User` and `Collaboration` data, not `Report` data, and mixing the two would blur what each domain owns.

**Why an admin account can't also write:** the point of splitting this out was to make the admin path genuinely distinct from the writer path, not just a nav link bolted onto the same UI (see `docs/FRONTEND.md`). `blockInactiveParticipant` (§2) enforces that server-side — an admin account gets a 403 on Quick Match, invite create/redeem, turn submission, completion response, and chat send, regardless of what the frontend shows.

**`listUsers()`:** every `User` (`displayName`, `email`, `role`, `isBanned`, `isDeleted`, `createdAt`), merged with an `openReportCount` computed via one `Report.aggregate` grouped by `reportedUser` (only `status: 'open'` reports count) — avoids an N+1 query per user row.

**`banUser`/`unbanUser`/`deleteUser`:** all reject targeting your own account with a 400; `deleteUser` additionally rejects targeting another admin. `deleteUser` doesn't reimplement anything — it just calls the authentication domain's existing `deleteAccount(userId)` (§2), the same anonymize-don't-hard-delete function self-service account deletion already uses, so a reported user's old collaborations/chat keep resolving a valid (if scrubbed) reference exactly like any other deleted account.

**`getReportedCollaboration(collaborationId)`:** the fix for a bug found while building this — the original admin panel's "View collaboration" link pointed at the regular `GET /collaborations/:id`, which is participant-gated (`findAccessible`, §3); an admin reviewing a report about two other users got a 403 there. This new admin-only endpoint fetches the collaboration **and** its chat history with no participant check at all — chat is included deliberately, since that's where harassment/spam actually tends to happen, not the co-written story text. The frontend renders this read-only, inline under the report row, rather than reusing the participant-facing collaboration page (which is full of actions — Report/Block/Leave/turn composer/chat send — that make no sense for a reviewing admin).

**Endpoints:** `GET /admin/users`, `PATCH /admin/users/:id/ban`, `PATCH /admin/users/:id/unban`, `DELETE /admin/users/:id`, `GET /admin/collaborations/:id`, `PATCH /admin/collaborations/:id/unpublish` (§11). All gated `requireAuth, requireAdmin` (§2).

---

## 11. Gallery domain (discovery)

**What:** lets writers optionally publish a completed collaboration to a public, browsable gallery — anyone, logged in or not, can read a published piece. Final phase of a three-part public-launch roadmap (turn notifications → theme variety → this).

**Consent model (settled design, not incidental):** publishing itself never requires the other participant's agreement — either can publish or unpublish a completed piece unilaterally (`setGalleryPublished` in `collaboration.service.js`), since requiring mutual sign-off would recreate the exact "one person's silence blocks the other's wish" problem this was built to avoid. Being **named** is a separate, personal choice (`setPublishConsent`, also in `collaboration.service.js`) — each participant has their own `hasConsentedToPublish` flag on their own participant subdocument, defaulting to `false` (**"Anonymous collaborator"**), independent of whether the piece is published, of who published it, and of the other participant's own choice. There's no special-casing "the person who clicked publish auto-consents," no pending/waiting state, and no timeout logic — silence, an explicit no, and never touching the toggle all collapse to the same outcome. That last point matters concretely here (as it did for turn notifications) because this stack has no cron/queue infrastructure to resolve a pending state against.

**Model additions (`Collaboration`):** `isPublished` (Boolean, default `false`), `publishedAt` (Date, set the first time it flips true, left alone on unpublish — `isPublished` is the actual visibility source of truth), and per-participant `hasConsentedToPublish` (Boolean, default `false`). No `title` field was added — a gallery card is identified by writingType/theme/date plus an auto-derived excerpt instead, avoiding new input UI entirely.

**Why a separate `gallery` domain instead of new branches in `collaboration`:** this is the first genuinely public read surface in the entire API — `gallery.routes.js` has no `requireAuth` at all, unlike every other domain. Keeping it separate means `collaboration.service.js`'s participant-gated `findAccessible` never has to grow a "well, unless it's published" exception; the two read paths (participant-gated vs. public) stay structurally distinct.

**The one security-critical detail in this whole feature:** the byline (real `displayName` vs. `'Anonymous collaborator'`) is computed **server-side**, in `gallery.service.js`'s `buildDisplayNameMap`, before any response is built — applied uniformly to both the piece-level author list and each individual turn's `entry.author`, since a consent toggle would be pointless if a reader could still see the real name on every turn. Never send a raw `displayName` for a non-consenting participant and rely on the frontend to hide it — the exact class of bug already avoided once in this codebase (never leaking email via `collaboration.service.js`'s `PARTICIPANT_POPULATE`, §3).

**`listPublished({page, limit, writingType, theme})`:** `Collaboration.find({isPublished: true, ...filters})`, sorted `publishedAt` descending, same `{items, hasMore, total}` pagination shape the rest of the app uses. Each item includes a plain-text excerpt (HTML stripped, truncated to 150 characters from the joined entry content).

**`getPublished(collaborationId)`:** 404s unless `isPublished === true` — this holds even for the piece's own authors; viewing an *unpublished* piece always goes through the normal participant-gated `GET /collaborations/:id`, never this route. Returns full entries (safe to show as-authored — consent only ever governs the author's *name*, never the writing) with the same consent-respecting byline per entry.

**Moderation backstop:** gallery content is visible to any visitor, not just the two authors. The admin domain (§10) has `unpublishCollaboration(collaborationId)` — no participant check, same reasoning as `getReportedCollaboration` — as the enforcement action, and moderation's `reportGalleryContent` (§9) is the corresponding visitor-facing report path, added once it became clear `reportUser`'s participant-required design couldn't cover "a random visitor reports a public piece they had no part in." The two are wired together in the admin UI: a gallery report shows up in the same reports list, and expanding it to view the collaboration shows an "Unpublish" button right there when the piece is still published.

**Endpoints:** `GET /gallery` (list, filterable by `writingType`/`theme`), `GET /gallery/:id` (detail) — no auth middleware at all. `PATCH /collaborations/:id/publish` and `PATCH /collaborations/:id/publish-consent` (both `requireAuth` + `blockInactiveParticipant`, §2/§3) are where a participant actually toggles publish state or their own consent.

---

## 12. Sockets

Every domain that needs to push a real-time notification (matchmaking, invite, collaboration, chat) shares one Socket.IO server (`sockets/index.js`):
- **Auth:** a connection-level middleware reads the `accessToken` cookie from the handshake headers (hand-parsed — no new dependency) and verifies it with the same JWT logic as HTTP's `requireAuth`.
- **Addressing:** every authenticated socket joins a room named `user:<userId>`, so any service can do `io.to('user:<id>').emit(...)` to reach a specific user regardless of how many tabs/devices they have open, without threading socket references through every layer — `getIO()` is exported for that.

**⚠️ Known limitation:** single-instance only. There's no Redis (or other) adapter, so rooms only exist within one Node process's memory. This is fine for the current single-server deployment, but real-time delivery would silently break for any user connected to a different instance the moment this runs behind a load balancer or on more than one process.

---

## 13. Rate limiting

`express-rate-limit`, applied in `app.js`:
- A general baseline across all of `/api`: 300 requests / 15 min per IP.
- A stricter limiter specifically on `/auth/register`, `/auth/login`, `/auth/google`, `/auth/forgot-password`, and `/auth/reset-password`: 20 requests / 15 min per IP — the endpoints actually worth brute-forcing or spamming.

**⚠️ Known limitation:** the default store is in-memory. It resets on every server restart and doesn't share counts across multiple instances — real protection against a determined or distributed attacker would need a shared store (e.g. Redis-backed).

---

## 14. Automated testing

`npm test` (in `server/`) runs `node --test "src/**/*.test.js"` — Node's built-in test runner, zero new dependencies. Tests are colocated with the service they cover (`*.service.test.js`), and hit the **real** MongoDB Atlas dev database directly (matching this project's established practice of testing against real infrastructure rather than mocks), with explicit cleanup in every test.

- **Mailer mocking:** `utils/mailer.js` exports a single mutable object (`{ sendVerificationEmail, sendPasswordResetEmail, sendGoogleAccountNoticeEmail }`) rather than named exports, specifically so `node:test`'s `mock.method()` can swap individual methods in auth tests — ES module named-export bindings are frozen and can't be mocked this way, a plain object's properties can.
- **Socket-dependent services:** `testUtils/testSocket.js` spins up a throwaway HTTP server + `initIO()` so services that call `getIO()` (matchmaking, invite, collaboration) don't throw in tests — nothing needs to actually connect, `io.to(room).emit(...)` is a safe no-op with zero listening sockets.
- **Middleware tests:** `blockInactiveParticipant` (§2) is Express middleware, not a service function, and this project has no supertest-style HTTP test harness — rather than add one for a single middleware, `auth.middleware.test.js` calls it directly with a mock `req`/`res`/`next`, which exercises the exact same DB-check-and-branch logic without needing a running server.
- **Coverage:** auth (register/login/verify/reset/change-password/delete/banned-account-rejected-at-login, streak increment/reset across day boundaries, badge thresholds including partner-diversity and turn-count badges), collaboration (turn ownership, one-line/one-paragraph enforcement, completion approve/reject, pagination + status filtering, turn-count, leave-freezes-turns-and-completion, completion records leaderboard points and activity stats, turn-handoff sends a "your turn" email and respects its per-collaboration cooldown, publishing/unpublishing works unilaterally, publish consent only ever changes the caller's own subdocument), gallery (list only returns published pieces, consent-respecting bylines on both the piece and per-entry, writingType/theme filters, pagination, detail 404s for unpublished/nonexistent pieces including for the piece's own authors), invites (create/redeem/cancel/self-redeem-block/blocked-redeemer-rejected, theme stored and carried through redemption untouched by the redeemer), matchmaking (pairing logic, blocked-pair exclusion, differently-themed entries still match and resolve to one of the two themes, getStatus reports theme), AI keywords (`generateKeywords` returns 5 fallback words for both the default and a themed request), leaderboard (weighted-points idempotency, ranking, week/month-boundary exclusion, deleted-account exclusion, deterministic tie-breaking), moderation (report/block authorization, duplicate-report idempotency, bidirectional block lookup, admin report listing/review, gallery reports reject unpublished/nonexistent pieces, succeed for non-participants, idempotent, stored with a null reportedUser and source: 'gallery'), chat (send succeeds while in progress, send rejected once ended, history reads stay open regardless of status), admin domain (user listing with report counts, ban/unban, self-target and other-admin-target rejections, delete-anonymizes, reported-collaboration read with no participant check, unpublish works with no participant check), auth middleware (`blockInactiveParticipant` allows an active user, rejects a banned user, rejects an admin), CAPTCHA (`turnstile.verifyToken` succeeds/fails/bypasses-when-unconfigured against a mocked `fetch`, and `register` itself rejects when verification fails). 115 tests total, all passing.
- **What's deliberately not covered:** raw Socket.IO event delivery over the wire (verified manually/via live scripts during development instead — a full socket-server integration harness was judged not worth the added complexity for the confidence gained), `googleLogin`'s ban check (mirrors the tested `login()` check exactly, but there's no existing harness for mocking `google-auth-library`'s token verification, and building one just for this one-line symmetric check wasn't judged worth it — verified by code inspection instead), and the frontend now has only a first slice of coverage (Vitest/RTL, see `docs/FRONTEND.md` §16) — most of the client is still verified by manual reasoning and live curl/socket scripts, no Playwright/e2e coverage exists.

---

## 15. CI/CD

`.github/workflows/server-tests.yml` runs the backend test suite (§13) on every push and pull request, on any branch: checkout → `actions/setup-node@v4` (Node 22) → `npm ci` (server/) → `npm test`.

- **Secrets required:** `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (repo Settings → Secrets and variables → Actions). Tests hit the same real Atlas dev database as local development — consistent with this project's practice of testing against real infrastructure, though it does mean CI and local dev share state.
- **`GEMINI_API_KEY` is deliberately left unset in CI** — with no key, `generateKeywords()` falls straight through to the local fallback pool (§6), so running the suite never spends any of the 20-requests/day Gemini quota.
- **No frontend job yet** — there's no frontend test suite to run (§ see `docs/FRONTEND.md`), so the workflow only covers `server/`.

---

## 16. Bugs found and fixed

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
| 14 | Forgot-password stuck on "Sending…" forever in production | `requestPasswordReset` awaited the actual SMTP send before the HTTP response returned; once deployed, the SMTP connection (first Gmail, then a second provider) hung with `ETIMEDOUT` on `CONN` — very likely Render blocking outbound SMTP ports (25/465/587) entirely, not a credential/config issue, since two completely different SMTP hosts failed identically | Stopped awaiting the mail send in the request path (fires in the background, errors logged server-side instead of blocking the response); added explicit nodemailer timeouts as a stopgap; ultimately replaced SMTP entirely with an HTTP API-based provider (port 443) since that's not subject to the same port-blocking risk — see §2 and the CVE note in §17 |
| 17 | Two throwaway `nodemon`/`node` process trees were both already occupying port 5000 during manual verification of the report/block feature, one a genuinely stale leftover, the other from this session's own crashed restart attempt (a `lsof`-based kill silently no-op'd, since `lsof` doesn't exist in Git Bash on Windows) | Neither was a code bug — a repeat of the exact "orphaned dev-server processes" class of incident already logged in §16, this time compounded by a Windows/Git-Bash tooling gap | Used PowerShell's `Get-CimInstance Win32_Process` to find the full `cmd → nodemon → node` process tree by command line (not just the port holder) and killed every PID in both trees before restarting cleanly |
| 15 | `express-rate-limit` threw `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` in production logs | Render sits behind a reverse proxy that sets `X-Forwarded-For`; Express's `trust proxy` setting defaults to `false`, so the rate limiter couldn't safely resolve the real client IP | `app.set('trust proxy', 1)` in `app.js` — trusts exactly the one proxy hop Render adds, matching the same fix Heroku deployments need |
| 16 | Migrated email from SendGrid to Brevo before SendGrid's 60-day trial expired | SendGrid's dashboard confirmed (and its own pricing page corroborated) that the trial is genuinely time-limited with no permanent free tier — continuing past ~2026-09-25 would require a paid plan ($19.95/mo+), which conflicts with this project's no-added-cost constraint | Rewrote `mailer.js` to use `@getbrevo/brevo`'s `transactionalEmails.sendTransacEmail` instead of `@sendgrid/mail` (same `mailer` object shape, no other code touched); Brevo's free tier (300 emails/day) has no trial expiration. Done proactively, ~2 months ahead of the deadline, rather than waiting |
| 18 | Blocking someone mid-collaboration didn't actually stop them from continuing to chat with you | Flagged as an explicit, deliberate scope cut when the report/block MVP shipped, then reconsidered: `chat.service.js`'s `sendMessage` had zero awareness of collaboration status, so chat kept working regardless of block state or even a mutual completion decline | Added a `leave` action (new `'left'` collaboration status, distinct from the existing `'private'` mutual-decline status) that freezes turns, completion, and now chat too for both participants — without deleting any data, so a filed report's context and the other participant's contributions both survive |
| 19 | Filed reports had no way to be reviewed as a body of data — only a one-off email | Deliberate MVP scope cut when report/block shipped, closed as the next follow-up per explicit request | Added `role` to `User` (`user`/`admin`, set manually in the DB only — no self-service promotion endpoint), a `requireAdmin` middleware that re-checks the DB fresh on every request (no JWT payload change, so a role edit takes effect without re-login), and a gated `/admin` page listing reports with a "Mark reviewed" action and a direct link into the referenced collaboration |
| 20 | An admin account could still join Quick Match, redeem/create invites, submit turns, and chat like any normal writer; there was also no way to act on a report beyond marking it reviewed; and the report panel's "View collaboration" link 403'd for an admin who wasn't a participant | The first admin panel pass (#19) only gated the two `/moderation/reports` routes — nothing else anywhere checked `role`, and `GET /collaborations/:id` was (correctly, for a normal user) participant-gated, which an admin reviewing someone else's report will never be | Added `blockInactiveParticipant` middleware (§2) to the actual participant-acting endpoints across matchmaking/invite/collaboration/chat; added a new `admin` domain (§10) with user listing (+ open-report counts), ban/unban, delete (reuses the existing `deleteAccount` anonymization), and a participant-check-free `GET /admin/collaborations/:id` that also returns chat history; gave the admin UI its own shell/nav entirely separate from the writer UI (see `docs/FRONTEND.md`) |
| 21 | Clicking "Mark reviewed" made a report's reporter/reported-user both collapse to "Deleted user" in the admin UI, until the page was refreshed | `markReportReviewed` returned the raw updated `Report` document with `reporter`/`reportedUser` as bare ObjectIds — unlike `listReports`, it never populated them — and the frontend swaps that response straight into local state, so the row rendered with no `displayName`/`email` to read until the next full `listReports()` refetch repopulated it | Added the same `.populate('reporter', ...)`/`.populate('reportedUser', ...)` chain `listReports` already uses to `markReportReviewed`; strengthened its test to assert the names survive the update, not just the status |
| 22 | `collaboration.service.test.js`'s turn-notification tests flaked intermittently across full-suite runs — sometimes 1 call expected but 0 or 2 observed | The "your turn" email is sent fire-and-forget from `submitTurn` (§3); one test (`submitTurn accepts valid content...`) triggered a notification but never waited for it before finishing, so its dangling promise could resolve *during* a later test and call that later test's freshly-installed mock instead — an extra, unexpected call landing in a different test's count. A fixed `setTimeout` "flush" delay in the two tests that did wait was also just masking the same class of issue (works until real DB latency exceeds the delay) | Every test that triggers a notification now drains it via a poll-until-expected-call-count helper (not a fixed sleep) before finishing, so no fire-and-forget work can cross a test boundary; found via repeated full-suite runs surfacing two different failure shapes (`0 !== 1`, then `2 !== 1`) that pointed at cross-test leakage rather than a single race |
| 23 | `npm ci` failed in CI again with `EUSAGE`/"package-lock.json in sync", same shape as bug #13 — missing `google-auth-library`'s transitive `gcp-metadata`/`gaxios`/`https-proxy-agent`/`agent-base`/`debug` entries, and `npm ci` passed *locally* against the exact same committed lockfile | Confirmed this is genuinely npm-version-specific, not a fluke: a local `npm ci` succeeding only proves the lockfile is tolerable to *that* npm version, not that it's complete — CI's `actions/setup-node@v4` resolves whatever Node 22.x patch is current, which can carry a different bundled npm than a local machine, and a stricter npm can reject a lockfile a looser one silently accepts | Same fix as #13, repeated: deleted `node_modules` and `package-lock.json` entirely (not just `npm ci` against the existing one) and ran a fully clean `npm install` to regenerate it from scratch, then verified `npm ci` round-tripped and the full suite passed before committing. Lesson: after this recurs a third time, stop treating "`npm ci` passes for me locally" as sufficient evidence the lockfile is CI-safe |

## 17. Operational incidents (not code bugs, but shaped a lot of this build)

- **MongoDB Atlas connectivity outage:** login and turn-submission both 500'd with a raw TLS/`ReplicaSetNoPrimary` error from Mongoose. Root cause was Atlas's Network Access list no longer matching the current public IP (common with dynamic ISP addresses) — fixed by widening it to `0.0.0.0/0`. Not a code issue; confirmed by testing the exact same request before/after the allow-list change.
- **Orphaned dev-server processes:** every manual restart this session killed only the process holding port 5000, never the `npm run dev` → `nodemon` parent chain that spawned it. Over many restarts this left **16 orphaned nodemon instances** silently running, all watching the same files and racing each other to rebind the port after any edit — whichever won a given restart could be serving stale code from hours earlier. Fixed by identifying and killing every `nodemon.js .../server.js` and `npm-cli.js run dev` process by exact command line before any subsequent restart.

## 18. Known limitations (deliberately deferred, not overlooked)

- **All dependency CVEs are fixed** (down from four total — removing `nodemailer` cleared its CVE as a side effect; `react-router-dom` 6.24→7.18.2 fixed the open-redirect/`deserializeErrors()` advisories; `google-auth-library` 9.15.1→10.9.1 dropped the transitive `gaxios`/`uuid` CVE entirely, taking `npm audit` here to 0 vulnerabilities; `vite` 5.3.1→7.3.6 fixed both esbuild advisories client-side, deliberately targeting v7 rather than the `npm audit`-suggested v8 — v7.3.6 already carries a patched esbuild and avoids v8's mandatory Rolldown/Oxc bundler swap and forced `vitest` v4 bump, neither of which this project needed). The `google-auth-library` bump also added a previously-missing `"engines": { "node": ">=22" }` to `server/package.json`, since this repo had no pinned backend Node version at all before (Render's default depends on when the service was originally created — unpinned, that was a silent unknown).
- **Gemini's 20/day free-tier ceiling** (§6) — a product/cost decision, not a bug.
- **Rate limiting and Socket.IO are single-instance only** (§11, §12) — fine for the current deployment, real gaps the moment this runs on more than one process.
- **A ban's already-issued access token stays valid until it naturally expires** (≤15 min, §2) — `requireAuth` doesn't hit the DB, so the enforcement is on the specific write endpoints (`blockInactiveParticipant`) and on login/refresh, not truly instantaneous everywhere. Accepted trade-off, not fixed, to avoid a DB lookup on every authenticated request app-wide.
- **Frontend test coverage is a first slice, not comprehensive** — see `docs/FRONTEND.md` §16/§18.
- **Email deliverability:** `EMAIL_FROM` is a free Gmail address rather than a verified custom domain, since the project has no domain to verify. On SendGrid this landed in Gmail's Spam folder (Gmail treats unauthenticated `@gmail.com` senders as suspicious). On Brevo (the current provider), Brevo instead auto-substitutes its own authenticated subdomain in place of the unauthenticated one (observed: mail arrives "from" `...@<id>.brevosend.com` rather than the real Gmail address) to satisfy Gmail/Yahoo's mandatory sender-authentication rules — this is why delivery to the inbox improved, at the cost of an unfamiliar-looking sender address. No code fix without a paid custom domain to properly authenticate — worth still surfacing "check your spam folder" in the UI copy as a safety net.
