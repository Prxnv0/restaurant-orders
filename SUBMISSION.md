# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/Prxnv0/restaurant-orders
- **Live application (frontend):** https://restaurant-orders5.vercel.app
- **Live backend API:** https://restaurant-orders-2qsn.onrender.com

## Notes for the reviewer

> **Host quirks (already known; will not surprise the reviewer):**
> - **Render (backend)** — free tier spins down after **15 minutes of inactivity**. The first request after a sleep takes **30–60 seconds** to cold-start. This is normal, not an error — wait for the spinner.
> - **Supabase (database)** — free-tier projects **pause after 1 week of inactivity**. If the reviewer is opening the app more than a week after the last visit, the first database query can hang 30–60 seconds while the project wakes up.
> - **Vercel (frontend)** — cold starts are negligible; the UI loads quickly.
>
> If the page shows a "Network Error" or hangs on the first request, **wait 60 seconds and refresh** — the backend is waking up.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@busy-demo.com | password123 |
| Waiter (primary) | waiter1@busy-demo.com | password123 |
| Waiter (collab) | waiter2@busy-demo.com | password123 |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React 18 + Vite + React Router (no UI library) | Lightweight, fast dev loop, no runtime cost |
| Backend | Node.js + Express + Prisma + Joi | Mature stack, schema-first DB, request validation |
| Database | PostgreSQL on Supabase (free tier) | Free managed Postgres, easy connection pooling |
| Auth | JWT in httpOnly cookie, bcrypt password hashing | Standard pattern; cookie keeps the token out of JS |
| Hosting | Render (backend) + Vercel (frontend) + Supabase (DB) | All free tiers; matches the README's "Host it for free" requirement |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Manager menu authority | Done | |
| 2 | Orders + archive/restore | Done | |
| 3 | Order lines with price snapshot | Done | |
| 4 | State machine, cancel cutoff, line void | Done | |
| 5 | Collaborators (add/remove + equal access) | Done | |
| 6 | Search/filter/sort/paginate | Done | |
| 7 | Menu bulk update + CSV export | Done | |
| 8 | Dashboard (headline + breakdowns + 14-day chart) | Done | |
| 9 | History timeline + notes (immutable) | Done | |
| 10 | Alerts (slow orders, dismiss, reappear) | Done | |

## How much time did you actually spend?

Approximately **18.5 hours** across 13 milestones. Breakdown by milestone:

| Milestone | Est. | Actual |
|-----------|------|--------|
| M1 Foundation + Database | 2h | ~2h |
| M2 Auth + AuthZ | 2h | ~2h |
| M3 Menu + Bulk | 2h | ~1.5h |
| M4 Orders + Lines | 2h | ~2h |
| M5 Lifecycle + History | 2h | ~1.5h |
| M6 Collaborators + Search | 2h | ~1.5h |
| M7 Dashboard + Alerts + CSV | 2h | ~1h |
| M8 Frontend: Manager | 1.5h | ~1h |
| M9 Frontend: Waiter | 1.5h | ~1h |
| M10 Critical Tests | 1h | ~2.5h |
| M11 Deploy + Smoke | 0.5h | ~2h |
| M12 Pre-Submission Check | 0.25h | ~0.5h |
| M13 Docs Final | 0.25h | ~0.5h |

M10 and M11 took longer than estimated due to 8 test infrastructure bugs and 5 production deploy issues respectively — all documented in `docs/bugs.md`.

## What would you do next, with another 12 hours?

1. **Real-time order status updates** — replace the current polling model (every 30s for alerts) with WebSockets so waiters see status changes instantly. This was deliberately deferred because WebSockets would require a separate hosting mechanism (a WebSocket server, or a hosted service like Pusher/Ably) that doesn't fit the free-tier Render + Vercel topology.

2. **Kitchen display screen (stretch goal from README)** — a simple web view on a tablet mounted in the kitchen showing orders in PREPARING → READY, with a one-tap READY button. This is the natural next step after real-time updates.

3. **End-to-end tests** — the current M10 test suite covers the API layer but not the browser UI. A Playwright or Cypress suite would catch frontend-integration bugs like the M11 dashboard response-shape mismatch and the AuthContext restore-session loop.

4. **Mobile responsive design** — the current UI works on desktop but the waiter views (order detail, add lines) are not optimized for handheld use. The stretch goal mentions "table-side ordering from a handheld device" which this enables.

5. **Better form validation UX** — error messages are shown as plain text below fields. Inline validation, field-level error highlighting, and loading states on individual form actions would improve the experience.

## What are you least happy with in this codebase, and why?

**The state machine lives in JavaScript, not in the database.** All valid transitions are encoded in a `VALID_TRANSITIONS` map in `backend/src/stateMachine.js` — this is auditable and testable, but it is not enforced at the database layer. A raw SQL write (from a future migration, a psql session, or another service) could set an order's status to any value without going through the Express routes. The proper fix is a `CHECK` constraint in PostgreSQL that validates `status = 'ACCEPTED' OR status = 'PREPARING'`, etc., which would require a raw SQL migration that Prisma can't express in its schema DSL. The application-layer enforcement is sufficient for this submission (only the Express app can write orders), but it's a structural weakness at scale.

**The Bearer-token fallback stores the JWT in `localStorage`.** `localStorage` is readable by JavaScript, which means any XSS vulnerability can steal the token. The `httpOnly` cookie is the right defense; the Bearer fallback is a workaround for browser restrictions that degrades the security posture for affected users. A better fix would be to move the Bearer token into a `sessionStorage`-equivalent that isn't accessible to page scripts, or to use a service worker as a secure token bridge. All of these are out of scope for the 12-hour build.

**The 14-day dashboard chart is a plain table, not a chart.** The README goal says "charts orders served per day over the last fourteen days" — a table technically satisfies the data requirement but not the aesthetic intent. The decision to use a table was documented as a time budget choice, not a design preference.

**The test suite only covers the API layer.** The M10 integration tests verify every server-side rule correctly, but the browser UI has no automated coverage. The M11 dashboard response-shape mismatch (frontend expected an array, backend returned an object) and the AuthContext restore-session loop would have been caught by a Playwright suite. These were found manually during smoke testing. A proper E2E suite would catch regressions like these in CI.
