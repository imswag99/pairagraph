# Pairagraph

A quiet page for two, written one turn at a time.

Pairagraph is a turn-based collaborative writing app: two people are paired up (via quick match or an invite link) to write a short story or poem together, one line or paragraph at a time, with AI-suggested keywords for inspiration, a side chat, and a completion flow that needs both writers to agree before a piece is done.

## Features

- **Email/password and Google sign-in**, with email verification, password reset, and account management (change display name/password, delete account).
- **Turn-based writing** — one paragraph per turn for stories, one line per turn for poems, enforced both in the editor and on the server.
- **Quick Match** (paired with a random waiting partner) and **invite links** as the two ways to start a collaboration.
- **AI-generated keywords** (Google Gemini, with a local fallback pool) for inspiration on every new collaboration.
- **Live updates** over Socket.IO — turns, completion responses, matches, invites, and chat all push in real time.
- **Mutual-approval completion** — a collaboration only finishes once both participants agree.
- **PDF export** of completed pieces, read as continuous prose rather than turn-by-turn, with bold/italic formatting preserved.
- **Leaderboard** — points for finishing a collaboration together, with weekly and all-time rankings.
- Paginated collaboration/chat history, a "your turn" count badge in the nav, and skeleton loading states throughout.

## Tech stack

**Backend:** Node.js, Express, MongoDB (Atlas) via Mongoose, Socket.IO, JWT auth, Google Gemini, Nodemailer, Google OAuth.
**Frontend:** React 18, Vite, React Router, Tailwind CSS, Tiptap (rich text), Framer Motion, Socket.IO client.

See [`docs/BACKEND.md`](docs/BACKEND.md) and [`docs/FRONTEND.md`](docs/FRONTEND.md) for the full architecture, design decisions, and a running log of bugs found along the way. See [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) for a prioritized list of what's deliberately left unfinished.

## Project structure

```
pairagraph/
├── client/     React + Vite frontend
├── server/     Express backend, organized by domain
│   └── src/domains/   authentication, collaboration, matchmaking,
│                       invite, ai, chat, leaderboard
├── docs/       BACKEND.md, FRONTEND.md
└── .github/workflows/  CI (runs the backend test suite)
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

`server/.env` needs a MongoDB URI, JWT secrets, SMTP credentials (for verification/reset emails), a Google OAuth client ID, and optionally a Gemini API key (falls back to a local keyword pool if omitted). `client/.env` needs the API URL and the same Google OAuth client ID.

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

## Testing

The backend has an automated test suite (`server/npm test`) covering auth, the turn-based writing rules, matchmaking, invites, and the leaderboard — it runs in CI on every push and pull request (see `.github/workflows/server-tests.yml`). The frontend does not yet have automated tests; see `docs/FRONTEND.md` for details and known gaps.

## License

MIT — see [`LICENSE`](LICENSE).
