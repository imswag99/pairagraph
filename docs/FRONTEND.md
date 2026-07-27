# Pairagraph — Frontend Documentation

Everything built on the client: architecture, page-by-page behavior, real-time wiring, styling system, and a running log of frontend bugs found and fixed. Companion to [`docs/BACKEND.md`](BACKEND.md).

---

## 1. Architecture at a glance

**Stack:** React 18, Vite, React Router v6, Tailwind CSS, Tiptap (rich text), Framer Motion, `socket.io-client`, `jsPDF`.

**State management:** plain React Context + `useState`/`useEffect` — no Redux, Zustand, or React Query, by design. `AuthContext` is the only app-wide context; everything else is local component state plus a thin `services/*.js` layer of one-line `fetch` wrappers per domain (`authService`, `collaborationService`, `chatService`, `inviteService`, `matchmakingService`, `leaderboardService`), all routed through a single `services/api.js` that adds `credentials: 'include'` and unwraps `{success, message, data}` into a thrown `Error` on failure.

**Folder structure:**
```
client/src/
├── app/            App.jsx (providers), routes.jsx (route table + socket lifecycle)
├── components/
│   ├── auth/       Modal, LoginModal, RegisterModal, ForgotPasswordModal, GoogleSignInButton
│   ├── collaboration/   RichTextEditor, TurnComposer, EntryList, CompletionControls,
│   │                    KeywordChips, ChatPanel, CollaborationCard, QuickMatchPanel, InvitePanel
│   ├── layout/     AppShell, SidebarNav
│   ├── PenMark.jsx     logo mark
│   └── Skeleton.jsx    loading-state placeholders
├── context/        AuthContext.jsx
├── pages/          one file per route (see §2)
├── services/       thin per-domain API wrappers
├── sockets/        socket.js (the Socket.IO client singleton)
├── styles/         index.css (Tailwind layers + small overrides)
└── utils/          exportCollaborationPdf.js
```

**Routing** (`app/routes.jsx`): `/`, `/verify-email/:token`, `/collaborations`, `/collaborations/:id`, `/leaderboard`, `/invite/:code`, `/reset-password/:token`, `/account`, and a `*` catch-all → `NotFoundPage`. The same file owns the Socket.IO connection lifecycle: `socket.connect()`/`disconnect()` are tied to `isAuthenticated`, and it globally listens for `matchmaking:matched`/`invite:redeemed` to navigate straight into the new collaboration — these two events can fire while the user is sitting on any page, not just a collaboration-specific one, so the listener lives at the routing level rather than in a page component.

---

## 2. Pages

| Route | Page | Notes |
|---|---|---|
| `/` | `HomePage` | Branches on auth state: an unauthenticated `Hero` (logo, tagline, log in/sign up) vs. an authenticated `Dashboard` (animated hero + "Start something new"). No collaboration data is fetched here — deliberately decluttered (§4). |
| `/verify-email/:token` | `VerifyEmailPage` | Calls the verify endpoint on mount, shows success/error. |
| `/collaborations` | `CollaborationsPage` | "Continue writing" (active, unpaginated) + "Past collaborations" (paginated, "Load more"). See §6. |
| `/collaborations/:id` | `CollaborationPage` | The actual writing loop — see §5. |
| `/leaderboard` | `LeaderboardPage` | Week/all-time ranked table. See §8. |
| `/invite/:code` | `InvitePage` | Redeems the invite if logged in; otherwise shows a landing prompt with login/register modals. |
| `/reset-password/:token` | `ResetPasswordPage` | New-password form, reached only via the emailed link. |
| `/account` | `AccountPage` | Change display name, change password, delete account. See §9. |
| `*` | `NotFoundPage` | Catch-all for any unmatched path. |

---

## 3. Auth & session

`AuthContext` restores a session on load by trying `GET /auth/me`, and if that fails, `POST /auth/refresh` then `/me` again — so a page reload doesn't force a re-login as long as the refresh cookie is still valid. It exposes `register`, `verifyEmail`, `login`, `loginWithGoogle`, `logout`, `forgotPassword`, `resetPassword`, `updateProfile`, `changePassword`, `deleteAccount` — every one just calls the matching `authService` function and, where relevant, updates `currentUser`.

**Modals:** `LoginModal`, `RegisterModal`, `ForgotPasswordModal` share one `Modal` wrapper (backdrop, centered card, `Escape`-free close-on-backdrop-click, `aria-label="Close"` on the × button). `LoginModal` accepts an optional `onForgotPassword` callback so the pages that render it (`HomePage`, `InvitePage`) can wire "Forgot password?" into their own modal-switching state.

**Google Sign-In** (`GoogleSignInButton`): renders Google's own button via Google Identity Services (a `<script>` tag in `index.html`, no npm wrapper). Polls for `window.google.accounts.id` being ready (the script loads `async defer`) rather than checking once on mount. The button's width is measured from its own (responsive) container rather than hardcoded, so it doesn't overflow narrow phone screens (see bug log).

---

