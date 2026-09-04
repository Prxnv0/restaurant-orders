# Test Suite — Milestone 10

This directory holds integration tests that run against a real PostgreSQL
database using Supertest + Vitest. The tests cover all 10 application goals
with real HTTP requests, not mocked units.

## Setup (run once before `npm test`)

### 1. Set DATABASE_URL

Add `DATABASE_URL` to `backend/.env` pointing to a **dedicated test database**
(not your dev or production DB).

```env
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=disable"
```

If you only have one Supabase project, create a separate database in it for
testing, or use a local PostgreSQL instance.

### 2. Run migrations against the test DB

```bash
cd backend
npx prisma migrate deploy
```

### 3. Seed the test DB

```bash
node prisma/seed.js
```

### 4. Run the test suite

```bash
cd backend
npm test
```

All 13 test suites run serially in a single fork to avoid connection
exhaustion on free-tier Supabase (max 60 connections). Expected runtime: <30 s.

### 5. Reset test DB when done

To wipe the test database between runs (optional, but keeps the DB clean):

```bash
npx prisma migrate reset --preview-feature --skip-seed
```

Or drop the test DB entirely and re-run steps 2-4.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Error: No Database Connection` | Set `DATABASE_URL` in `backend/.env` |
| `PrismaClientInitializationError` | Run `npx prisma migrate deploy` and `node prisma/seed.js` |
| Connection exhaustion | Ensure `singleFork: true` in `vitest.config.js` — never run tests in parallel |
| Tests pass but alerts are wrong | Seed data uses real clock; alerts require the test DB's `now` to be ≥ 30 min after the seed orders' `createdAt` |

## Test Suites

| # | File | Goal tested |
|---|------|-------------|
| 1 | `01-login.test.js` | 1 — Login |
| 2 | `02-auth-me.test.js` | 1 — GET /me |
| 3 | `03-authz-matrix.test.js` | 1 — Role-based access |
| 4 | `04-state-machine.test.js` | 4 — Status transitions |
| 5 | `05-cancellation-cutoff.test.js` | 4 — Cancellation rules |
| 6 | `06-void-line.test.js` | 4 — Line void |
| 7 | `07-historical-pricing.test.js` | 3 — Price snapshots |
| 8 | `08-immutable-history.test.js` | 9 — No edit/delete routes |
| 9 | `09-bulk-update.test.js` | 7 — Per-item bulk results |
| 10 | `10-order-search.test.js` | 6 — Search/filter/sort/page |
| 11 | `11-alerts.test.js` | 10 — Alert lifecycle |
| 12 | `12-dashboard.test.js` | 8 — Dashboard metrics |
| 13 | `13-csv-export.test.js` | 7 — CSV format |
