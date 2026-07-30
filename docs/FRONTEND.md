# Pairagraph — Frontend Documentation

Everything built on the client: architecture, page-by-page behavior, real-time wiring, styling system, and a running log of frontend bugs found and fixed. Companion to [`docs/BACKEND.md`](BACKEND.md).

---

## 1. Architecture at a glance

**Stack:** React 18, Vite, React Router v6, Tailwind CSS, Tiptap (rich text), Framer Motion, `socket.io-client`, `jsPDF`, Cloudflare Turnstile (CAPTCHA), Sentry (`@sentry/react`, error tracking only).

**State management:** plain React Context + `useState`/`useEffect` — no Redux, Zustand, or React Query, by design. `AuthContext` is the only app-wide context; everything else is local component state plus a thin `services/*.js` layer of one-line `fetch` wrappers per domain (`authService`, `collaborationService`, `chatService`, `inviteService`, `matchmakingService`, `leaderboardService`), all routed through a single `services/api.js` that adds `credentials: 'include'` and unwraps `{success, message, data}` into a thrown `Error` on failure.

**Folder structure:**
```
client/src/
├── app/            App.jsx (providers), routes.jsx (route table + socket lifecycle)
├── components/
│   ├── auth/       Modal, LoginModal, RegisterModal, ForgotPasswordModal, GoogleSignInButton, TurnstileWidget
│   ├── collaboration/   RichTextEditor, TurnComposer, EntryList, CompletionControls,
│   │                    KeywordChips, ChatPanel, CollaborationCard, QuickMatchPanel, InvitePanel
│   ├── layout/     AppShell, SidebarNav, AdminShell
│   ├── ErrorBoundary.jsx   app-wide render-error fallback
│   ├── PenMark.jsx     logo mark
│   └── Skeleton.jsx    loading-state placeholders
├── context/        AuthContext.jsx
├── pages/          one file per route (see §2)
├── services/       thin per-domain API wrappers
├── sockets/        socket.js (the Socket.IO client singleton)
├── styles/         index.css (Tailwind layers + small overrides)
└── utils/          exportCollaborationPdf.js
```

**Routing** (`app/routes.jsx`): `/`, `/verify-email/:token`, `/collaborations`, `/collaborations/:id`, `/leaderboard`, `/invite/:code`, `/reset-password/:token`, `/account`, `/privacy`, `/terms`, `/admin`, `/admin/users`, and a `*` catch-all → `NotFoundPage`. The same file owns the Socket.IO connection lifecycle: `socket.connect()`/`disconnect()` are tied to `isAuthenticated`, and it globally listens for `matchmaking:matched`/`invite:redeemed` to navigate straight into the new collaboration — these two events can fire while the user is sitting on any page, not just a collaboration-specific one, so the listener lives at the routing level rather than in a page component.

**Code-split per route:** every page is a `lazy(() => import(...))` rather than a static import, wrapped in one `<Suspense fallback={<RouteFallback />}>` around the whole `<Routes>` tree. Pages only have named exports (`export function HomePage()`, not `export default`), so each dynamic import is remapped to the default-export shape `React.lazy` requires via a small `namedLazy` helper, rather than adding a default export to every page file just for this. This is what took the production build's main entry chunk from ~1.2MB down to ~216KB — Tiptap (`CollaborationPage`), jsPDF/html2canvas (`exportCollaborationPdf`), and Framer Motion (`HomePage`) now only load when their page is actually visited, instead of upfront on every load regardless of which page a user lands on.

**Error boundary:** `App.jsx` wraps everything inside `BrowserRouter` in one `ErrorBoundary` (a class component — `componentDidCatch`/`getDerivedStateFromError` have no hook equivalent). An unexpected render error anywhere now shows a friendly "Something went wrong" screen with a reload link instead of a blank white page; the underlying error is still logged to the console (`componentDidCatch`) for debugging, just not shown to the user.

