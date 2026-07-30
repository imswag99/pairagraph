# Pairagraph

A quiet page for two, written one turn at a time.

Pairagraph is a turn-based collaborative writing app: two people are paired up (via quick match or an invite link) to write a short story or poem together, one line or paragraph at a time, with AI-suggested keywords for inspiration, a side chat, and a completion flow that needs both writers to agree before a piece is done.

## Features

- **Email/password and Google sign-in**, with email verification, password reset, account management (change display name/password, delete account), and a Cloudflare Turnstile CAPTCHA on registration to keep it from being spammed.
- **Turn-based writing** — one paragraph per turn for stories, one line per turn for poems, enforced both in the editor and on the server.
- **Quick Match** (paired with a random waiting partner) and **invite links** as the two ways to start a collaboration.
- **AI-generated keywords** (Google Gemini, with a local fallback pool) for inspiration on every new collaboration, optionally flavored by a theme (mystery, horror, romance, sci-fi, fantasy) picked alongside the story/poem choice.
- **Live updates** over Socket.IO — turns, completion responses, matches, invites, and chat all push in real time. An email nudge (rate-limited per collaboration) also lands when it's your turn, for whenever you're not actively on the site.
- **Mutual-approval completion** — a collaboration only finishes once both participants agree.
- **PDF export** of completed pieces, read as continuous prose rather than turn-by-turn, with bold/italic formatting preserved.
- **Leaderboard** — points for finishing a collaboration together, weighted by how much you wrote, with weekly, monthly, and all-time rankings, plus streaks and milestone badges to keep writers coming back.
- **Discover** — either writer can publish a completed piece to a public gallery anyone can browse, logged in or not. Publishing never needs the other writer's agreement; being credited by name is a separate, personal choice for each of you that defaults to "Anonymous collaborator."
- **Report, block, and leave** — flag a writing partner for review, block them from ever being matched with you again, or leave an active collaboration outright (freezes it for both sides without deleting anything either of you wrote). A separate, gated admin panel lets the site owner review reports (with the reported collaboration's writing and chat shown inline), ban or delete abusive accounts, and unpublish a gallery piece — an admin account can't itself Quick Match, invite, or write, on the server as well as in the UI.
- Paginated collaboration/chat history, a "your turn" count badge in the nav, and skeleton loading states throughout.

## Tech stack

**Backend:** Node.js, Express, MongoDB (Atlas) via Mongoose, Socket.IO, JWT auth, Google Gemini, Brevo, Google OAuth.
**Frontend:** React 18, Vite, React Router, Tailwind CSS, Tiptap (rich text), Framer Motion, Socket.IO client.

See [`docs/BACKEND.md`](docs/BACKEND.md) and [`docs/FRONTEND.md`](docs/FRONTEND.md) for the full architecture, design decisions, and a running log of bugs found along the way. See [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) for a prioritized list of what's deliberately left unfinished.

## Project structure

```
pairagraph/
├── client/     React + Vite frontend
├── server/     Express backend, organized by domain
│   └── src/domains/   authentication, collaboration, matchmaking,
│                       invite, ai, chat, leaderboard, moderation, admin,
│                       gallery
├── docs/       BACKEND.md, FRONTEND.md
└── .github/workflows/  CI (runs the backend and frontend test suites)
```

## Getting started

Requires Node.js 22+ and a MongoDB connection string (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works fine).

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

Copy the example env files and fill them in:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env` needs a MongoDB URI, JWT secrets, a Brevo API key + verified sender address (for verification/reset emails), a Google OAuth client ID, optionally a Gemini API key (falls back to a local keyword pool if omitted), optionally a Cloudflare Turnstile secret key (`CAPTCHA_SECRET_KEY` — registration's CAPTCHA check is bypassed entirely if this is left unset, same as the Gemini key), and optionally a Sentry DSN (`SENTRY_DSN` — error tracking is skipped entirely if unset). `client/.env` needs the API URL, the same Google OAuth client ID, the matching Turnstile site key (`VITE_CAPTCHA_SITE_KEY`), and optionally a separate Sentry DSN for the frontend project (`VITE_SENTRY_DSN`).

### 3. Run both dev servers

```bash
# in server/
npm run dev      # http://localhost:5000

# in client/
npm run dev       # http://localhost:5173
```

## Scripts

| Location | Command | What it does |
|---|---|---|
| `server/` | `npm run dev` | Start the API with nodemon (auto-restart) |
| `server/` | `npm start` | Start the API without nodemon |
| `server/` | `npm test` | Run the backend test suite (`node:test`) |
| `client/` | `npm run dev` | Start the Vite dev server |
| `client/` | `npm run build` | Production build |
| `client/` | `npm run preview` | Preview the production build locally |
| `client/` | `npm test` | Run the frontend test suite (Vitest + React Testing Library) |

## Testing

The backend has an automated test suite (`server/npm test`, 121 tests) covering auth, the turn-based writing rules, matchmaking, invites, the leaderboard, report/block moderation, admin user management, and the public gallery — it runs in CI on every push and pull request (see `.github/workflows/server-tests.yml`). The frontend has a first slice of automated tests (`client/npm test`, 15 tests — session restore, the CAPTCHA single-use-token regression, and the core writing-loop UI), also in CI (`.github/workflows/client-tests.yml`); it's not yet comprehensive — see `docs/FRONTEND.md` for what's covered and what isn't.

## License

MIT — see [`LICENSE`](LICENSE).
