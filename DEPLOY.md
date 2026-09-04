# Deployment Runbook

This is the ordered set of steps to take the restaurant-orders app from a clean
local checkout to a live public URL. Follow the steps in order — each step
gives the next step the value it needs.

Estimated wall time: **~30–45 minutes**, mostly waiting for cloud consoles.

> **What is in the repo already**
> - `render.yaml` — Render blueprint for the backend Web Service
> - `vercel.json` — Vercel config for the frontend (Vite, SPA rewrites)
> - `backend/.env.example` and `frontend/.env.example` — env var reference
> - `docs/plan.md` M11 — the milestone this runbook implements
>
> **What is not in the repo (deliberately)**
> - Any real connection string, JWT secret, or service URL — those go in cloud dashboards only

---

## Step 1 — Create the Supabase production project

1. Go to <https://supabase.com> → **New project**.
2. Pick a region close to where you expect the reviewer to be (defaults are fine).
3. Save the **database password** somewhere safe — you will need it again.
4. Wait for the project to finish provisioning (~1–2 minutes).
5. Go to **Project Settings → Database → Connection Info**. Copy:
   - **Transaction mode** connection string (port 6543, ends in `?pgbouncer=true&connection_limit=1`)
     → this is `DATABASE_URL`
   - **Session mode** connection string (port 5432, no `pgbouncer`)
     → this is `DIRECT_URL`
6. **Test it works locally before deploying**:
   ```bash
   cd backend
   cp .env.example .env
   # paste the two Supabase connection strings into .env
   npm install
   npx prisma migrate deploy
   node prisma/seed.js
   ```
   The seed should create `manager@demo.com`, `waiter1@demo.com`,
   `waiter2@demo.com` (all `password123`), 6 menu items, and 7 demo orders.

> **Note.** Supabase free-tier projects pause after 1 week of inactivity. If your reviewer takes longer to look at it, the first request after pause can take 30–60 seconds to wake the DB.

---

## Step 2 — Deploy the backend to Render

1. Go to <https://render.com> → **New +** → **Blueprint**.
2. Connect the GitHub repo (`Prxnv0/restaurant-orders`).
3. Render reads `render.yaml` at the repo root and shows one service:
   `restaurant-orders-api` (Node, rootDir `backend/`).
4. Click **Apply**. Render starts the first build, but it will **fail on the
   `prisma generate` step** unless DATABASE_URL is set — that's expected.
5. Open the service → **Environment** → **Add Environment Variable**:
   - `DATABASE_URL` = the Transaction-mode connection string from Step 1
   - `DIRECT_URL`   = the Session-mode connection string from Step 1
   - `JWT_SECRET`   = run `openssl rand -base64 32` and paste the output
   - `ALERT_THRESHOLD_MINUTES` = `30` (matches the seed data)
   - `APP_TIMEZONE` = `UTC` (or your real timezone, e.g. `America/New_York`)
   - `FRONTEND_ORIGIN` = leave as a placeholder for now; we set this in Step 4
6. **Manual Deploy** → **Deploy latest commit**. The build now succeeds.
7. Note the service URL: `https://restaurant-orders-api.onrender.com` (Render
   will show it on the service page).
8. Smoke test the health endpoint:
   ```bash
   curl https://restaurant-orders-api.onrender.com/api/health
   # → {"status":"ok","time":"..."}
   ```

> **Note.** Render free tier spins down after 15 minutes of inactivity. The first request after a sleep takes 30–60 seconds — this is normal, not an error.

---

## Step 3 — Deploy the frontend to Vercel

1. Go to <https://vercel.com> → **Add New → Project** → import the same GitHub repo.
2. Vercel reads `vercel.json` and infers:
   - Root directory: `frontend/`
   - Build command: `npm install && npm run build`
   - Output directory: `dist`
3. Before clicking **Deploy**, open **Environment Variables** and add:
   - `VITE_API_BASE_URL` = the Render URL from Step 2
     (e.g. `https://restaurant-orders-api.onrender.com`, no trailing slash)
4. Click **Deploy**. The first build takes ~1 minute.
5. Note the production URL: `https://restaurant-orders.vercel.app` (Vercel will show it).

---

## Step 4 — Wire CORS back to the backend

