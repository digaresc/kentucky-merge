# AGENTS.md: notes for AI coding assistants

You're working on **Kentucky Merge**, a neon projector dashboard for hackathons: one ASCII horse per
participant, and every PR merged into the target repo during the race moves that horse one step.
It's **read-only**: it never writes to GitHub, and it has no database.

## Commands

```bash
npm install
npm run dev        # with no TARGET_REPO set this runs a demo race with fake hackers
npm run build      # must pass before any PR
npx tsc --noEmit
```

Visual checks: `http://localhost:3000/?demo=1&start=<ISO time ~55 min ago>` shows a mid-race demo.
Design for a **1920×1080 projector** first; the layout must also stay usable below 900px wide.

## Map

| Path | What |
| --- | --- |
| `components/Hippodrome.tsx` | The whole projector UI (client): countdown, lanes, leaderboard, review panel, feed, ticker. Polls `/api/race` every 8 s. |
| `components/ascii.ts` | Horse frames and the knight's helm frames. Keep every frame the same width and height so nothing jitters. |
| `lib/race.ts` | Builds the race state from GitHub (cached; longer cache without a token) and the demo race. |
| `lib/reviewer.ts` | Optional reviewer integration: decodes `<!-- nitpick:… -->` markers, horse names, the knight's name and orders. |
| `lib/rules.ts` | Env-driven settings: title, ticker, track length, excluded logins, race window. |
| `lib/github.ts` | Read-only REST client. |
| `app/api/race` | JSON state for the projector; also pings `REVIEWER_TICK_URL` (throttled) to keep the reviewer's clock running. |
| `scripts/` | Host scripts: `start-race.sh`, `set.sh`, `deploy.sh`. |

## Rules that must not break

1. **Read-only.** Never add code that writes to GitHub; a read-only token must always be enough.
2. **Works without a reviewer.** With no `REVIEWER_LOGIN`, the panel is a plain "LATEST MERGE" card,
   with no knight art, demands or hold labels. Test both modes.
3. **The projector has no knobs in production.** `?start=` and `?demo=1` only work off production
   (`VERCEL_ENV !== "production"`). Don't add buttons, query flags or endpoints that change the race.
4. **The page renders per request** (`export const dynamic = "force-dynamic"` in `app/page.tsx`). Without it,
   production is prerendered at build time and the projector starts from a stale or demo snapshot.
5. **Marker contract.** Only trust markers written by `REVIEWER_LOGIN`. Read both the `nitpick:` and the legacy `monster:` prefix.
   Fields are additive, so tolerate missing ones (old reviews have `complaints`/`verdict` instead of `demands`).
6. **Horse names** (`horseName`) must stay byte-for-byte identical to
   [Sir Nitpicksalot](https://github.com/digaresc/sir-nitpicksalot)'s `lib/knight.ts`.
7. **Rate limits.** A room full of phones may open the dashboard. Keep the server-side cache and don't add
   per-PR API calls to the polling path.
8. **Never commit secrets.** `.env*` (except `.env.example`) and `.vercel/` are gitignored. Keep it that way.

## Style

Cyberpunk circus: neon on near-black, Monoton for the title, VT323 for numbers, JetBrains Mono for text,
scanlines on top. Colors are CSS variables in `app/globals.css`. Any animation that moves a horse uses
`steps()`: the horses trot, they don't glide.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