## 4. App shell & navigation

`AppShell` (header + `SidebarNav` + `<main>`) is the shared chrome for every authenticated page except `CollaborationPage` (which has its own distinct header — back link + partner name — since it's a focused writing view, not part of the dashboard family).

`SidebarNav` is a horizontal tab row on narrow screens, a vertical sidebar at `lg:` and up (matches the responsive pattern used elsewhere). It fetches `GET /collaborations/turn-count` on mount and shows a small pill badge on the "Collaborations" link when it's greater than zero — a lightweight, purpose-built count endpoint rather than fetching full collaboration data just to derive a number.

---

## 5. The writing loop (`CollaborationPage`)

Layout: a two-column grid at `lg:` and up — main content (instructions, entries, composer, completion controls) on the left, `ChatPanel` as a **persistent sticky sidebar** on the right; below `lg:`, chat becomes a collapsible accordion instead (no room for a second column on a phone).

- **Turn-rule enforcement, front-end side:** `RichTextEditor` (Tiptap, trimmed to `paragraph`/`text`/`bold`/`italic`/`history` only) blocks the Enter key entirely in `handleKeyDown`, so a poem turn is structurally one line and a story turn is structurally one paragraph — there's no way to create a second block or a line break in the first place. The server re-validates the same rule independently (see `BACKEND.md` §3) since a client can always be bypassed.
- **`EntryList`** renders each turn's HTML via `dangerouslySetInnerHTML` (safe here specifically because the input surface is fully controlled by the trimmed Tiptap config — it can only ever produce `<p>`/`<strong>`/`<em>`, never arbitrary attributes or scripts) with `break-words` so a long unbroken string can't blow out the layout.
- **`CompletionControls`** is a three-state component driven entirely by `self.hasApproved`/`other.hasApproved`: "suggest wrapping up" → "waiting on the other person" → "they want to wrap up, agree or decline."
- **Real-time:** the page listens for `collaboration:updated` (turn submitted or completion responded to, from either side) and replaces its local state wholesale — no polling, no manual refresh.
- **PDF export** (§10) appears as a button next to the status label, only once `status === 'completed'`.

---

## 6. Collaborations list (`CollaborationsPage`)

Two independently-fetched lists:
- **Active** (`status=in_progress`): fetched once with a generous limit (50) — no pagination, since a user realistically has few simultaneous in-progress collaborations and all of them plausibly need attention.
- **Past** (`status=completed,private`): paginated, 10 per page, with a "Load more" button that appends the next page rather than replacing the list. This is the list that actually grows unboundedly over time.

Both use the shared `CollaborationCard` (also used standalone nowhere else now — the earlier `PastCollaborationsSidebar` component was superseded by this page and deleted rather than left as dead code).

---

## 7. Chat (`ChatPanel`)

- **Responsive dual-mode:** persistent sticky sidebar at `lg:` and up, collapsible accordion below it — controlled by the same `isOpen` state, with CSS (`lg:flex` override) rather than a media-query listener deciding which mode actually applies.
- **Real-time:** `chat:message` appends to the open conversation; `chat:typing` drives a "Typing…" indicator that hides itself if no new ping arrives within 2.5s, since the server only ever relays "typing right now," never "stopped" (there's no such event to relay).
- **Pagination:** initial load fetches the most recent 30 messages. A "Load earlier messages" button (shown only when more exist) fetches older messages via a `before` cursor and **prepends** them — scroll position is explicitly preserved (captured before the fetch, restored via `requestAnimationFrame` after) so loading history doesn't yank the view away from what the user was reading. A ref flag (`isPrependingRef`) distinguishes this from "a new message arrived," which should still auto-scroll to the bottom.
- **Timestamps:** each message shows a time (`2:14 PM`), and a date divider ("Today" / "Yesterday" / `Jul 5, 2026`) is inserted whenever consecutive messages cross a day boundary — computed purely from `createdAt`, which every message has always stored, so this works retroactively on old conversations with zero migration.
- **Loading state:** three skeleton bubbles (alternating left/right) instead of plain "Loading…" text.

---

## 8. Matchmaking, invites, and the leaderboard

- **`QuickMatchPanel`**: join/cancel the matchmaking queue, polls its own status once on mount to resume a "waiting…" state after a refresh.
- **`InvitePanel`**: a segmented Create/Join control (`aria-pressed` reflects the active tab). Join accepts either a bare invite code or a full pasted URL (extracts the last path segment).
- **`LeaderboardPage`**: a This week/All time toggle (`aria-pressed`), a ranked table highlighting the current user's row, and a skeleton (3 placeholder rows) while loading. No pagination — capped at the top 50 server-side, which is plenty for a table this shape.

---

## 9. Account management (`AccountPage`)

Three independent sections, each with its own local loading/error/success state: **Profile** (display name), **Password** (hidden behind a "this account uses Google, no password set" message if `hasPassword` is false — the on-ramp being "Forgot password" from the login screen, which lets a Google-only account set one), and a **Danger zone** (delete account, gated behind typing the literal word "delete" into a confirmation input before the button enables).

---

## 10. PDF export (`utils/exportCollaborationPdf.js`)

Generates a PDF via `jsPDF` reading as one continuous piece — entries are joined into flowing prose (paragraphs for stories, stacked lines for poems), with **no per-turn author labels**, unlike the on-screen `EntryList`. A "Written by A & B" byline closes it out.

**Formatting is preserved, not stripped.** jsPDF has no HTML/rich-text layout of its own, so this is a small hand-rolled renderer:
1. `parseStyledRuns` walks the entry's HTML via the browser's own `DOMParser` (no library) into `{text, bold, italic}` runs, correctly inheriting style through nesting (`<strong>text <em>x</em></strong>` → the `<em>` span is both bold *and* italic).
2. `tokenize` splits runs into word/whitespace tokens without losing the style attached to each.
3. `layoutTokensIntoLines` greedily wraps tokens under the page's `maxWidth`, measuring each token in its *own* font style (bold/italic glyphs are wider than normal ones, so this has to happen per-token, not once per line).
4. Rendering walks each wrapped line token-by-token, switching `doc.setFont('times', style)` and advancing `x` by the measured width of each token.

Verified directly (not just read): unit-tested run-parsing (plain/bold/nested-italic-in-bold inheritance), tokenize round-trip losslessness, line-wrapping losslessness + width compliance under a deliberately narrow `maxWidth`, and a full end-to-end PDF generation checked with `pdf-parse` to confirm the extracted text survives with full continuity. All temporary test tooling (`jsdom`, `pdf-parse`, a temporarily-exported test surface) was removed afterward — production code only ever depends on `jspdf` plus the browser's native `DOMParser`.

---

## 11. Styling & theme

Tailwind config extends a small custom palette (`charcoal`, `paper`, `indigo` + light/dark/tint variants) and three keyframe animations (`fade-in`, `modal-in`, `backdrop-in`). Serif (`Iowan Old Style`/`Palatino`) for written content, sans (system UI stack) for chrome — a deliberate split between "the page" and "the app around the page."

**Responsive patterns used throughout:** `min-w-0` + `truncate` on flex children that could overflow (card titles, header text), `flex-wrap` fallback on header rows so a long display name wraps instead of overflowing, `break-words` on any free-form user content (chat bubbles, entry text), and sidebar/main column splits that collapse to a single column below `lg:`.

**Motion:** Framer Motion is used exactly once, deliberately — the dashboard hero (`HomePage`'s `DashboardHero`): staggered entrance (greeting → headline → tagline → "spark word" each ~120ms apart), a slow 12s ambient drift on the background gradient, and a crossfading "Today's spark…" word that rotates through a small local list every ~2.8s. It replaced an earlier version of the hero that had a "Start writing" button whose only job was scrolling to content already one glance below it — removed as dead weight rather than kept for the sake of having a CTA.

---

## 12. Real-time (`sockets/socket.js`)

A single `socket.io-client` instance (`autoConnect: false`) connected/disconnected by `AppRoutes` based on auth state. Events consumed across the app: `collaboration:updated` (turns/completion), `chat:message`, `chat:typing`, `matchmaking:matched`, `invite:redeemed`. Every listener is registered in a `useEffect` and torn down in its cleanup — no listener leaks across route changes.

---

## 13. Accessibility

Semantic landmarks (`<header>`, `<main>`, `<nav>`) were already in place. An explicit pass added:
- `aria-expanded` + `aria-controls` on the chat panel's collapse toggle (previously a bare "⌄" with no exposed state).
- `aria-label` + `aria-pressed` on the rich-text editor's Bold/Italic buttons (previously announced as just "B"/"I").
- `aria-pressed` on every other toggle-style control for consistency: `WritingTypePicker`, the leaderboard range toggle, the invite Create/Join toggle.
- `aria-hidden="true"` on purely decorative glyphs (the `CollaborationCard` chevron, the chat toggle's chevron) that were redundant next to already-descriptive text.

**Not done:** a real contrast/keyboard-nav/focus-order audit — the above closes the icon-only-control gap specifically, not a full accessibility pass.

---

## 14. Bugs found and fixed (frontend)

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

---

## 15. Known limitations

- **No automated frontend test coverage** — no Vitest/React Testing Library, no Playwright. Every behavior described in this document has been verified by manual reasoning, live curl/socket scripts during development, or production-build checks — not by a repeatable test suite. This is the single biggest gap on the frontend side.
- **No real accessibility audit** beyond the icon-only-control pass in §13 — contrast ratios, keyboard tab order, and screen-reader flow through multi-step forms haven't been systematically checked.
- **Large single JS bundle** — the production build warns about a >1MB main chunk (Tiptap + jsPDF + framer-motion all load upfront). Code-splitting (`React.lazy` per route, at minimum) would help but hasn't been done.
- **No offline/error-boundary handling** for unexpected render errors — a thrown error in a component tree currently has no `ErrorBoundary` catching it gracefully.
