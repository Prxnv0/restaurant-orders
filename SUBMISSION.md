# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** <public repo URL>
- **Live application:** <deployed URL — fill in after M11 deploy per DEPLOY.md>

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

(Filled in after M13 final pass — see `docs/plan.md` Estimate vs Actual table.)

## What would you do next, with another 12 hours?

(To be filled in.)

## What are you least happy with in this codebase, and why?

(To be filled in.)