1. Go back to **Render** → `restaurant-orders-api` → **Environment**.
2. Set `FRONTEND_ORIGIN` = the Vercel URL from Step 3.
3. **Manual Deploy** → **Deploy latest commit** so the new CORS value is picked up.

---

## Step 5 — Smoke test all 10 goals

Open the Vercel URL. Demo credentials:

| Role           | Email                     | Password    |
|----------------|---------------------------|-------------|
| Manager        | manager@busy-demo.com     | password123 |
| Waiter (primary) | waiter1@busy-demo.com   | password123 |
| Waiter (collab)  | waiter2@busy-demo.com   | password123 |

Walk through every goal in the README and confirm it works end-to-end on the live URL:

| # | Goal | How to verify |
|---|------|---------------|
| 1 | Manager menu authority | Sign in as `waiter1` → Menu link absent. Sign in as `manager` → add, edit, archive, bulk-update a menu item |
| 2 | Create orders, archive/restore | Sign in as `waiter1` → New Order → table 12 → confirm. Open order detail → Archive → Restore |
| 3 | Order lines with snapshot pricing | Open an order → Add a line → confirm total = `qty × price` of the line at time of add |
| 4 | State machine, cancel cutoff, line void | Move an order through PLACED → ACCEPTED → PREPARING → READY → SERVED. Try to CANCEL while PREPARING → expect 409. Void a line on an open order with a reason |
| 5 | Collaborators | As `waiter1`, add `waiter2` as collaborator on an order. Sign in as `waiter2` → confirm order is visible |
| 6 | Search/filter/sort/paginate | As `manager`, filter the orders list by status, by waiter, by date. Sort by table, status, placed time. Confirm total count + page contents |
| 7 | Menu bulk update + CSV | As `manager`, multi-select 3 menu items and bulk-update price. Click **Export today's orders** → CSV downloads with one row per line + totals |
| 8 | Dashboard | As `manager`, open `/dashboard`. Verify headline numbers, status/waiter breakdowns, 14-day chart |
| 9 | History + notes | Open any order → confirm timeline shows every status change, line added/voided, collaborator add/remove. Add a note |
| 10 | Alerts | As `manager`, open `/alerts`. The seed contains one order > 30 min old → expect one alert with a Dismiss button. Dismiss → alert disappears. (To re-test the reappear rule, you can change `ALERT_THRESHOLD_MINUTES` lower in Render env vars.) |

---

## Step 6 — Fill in `SUBMISSION.md`

After smoke-testing, edit `SUBMISSION.md` at the repo root with:

- `## Links` — the live Vercel URL and the GitHub repo URL
- `## Notes for the reviewer` — Render cold start (30–60s after 15 min idle)
  and Supabase pause (after 1 week idle)
- `## Demo credentials` — the 3 demo accounts above
- `## Stack` — Express + Prisma + PostgreSQL (Supabase) backend on Render,
  React + Vite frontend on Vercel

Commit and push. Then continue to M12 (pre-submission verification).

---

## What if a step fails

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `prisma generate` fails on Render | `DATABASE_URL` not set in Render env | Add it (Step 2.5) and redeploy |
| `prisma migrate deploy` fails locally | Wrong `DIRECT_URL` (you used transaction-mode) | Re-copy the **Session mode** string into `DIRECT_URL` |
| Frontend shows "Network Error" | `VITE_API_BASE_URL` not set or wrong on Vercel | Update the env var in Vercel → Project Settings → Environment Variables, then redeploy |
| Login fails with CORS error in browser | `FRONTEND_ORIGIN` on Render does not match the Vercel URL | Update it and redeploy Render |
| First request hangs 30–60s | Render free-tier cold start | This is normal — wait it out. Note it in `SUBMISSION.md` |
| Vercel preview shows 404 on refresh | SPA fallback missing | `vercel.json` has the `rewrites` rule — confirm it was committed |
| Seed fails on Supabase | Connection pooler rejecting too many parallel queries | Add `?pgbouncer=true&connection_limit=1` to `DATABASE_URL` |

---

## Local development after deployment

The local `.env` is unchanged from before M11. The cloud `DATABASE_URL` and
`DIRECT_URL` are separate from your dev project's Supabase database. To
work locally:

```bash
cd backend
# .env still points to your dev Supabase project (or local Postgres)
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so you do not
need to set `VITE_API_BASE_URL` locally.