**Error tracking (Sentry):** `main.jsx` calls `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0 })` before the app renders — `tracesSampleRate: 0` and no `browserTracingIntegration` added means this stays strictly error tracking, not performance monitoring (a separate product/quota this project isn't using). No-ops entirely if `VITE_SENTRY_DSN` is unset, matching every other optional integration in this project. `ErrorBoundary`'s `componentDidCatch` calls `Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })` alongside its existing `console.error`, so a render error now reaches Sentry too, not just the browser console nobody's watching. Sentry's default browser integrations also pick up unhandled promise rejections and global `window.onerror` events outside the React tree automatically, with no extra code — that coverage came for free just from calling `init()`.

---

## 2. Pages

| Route | Page | Notes |
|---|---|---|
| `/` | `HomePage` | Branches on auth state: an unauthenticated `Hero` (logo, tagline, log in/sign up) vs. an authenticated `Dashboard` (animated hero + "Start something new") — or, for an admin account, an immediate redirect to `/admin` (§5). No collaboration data is fetched here — deliberately decluttered (§4). |
| `/verify-email/:token` | `VerifyEmailPage` | Calls the verify endpoint on mount, shows success/error. |
| `/collaborations` | `CollaborationsPage` | "Continue writing" (active, unpaginated) + "Past collaborations" (paginated, "Load more"). See §7. |
| `/collaborations/:id` | `CollaborationPage` | The actual writing loop — see §6. |
| `/leaderboard` | `LeaderboardPage` | Week/all-time ranked table. See §9. |
| `/discover` | `GalleryPage` | Public gallery of published collaborations — works for both logged-in and logged-out visitors. See §15. |
| `/discover/:id` | `GalleryItemPage` | A single published piece, read-only. See §15. |
| `/invite/:code` | `InvitePage` | Redeems the invite if logged in; otherwise shows a landing prompt with login/register modals. |
| `/reset-password/:token` | `ResetPasswordPage` | New-password form, reached only via the emailed link. |
| `/account` | `AccountPage` | Change display name, change password, blocked users, delete account. See §10. |
| `/privacy` | `PrivacyPolicyPage` | Static page, linked from the landing footer, the logged-in app shell footer, and the signup disclaimer. |
| `/terms` | `TermsOfServicePage` | Same linking pattern as Privacy. |
| `/admin` | `AdminReportsPage` | Gated to `currentUser.role === 'admin'` (redirects home otherwise) — lists filed reports, each expandable inline into the reported collaboration's entries + chat, with a "Mark reviewed" action. See §5. |
| `/admin/users` | `AdminUsersPage` | Same gating — every user, open-report counts, ban/unban, delete. See §5. |
| `*` | `NotFoundPage` | Catch-all for any unmatched path. |

---

## 3. Auth & session

`AuthContext` restores a session on load by trying `GET /auth/me`, and if that fails, `POST /auth/refresh` then `/me` again — so a page reload doesn't force a re-login as long as the refresh cookie is still valid. It exposes `register`, `verifyEmail`, `login`, `loginWithGoogle`, `logout`, `forgotPassword`, `resetPassword`, `updateProfile`, `changePassword`, `deleteAccount` — every one just calls the matching `authService` function and, where relevant, updates `currentUser`.

**Modals:** `LoginModal`, `RegisterModal`, `ForgotPasswordModal` share one `Modal` wrapper (backdrop, centered card, `Escape`-free close-on-backdrop-click, `aria-label="Close"` on the × button). `LoginModal` accepts an optional `onForgotPassword` callback so the pages that render it (`HomePage`, `InvitePage`) can wire "Forgot password?" into their own modal-switching state.

**Google Sign-In** (`GoogleSignInButton`): renders Google's own button via Google Identity Services (a `<script>` tag in `index.html`, no npm wrapper). Polls for `window.google.accounts.id` being ready (the script loads `async defer`) rather than checking once on mount. The button's width is measured from its own (responsive) container rather than hardcoded, so it doesn't overflow narrow phone screens (see bug log).

**CAPTCHA** (`TurnstileWidget`): same pattern as `GoogleSignInButton` — Cloudflare's widget script is a `<script>` tag in `index.html`, no npm wrapper, and the component polls for `window.turnstile` before calling `window.turnstile.render(...)`. Rendered only in `RegisterModal`, between the password field and the submit button; the token it produces (`onVerify`) is held in `captchaToken` state and sent to `POST /auth/register` alongside the rest of the form — the submit button stays disabled until a token exists, the same "disabled until valid" pattern already used elsewhere on this form. `onExpire`/`onError` are wrapped in `useCallback` in `RegisterModal` before being passed down — without that, a new inline arrow function on every keystroke in the *other* fields (email, password) would change the widget's effect dependencies and re-render/reset it while the user is still typing, which was caught before it shipped rather than after.

**Reset-on-any-failure, not just expiry:** Turnstile tokens are single-use, and the backend spends one the moment `authService.register` verifies it — *before* checking things like duplicate email. So a first attempt that fails for an unrelated reason (duplicate email, weak password) leaves the widget showing a solved checkmark for a token Cloudflare has already consumed; resubmitting unchanged would fail CAPTCHA verification a second time regardless of whether the original problem was fixed. `TurnstileWidget` exposes an imperative `reset()` (via `forwardRef`/`useImperativeHandle`, since Turnstile's own JS API doesn't hand out a fresh token on its own); `RegisterModal`'s `catch` block calls it — and clears `captchaToken` — on *every* failed submission, not just the widget's own `expired-callback`/`error-callback`.

---

## 4. App shell & navigation

`AppShell` (header + `SidebarNav` + `<main>`) is the shared chrome for every authenticated page except `CollaborationPage` (which has its own distinct header — back link + partner name — since it's a focused writing view, not part of the dashboard family).

`SidebarNav` is a horizontal tab row on narrow screens, a vertical sidebar at `lg:` and up (matches the responsive pattern used elsewhere). It fetches `GET /collaborations/turn-count` on mount and shows a small pill badge on the "Collaborations" link when it's greater than zero — a lightweight, purpose-built count endpoint rather than fetching full collaboration data just to derive a number. A third link, "Discover" (§15), points at the one page in this nav that also works for logged-out visitors — it just renders differently (no `AppShell`) when there's no session.

**An admin account never renders `AppShell`/`SidebarNav` at all.** An earlier pass added a conditional "Admin" link to `SidebarNav` — since removed, because it left an admin account able to reach every writer page (Quick Match, invites, the writing loop itself) through the exact same nav as everyone else. `HomePage` now redirects an admin straight to `/admin` instead of rendering the writer `Dashboard`, and both admin pages use a separate `AdminShell` with its own two-item nav (Reports, Users) — see §5.

---

## 5. Admin experience

**Why a separate shell:** the admin panel started as one more gated page inside the regular writer chrome (`AppShell`/`SidebarNav`) — which meant an admin account could still Quick Match, redeem invites, and write turns like anyone else, and "Admin" was just another tab. Closed by giving admin its own path end to end: `AdminShell` (own header badge, own two-item nav — Reports, Users, no Collaborations/Leaderboard) replaces `AppShell` on both admin pages, and `HomePage`'s `Dashboard` branch redirects an admin straight to `/admin` (`<Navigate to="/admin" replace />`) rather than ever rendering the writer dashboard. The backend enforces the writer-side half of this independently (`blockInactiveParticipant`, `BACKEND.md` §2) — the frontend change is about what an admin *sees*, not the only thing stopping them from writing.

**`AdminReportsPage`** (gates the same way `AccountPage` gates on `currentUser` — `if (currentUser?.role !== 'admin') return <Navigate to="/" replace />`): fetches `GET /moderation/reports` on mount, renders each as a card (reason, reporter/reported-user name + email, optional details, a "Mark reviewed" button that calls `PATCH /moderation/reports/:id` and swaps just that card's data in local state rather than refetching the list). "View collaboration" used to link straight to `/collaborations/:id` — broken for an admin who isn't a participant there (`findAccessible`, `BACKEND.md` §3, rejects them with a 403). Replaced with an inline expand/collapse toggle: a `CollaborationPreview` sub-component fetches `GET /admin/collaborations/:id` (no participant check, `BACKEND.md` §10) on first expand and renders the entries and chat history read-only underneath the report row — deliberately not a reuse of `CollaborationPage`, since that page is full of participant-only actions (Report/Block/Leave, the turn composer, chat send) that make no sense for a reviewing admin.

**`AdminUsersPage`**: every user from `GET /admin/users` (already merged server-side with an open-report count), each row showing an open-report badge when >0, Banned/Deleted badges, and — unless the row is the admin's own account, another admin, or already deleted — a Ban/Unban toggle and a Delete action (two-step inline confirm, the same "Leave?"-style pattern `CollaborationPage` already uses for Block/Leave rather than a modal). Self and other-admin rows render with no action buttons at all instead of disabling them, since there's nothing a click there could ever legitimately do.

**`AccountPage`** (§10) is the third page in this path, not a separate one — `AdminShell`'s header links to `/account` the same as `AppShell`'s does, so it has to render inside `AdminShell` for an admin too, or the one working nav link out of the admin panel would drop them right back into the writer chrome it exists to avoid.

---

## 6. The writing loop (`CollaborationPage`)

Layout: a two-column grid at `lg:` and up — main content (instructions, entries, composer, completion controls) on the left, `ChatPanel` as a **persistent sticky sidebar** on the right; below `lg:`, chat becomes a collapsible accordion instead (no room for a second column on a phone).

- **Turn-rule enforcement, front-end side:** `RichTextEditor` (Tiptap, trimmed to `paragraph`/`text`/`bold`/`italic`/`history` only) blocks the Enter key entirely in `handleKeyDown`, so a poem turn is structurally one line and a story turn is structurally one paragraph — there's no way to create a second block or a line break in the first place. The server re-validates the same rule independently (see `BACKEND.md` §3) since a client can always be bypassed.
- **`EntryList`** renders each turn's HTML via `dangerouslySetInnerHTML` (safe here specifically because the input surface is fully controlled by the trimmed Tiptap config — it can only ever produce `<p>`/`<strong>`/`<em>`, never arbitrary attributes or scripts) with `break-words` so a long unbroken string can't blow out the layout.
- **`CompletionControls`** is a three-state component driven entirely by `self.hasApproved`/`other.hasApproved`: "suggest wrapping up" → "waiting on the other person" → "they want to wrap up, agree or decline."
- **Real-time:** the page listens for `collaboration:updated` (turn submitted or completion responded to, from either side) and replaces its local state wholesale — no polling, no manual refresh.
- **PDF export** (§11) appears as a button next to the status label, only once `status === 'completed'`.
- **Report/Block/Leave:** next to the partner's name in the header, a "Report" button opens `ReportModal` (reason dropdown + optional details, mirrors `ForgotPasswordModal`'s state pattern); "Block" and "Leave" are both two-step inline confirms ("Block?"/"Leave?" + Yes/Cancel) rather than modals, since they're single low-ambiguity actions. Blocking doesn't touch the current collaboration (only affects future matching, `BACKEND.md` §9) — the page's own state is untouched. Leaving does: the response replaces `collaboration` the same way submitting a turn does, so the page immediately reflects the frozen `'left'` status for the leaver, and the other participant sees it live via the existing `collaboration:updated` socket listener with zero extra wiring. Only shown while `status === 'in_progress'` — once left, there's nothing left to leave.
- **After leaving:** the generic "This collaboration is {status}." fallback text is skipped for `status === 'left'` in favor of a specific message using the new `leftBy` field — "You left this collaboration." or "{name} left this collaboration." depending on the viewer, since the generic phrasing didn't read naturally for this one case. `ChatPanel` receives a new `isActive={status === 'in_progress'}` prop and disables its send form (replacing it with "This conversation has ended.") once false — reading old messages stays available either way, only new sends are blocked, matching the backend's own read/write split.

---

## 7. Collaborations list (`CollaborationsPage`)

Two independently-fetched lists:
- **Active** (`status=in_progress`): fetched once with a generous limit (50) — no pagination, since a user realistically has few simultaneous in-progress collaborations and all of them plausibly need attention.
- **Past** (`status=completed,private`): paginated, 10 per page, with a "Load more" button that appends the next page rather than replacing the list. This is the list that actually grows unboundedly over time.

Both use the shared `CollaborationCard` (also used standalone nowhere else now — the earlier `PastCollaborationsSidebar` component was superseded by this page and deleted rather than left as dead code).

---

## 8. Chat (`ChatPanel`)

- **Responsive dual-mode:** persistent sticky sidebar at `lg:` and up, collapsible accordion below it — controlled by the same `isOpen` state, with CSS (`lg:flex` override) rather than a media-query listener deciding which mode actually applies.
- **Real-time:** `chat:message` appends to the open conversation; `chat:typing` drives a "Typing…" indicator that hides itself if no new ping arrives within 2.5s, since the server only ever relays "typing right now," never "stopped" (there's no such event to relay).
- **Pagination:** initial load fetches the most recent 30 messages. A "Load earlier messages" button (shown only when more exist) fetches older messages via a `before` cursor and **prepends** them — scroll position is explicitly preserved (captured before the fetch, restored via `requestAnimationFrame` after) so loading history doesn't yank the view away from what the user was reading. A ref flag (`isPrependingRef`) distinguishes this from "a new message arrived," which should still auto-scroll to the bottom.
- **Timestamps:** each message shows a time (`2:14 PM`), and a date divider ("Today" / "Yesterday" / `Jul 5, 2026`) is inserted whenever consecutive messages cross a day boundary — computed purely from `createdAt`, which every message has always stored, so this works retroactively on old conversations with zero migration.
- **Loading state:** three skeleton bubbles (alternating left/right) instead of plain "Loading…" text.

---

## 9. Matchmaking, invites, and the leaderboard

- **`QuickMatchPanel`**: join/cancel the matchmaking queue, polls its own status once on mount to resume a "waiting…" state after a refresh (including the chosen `theme`, alongside `writingType`).
- **`InvitePanel`**: a segmented Create/Join control (`aria-pressed` reflects the active tab). Join accepts either a bare invite code or a full pasted URL (extracts the last path segment); the Create tab is the only place `writingType`/`theme` are chosen — the redeemer has no say in either.
- **`ThemePicker`** (`client/src/components/collaboration/ThemePicker.jsx`): same toggle-button-group pattern as `WritingTypePicker`, fed from `client/src/constants/themes.js`'s `THEME_OPTIONS`, wrapped (`flex-wrap`) since its 6 options don't fit one line the way `writingType`'s 2 did. Rendered alongside `WritingTypePicker` in both `QuickMatchPanel` and `InvitePanel`'s Create tab.
- **`LeaderboardPage`**: a This week/This month/All time toggle (`aria-pressed`), a ranked table highlighting the current user's row, and a skeleton (3 placeholder rows) while loading. No pagination — capped at the top 50 server-side, which is plenty for a table this shape. A `StatsPanel` above the table reads streak/completion/badge fields straight off `currentUser` (already returned by every auth endpoint via the backend's `toSafeUser`, see `BACKEND.md` §8) — no extra request needed to show a user their own stats. The panel renders the **full badge catalog** (`client/src/constants/badges.js`, shared with the Homepage teaser below), not just earned ones — locked badges show dashed/muted with their unlock condition, so the game element is discoverable before a user has earned anything, not just a trophy case after the fact.
- **Badge progress teaser (`HomePage.jsx`'s `BadgeProgressTeaser`)**: a single-line pill on the writer's dashboard, right under the hero, showing `n/13 badges` and a "Next up: <name> — <how to earn it>" nudge, linking to `/leaderboard`. Deliberately kept to one line rather than the full gallery — the dashboard's job is still "get the user writing," so this is a hint of the game layer, not the game layer itself.

---

## 10. Account management (`AccountPage`)

One shared page for both writer and admin accounts, but the shell and one section depend on `currentUser.role`: it picks `AdminShell` over `AppShell` for an admin (§5) — otherwise the "Account" link in `AdminShell`'s own header dropped an admin straight into the writer chrome, defeating the point of having a separate admin shell — and skips the **Blocked users** section entirely for an admin, since an admin can never participate in a collaboration (§5) and so can never have blocked anyone; the section would only ever show "You haven't blocked anyone," pure clutter.

Sections, each with its own local loading/error/success state: **Profile** (display name), **Password** (hidden behind a "this account uses Google, no password set" message if `hasPassword` is false — the on-ramp being "Forgot password" from the login screen, which lets a Google-only account set one), **Blocked users** (writer accounts only — fetched via `GET /moderation/blocks` on mount, each row a display name + "Unblock" button that calls `DELETE /moderation/blocks/:userId` and removes the row from local state directly rather than refetching), and a **Danger zone** (delete account, gated behind typing the literal word "delete" into a confirmation input before the button enables — unchanged for admin accounts, self-deletion here is unrelated to the admin panel's separate "can't delete another admin/yourself" guard, §10 of `BACKEND.md`).

---

## 11. PDF export (`utils/exportCollaborationPdf.js`)

Generates a PDF via `jsPDF` reading as one continuous piece — entries are joined into flowing prose (paragraphs for stories, stacked lines for poems), with **no per-turn author labels**, unlike the on-screen `EntryList`. A "Written by A & B" byline closes it out.

**Formatting is preserved, not stripped.** jsPDF has no HTML/rich-text layout of its own, so this is a small hand-rolled renderer:
1. `parseStyledRuns` walks the entry's HTML via the browser's own `DOMParser` (no library) into `{text, bold, italic}` runs, correctly inheriting style through nesting (`<strong>text <em>x</em></strong>` → the `<em>` span is both bold *and* italic).
2. `tokenize` splits runs into word/whitespace tokens without losing the style attached to each.
3. `layoutTokensIntoLines` greedily wraps tokens under the page's `maxWidth`, measuring each token in its *own* font style (bold/italic glyphs are wider than normal ones, so this has to happen per-token, not once per line).
4. Rendering walks each wrapped line token-by-token, switching `doc.setFont('times', style)` and advancing `x` by the measured width of each token.

Verified directly (not just read): unit-tested run-parsing (plain/bold/nested-italic-in-bold inheritance), tokenize round-trip losslessness, line-wrapping losslessness + width compliance under a deliberately narrow `maxWidth`, and a full end-to-end PDF generation checked with `pdf-parse` to confirm the extracted text survives with full continuity. All temporary test tooling (`jsdom`, `pdf-parse`, a temporarily-exported test surface) was removed afterward — production code only ever depends on `jspdf` plus the browser's native `DOMParser`.

---

## 12. Styling & theme

Tailwind config extends a small custom palette (`charcoal`, `paper`, `indigo` + light/dark/tint variants) and three keyframe animations (`fade-in`, `modal-in`, `backdrop-in`). Serif (`Iowan Old Style`/`Palatino`) for written content, sans (system UI stack) for chrome — a deliberate split between "the page" and "the app around the page."

**Responsive patterns used throughout:** `min-w-0` + `truncate` on flex children that could overflow (card titles, header text), `flex-wrap` fallback on header rows so a long display name wraps instead of overflowing, `break-words` on any free-form user content (chat bubbles, entry text), and sidebar/main column splits that collapse to a single column below `lg:`.

**Motion:** Framer Motion is used exactly once, deliberately — the dashboard hero (`HomePage`'s `DashboardHero`): staggered entrance (greeting → headline → tagline → "spark word" each ~120ms apart), a slow 12s ambient drift on the background gradient, and a crossfading "Today's spark…" word that rotates through a small local list every ~2.8s. It replaced an earlier version of the hero that had a "Start writing" button whose only job was scrolling to content already one glance below it — removed as dead weight rather than kept for the sake of having a CTA.

---

## 13. Real-time (`sockets/socket.js`)

A single `socket.io-client` instance (`autoConnect: false`) connected/disconnected by `AppRoutes` based on auth state. Events consumed across the app: `collaboration:updated` (turns/completion), `chat:message`, `chat:typing`, `matchmaking:matched`, `invite:redeemed`. Every listener is registered in a `useEffect` and torn down in its cleanup — no listener leaks across route changes.

---

## 14. Accessibility

Semantic landmarks (`<header>`, `<main>`, `<nav>`) were already in place. An explicit pass added:
- `aria-expanded` + `aria-controls` on the chat panel's collapse toggle (previously a bare "⌄" with no exposed state).
- `aria-label` + `aria-pressed` on the rich-text editor's Bold/Italic buttons (previously announced as just "B"/"I").
- `aria-pressed` on every other toggle-style control for consistency: `WritingTypePicker`, the leaderboard range toggle, the invite Create/Join toggle.
- `aria-hidden="true"` on purely decorative glyphs (the `CollaborationCard` chevron, the chat toggle's chevron) that were redundant next to already-descriptive text.

**Not done:** a real contrast/keyboard-nav/focus-order audit — the above closes the icon-only-control gap specifically, not a full accessibility pass.

---

## 15. Gallery / discovery (`GalleryPage`, `GalleryItemPage`)

**What:** the public browsing surface for collaborations writers have opted to publish — the final phase of the notifications → theme variety → discovery roadmap.

**Dual-mode chrome, same pattern `HomePage` already uses:** both pages render inside the normal `AppShell` (with the `SidebarNav`'s new "Discover" link) when `currentUser` exists, or a minimal standalone header (logo + link home — the same chrome `PrivacyPolicyPage` already uses) when it doesn't. This is the first pair of pages in the app that render real collaboration content for a logged-out visitor at all — every other content-bearing page (`CollaborationPage`, `CollaborationsPage`, `LeaderboardPage`, `AccountPage`) redirects unauthenticated visitors outright.

**`GalleryPage`:** a paginated grid of cards (excerpt, writingType/theme tag, byline, publish date) with the same "Load more" pagination `CollaborationsPage`'s past-list already implements, plus writingType/theme filter chips styled like `WritingTypePicker`/`ThemePicker` but supporting an "All" option those don't.

**`GalleryItemPage`:** renders a published piece by reusing the existing `EntryList` component as-is — porting the PDF export's continuous-prose algorithm (`utils/exportCollaborationPdf.js`, §11) was considered and rejected, since that algorithm is DOM/jsPDF-specific and not reusable for an on-screen render, whereas `EntryList`'s existing turn-by-turn on-screen rendering already works unmodified here. No chat, composer, or completion controls — this is a read-only view, not a participant view.

**Publish/consent controls (`CollaborationPage`):** once a collaboration is `completed`, a new panel (next to the existing "Download PDF" button) shows a "Publish to gallery"/"Remove from gallery" toggle and a separate, personal "Show my name" checkbox. The two are deliberately independent — publishing never requires the other participant's agreement, and each participant's own name-consent choice never depends on who published it or what the other participant chose. Both call new `collaborationService` methods (`setPublished`, `setPublishConsent`) that PATCH the same collaboration record and swap the local state, same pattern `handleSubmitTurn`/`handleRespond` already use.

---

## 16. Bugs found and fixed (frontend)

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | Google Sign-In appeared to do nothing after picking an account | The button's callback had no error handling — any failure (e.g. a backend 500) failed silently in the browser | Added `try/catch` + an `onError` callback wired to visible modal error text |
| 2 | Google Sign-In button sometimes never rendered | `useEffect` checked for `window.google` once on mount; the GIS script loads `async defer` and could still be loading | Poll until the script is ready instead of a one-shot check |
| 3 | Email verification link did nothing (blank page) | Backend endpoint existed, but no frontend route was ever built for `/verify-email/:token` | Added `VerifyEmailPage` + route |
| 4 | Login/signup modal stayed open after a successful Google sign-in | Local email/password login called `onClose()` on success; the Google path never did | Wired `onSuccess={onClose}`, plus a `useEffect` on `currentUser` that force-closes any open modal the moment auth state flips |
| 5 | Blank-screen crash after submitting a turn: `Cannot read properties of undefined (reading 'hasApproved')` | Backend returned unpopulated `participants[].user` after a turn; `CompletionControls` expected the same populated shape `getById` returns, got `undefined`, crashed reading `.hasApproved` off it | Backend fix (populate consistently — see `BACKEND.md` #8), but the crash surfaced here |
| 6 | A single invalid Tailwind `theme()` call broke the entire stylesheet | Used `theme('colors.charcoal / 40%')` — unsupported syntax for this Tailwind version | Replaced with a direct `rgb(35 35 32 / 0.4)` value |
| 7 | Turn submission and completion responses weren't live — the other participant had to refresh | No socket listener existed on the frontend (and no broadcast existed on the backend) for either action | Added `collaboration:updated` broadcast (backend) + a matching listener in `CollaborationPage` |
| 8 | Google Sign-In button overflowed on narrow phone screens | Fixed `width: 280` passed to Google's own button-rendering API, regardless of actual available space | Measured width from the button's own (responsive) container instead of hardcoding it |
| 9 | Dashboard sidebar collaboration cards could overflow their 300px column | No `min-w-0`/`truncate` on flex children holding variable-length text (partner name, status line) | Added `min-w-0` + `truncate` throughout, `shrink-0` on fixed-size siblings (badges, chevrons) |
| 10 | Header rows (dashboard, collaboration page) could overflow on narrow screens with a long display name | Plain `flex justify-between` with no wrap fallback | Added `flex-wrap` + truncation on the variable-length text |
| 11 | Chat bubbles and story/poem entries had no defense against a long unbroken string (e.g. a pasted URL) | No `break-words` on free-form content containers | Added `break-words` to both |
| 12 | The dashboard hero's only interactive element scrolled to content already visible one glance below it | A "Start writing" button was added as a CTA without checking whether it was actually needed, given the panels it targeted were already near the top of the page | Removed the button; replaced with actual atmosphere (staggered entrance motion, ambient gradient drift, a rotating inspiration word) — motion earns the hero's place instead of a fake action |
| 13 | An unused `constants/colors.js` file existed with zero imports anywhere in the codebase | Left over from an earlier pass, likely originally intended for the PDF export before that ended up not needing raw hex values | Deleted; confirmed via full-codebase grep that nothing referenced it and the build was unaffected |
| 14 | An admin account saw the exact same nav/dashboard as a writer, plus the admin report list's "View collaboration" link 403'd whenever the admin wasn't a participant in the reported collaboration | `AdminReportsPage` reused `AppShell`/`SidebarNav` (the writer chrome) and linked straight to the participant-gated `/collaborations/:id` — nothing about the frontend routing treated an admin account differently at all | Gave admin its own `AdminShell` + redirect-on-login (§5), and replaced the broken link with an inline, admin-only, no-participant-check preview fetched from a new backend endpoint |
| 15 | Clicking "Account" from the new `AdminShell` dropped the admin straight back into the regular writer chrome, defeating the point of a separate admin path; the account page also showed a "Blocked users" section that could never contain anything for an admin | `AccountPage` unconditionally rendered `AppShell` and unconditionally rendered `BlockedUsersSection`, with no `role` check at all — an oversight in the same admin-separation pass that missed this one shared page | `AccountPage` now picks `AdminShell` vs `AppShell` based on `currentUser.role`, and skips `BlockedUsersSection` entirely for an admin |
| 16 | A registration retry after a failed first attempt (e.g. duplicate email) failed CAPTCHA verification too, even though the widget still showed a solved checkmark | Turnstile tokens are single-use, and the backend spends one on the very first attempt, before checking anything else; the widget doesn't know the form submission failed, so it never re-armed itself, and the retry resent the same already-consumed token | `TurnstileWidget` exposes `reset()` via `forwardRef`; `RegisterModal` calls it (and clears `captchaToken`) in the `catch` block of every failed submission, not just the widget's own expiry/error callbacks |

---

## 17. Known limitations

- **No automated frontend test coverage** — no Vitest/React Testing Library, no Playwright. Every behavior described in this document has been verified by manual reasoning, live curl/socket scripts during development, or production-build checks — not by a repeatable test suite. This is the single biggest gap on the frontend side.
- **No real accessibility audit** beyond the icon-only-control pass in §14 — contrast ratios, keyboard tab order, and screen-reader flow through multi-step forms haven't been systematically checked.
