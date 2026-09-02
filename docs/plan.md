# Plan

Answer each of these, in your own words.

- How did you break the work into sessions?
- What order did you build in, and why that order?
- What did you estimate versus what it actually took?
- What did you cut when you ran short?

---

## Session Breakdown (Actual)

The work is divided into 13 milestones, each scoped to a coherent set of requirements and tracked here as they are completed. Milestones 1 and 2 are complete. Milestone 3 is next.

### Milestone 1 — Foundation + Database ✅ COMPLETE
**Requirements satisfied:** All 10 goals depend on the schema; this milestone establishes the data model and project skeleton that every feature builds on.

**Delivered:**
- Backend: Express skeleton, Prisma client singleton, `.env.example`
- Frontend: Vite + React + Router + CSS skeleton
- Database: Full Prisma schema (9 tables) with all indexes, enums
- Seed script: 3 demo users (1 manager, 2 waiters), 6 menu items, 7 orders in every status, order lines with price snapshots, a voided line with reason, a collaborator row, history entries, notes, alerts, dismissals
- Documentation: `docs/schema.md`, `docs/architecture.md`, `docs/plan.md` updated to "Implemented (skeleton)" status; initial 8 planning-phase decisions; planning-phase AI prompts

### Milestone 2 — Authentication + Authorization ✅ COMPLETE
**Requirements satisfied:**
- **Goal 1** (full): email + password sign-in, two roles (MANAGER, WAITER), manager menu authority, server-enforced role boundaries.

**Delivered:**
- Backend: `auth.js` (login/logout/me), `auth.js` middleware (JWT cookie verification), `authorize.js` (role gate), `resourceOwner.js` (order-access check), `AppError` class + global error handler
- Frontend: `api.js` (fetch wrapper with credentials), `AuthContext` (login/logout/restore session), `ProtectedRoute` (auth + role guard), `LoginPage`, real router with role-scoped routes
- Decisions 9–13 (JS-vs-TS, CommonJS-vs-ESM, idempotent seed, `served_at` column, Prisma enums) added

### Milestone 3 — Menu Management + Bulk Update (est. 2 hours) ✅ COMPLETE
**Requirements satisfied:**
- **Goal 1** (menu authority): server-enforced manager-only for menu CRUD
- **Goal 7** (partial): single-item CRUD + bulk-update endpoint with per-item success/reject

**Delivered:**
- Backend: `routes/menu.js` with 5 endpoints (GET list with `?include=available|all|archived`, GET one, POST, PATCH with archive toggle, POST `/bulk-update`)
- Backend: `validators/menu.js` with three Joi schemas (`createMenuItem`, `updateMenuItem`, `bulkUpdate`); `validators/index.js` barrel
- Backend: `tests/menu-validator.test.js` (18 cases covering happy path + every rejection rule); `vitest.config.js`; `tests/setup.js`
- Frontend: `api.js` menu helpers (`fetchMenu`, `createMenuItem`, `updateMenuItem`, `bulkUpdateMenuItems`); `MenuPage.jsx` with full manager UI (add, edit, archive, multi-select bulk price/availability with per-item result display)
- Decisions 14 (per-item try/catch for bulk-update) added

**Notes:**
- Database-touching integration tests for menu routes are deferred to M10 ("Critical Automated Tests"), where the full Supertest + test-database harness is set up. M3 ships validator-level coverage only.

### Milestone 4 — Orders + Order Lines (est. 2 hours) ✅ COMPLETE
**Requirements satisfied:**
- **Goal 2** (full): create orders, table number, primary waiter, archive/restore, default queue excludes archived
- **Goal 3** (full): order lines with menu item + quantity + special instructions; price snapshot at time of add; total computed by server

**Delivered:**
- Backend: `routes/orders.js` with 6 endpoints (POST /api/orders, GET /api/orders, GET /api/orders/:id, POST /api/orders/:id/lines, POST /api/orders/:id/archive, POST /api/orders/:id/restore)
- Backend: `validators/orders.js` with four Joi schemas (`createOrder`, `addLine`, `listOrders`, `voidLine`); validator barrel updated
- Backend: `tests/orders-validator.test.js` (25 test cases covering happy path + every rejection rule)
- Frontend: `api.js` order helpers (`fetchOrders`, `fetchOrder`, `createOrder`, `addOrderLine`, `archiveOrder`, `restoreOrder`)
- Frontend: `NewOrderPage.jsx` (create-order form with table number)
- Frontend: `OrdersPage.jsx` (orders list with search/filter/pagination, new-order button)
- Frontend: `OrderDetailPage.jsx` (order detail with lines table, running total, add-line form)
- Frontend: `App.jsx` updated (nav links with role-based menu items, logout button, /orders/new route)
- Frontend: `styles.css` updated with status badge styles
- Decisions 16 (total computation strategy) and 17 (line-add blocking rule) added

**Notes:**
- `GET /api/orders` was also implemented in M4 scope (needed for OrdersPage) — it was listed under M6 in the original plan but is required by the M4 frontend
- The waiter filter on GET /api/orders is implemented but only exposed to managers in the UI (M6 will surface it in the frontend filter controls)

### Milestone 5 — Lifecycle, Void, History (est. 2 hours) ✅ COMPLETE
**Requirements satisfied:**
- **Goal 4** (full): state machine Placed→Accepted→Preparing→Ready→Served, Cancelled (only while Placed/Accepted), line Void with required reason (only while order open), rejection of illegal moves with explanatory message
- **Goal 9** (full): timeline of every status change (old, new, actor), every line added/voided with reason, every note; immutable (no UPDATE/DELETE routes defined)

**Delivered:**
- Backend: `src/stateMachine.js` (new module) — `VALID_TRANSITIONS` map, `validNextStatuses`, `canTransition`, `assertValidTransition`; throws `AppError` 409 with `code: INVALID_TRANSITION` and `details: { current_status, attempted_status, valid_next_statuses, reason }` and a human-readable message
- Backend: `src/utils/errors.js` — added `withDetails(details)` chaining helper on `AppError` so error responses can carry structured payloads
- Backend: `src/routes/orders.js` — added 5 new endpoints:
  - `PATCH /api/orders/:id/status` — state-machine-validated; sets `served_at` on SERVED; resolves any active alert on READY/SERVED/CANCELLED; rejects on archived orders
  - `POST /api/orders/:id/lines/:lineId/void` — non-empty reason required; blocked when order is SERVED or CANCELLED; blocked when line is already VOID
  - `GET /api/orders/:id/history` — timeline ordered ascending by `created_at`, includes actor name
  - `GET /api/orders/:id/notes` — list, newest first
  - `POST /api/orders/:id/notes` — append-only; no edit/delete routes defined
- Backend: `validators/orders.js` — added `changeStatus` and `addNote` Joi schemas
- Backend: `validators/index.js` — barrel updated
- Tests: `tests/stateMachine.test.js` (40 cases — every valid transition, every illegal transition with reason-classification assertions, terminal-state checks, unknown-status checks, error-shape checks)
- Tests: `tests/orders-validator.test.js` — added 10 cases for `changeStatus` and `addNote` (now 35 total)
- **All 93 tests pass** (40 state machine + 35 orders validator + 18 menu validator)
- Decisions 18 and 19 added

**Notes:**
- `voidLine` validator was already defined in M4 (used at the time by a planned `POST /lines/:lineId/void` route that was deferred to M5). The void route is implemented here.
- The `served_at` column (Decision 12) and the `eventType` enum (Decision 13) were already in place from M1 — M5 just makes use of them.
- The state machine encodes the *rule* in code (one constant `VALID_TRANSITIONS`) rather than scattering `if (currentStatus === ...)` checks across route handlers. All illegal moves throw the same `AppError` shape, so the error response is uniform.
- The `AppError` 409 response now includes a `details` object so the client can present a helpful message and know which transitions are valid next. The `reason` field categorizes the violation (`cancel_too_late`, `skip_states`, `backward_transition`, `terminal_status`, `no_op`, `illegal_transition`).
- Route-level integration tests (with a real DB) are deferred to M10. Validator + state-machine unit tests give the rule coverage the M5 spec implies.

### Milestone 6 — Collaborators + Order Search (est. 2 hours) ⏳ PENDING
**Requirements satisfied:**
- **Goal 5** (full): primary waiter, add/remove collaborators, collaborator = equal access, "one list" of primary + collab orders for each waiter
- **Goal 6** (full): text search on table number, status/waiter/date filters, sort by placed time/status/table, pagination with total match count, all server-side

**Backend scope:**
- `POST /api/orders/:id/collaborators`: primary or manager only; add a waiter not already on the order; history entry
- `DELETE /api/orders/:id/collaborators/:waiterId`: primary or manager only; history entry
- `GET /api/orders`: query params `search` (table_number ILIKE), `status` (single or array), `waiter` (user id or email), `date` (created_at day), `sort` (placed_at|status|table_number, asc|desc), `page`, `limit`; scope by role — manager sees all, waiter sees only primary or collaborator; default excludes archived; return `{ orders, total }`
- Decisions to record: how to combine filters, default sort and limit

### Milestone 7 — Dashboard + Alerts + CSV (est. 2 hours) ⏳ PENDING
**Requirements satisfied:**
- **Goal 7** (CSV): export today's orders with lines, total, status
- **Goal 8** (full): headline numbers (open orders, placed today, served today, revenue today), status breakdown, waiter breakdown, 14-day orders-served chart
- **Goal 10** (full): slow-order alerts (threshold-based), appear in alerts area, dismissable, reappear after further threshold period, count in nav

**Backend scope:**
- `GET /api/dashboard` (manager only): returns `{ open_orders, placed_today, served_today, revenue_today, status_breakdown, waiter_breakdown, chart_14d }` with definitions as in design refinement §4. Revenue counts ACTIVE lines only. Chart is per-day served count + revenue with zero-fill.
- `GET /api/alerts`: returns active alerts (open orders past threshold, no recent dismissal within threshold); manager sees all, waiter sees their orders; includes `count` for nav badge
- `POST /api/alerts/:id/dismiss`: insert `AlertDismissal` row; require order access
- `GET /api/export/orders/today` (manager only): CSV of orders created today (any status, includes archived), one row per order line, columns defined in design refinement §5, filename `orders-YYYY-MM-DD.csv`, `Content-Type: text/csv`
- Decisions to record: alert reappearance query shape, CSV column final list

### Milestone 8 — Frontend: Manager Views (est. 1.5 hours) ⏳ PENDING
**Requirements satisfied:**
- **Goal 1** (UI): menu management is visible only to managers
- **Goal 7** (UI): manager menu page with multi-select UI for bulk updates (checkboxes + apply-price/apply-availability)
- **Goal 8** (UI): dashboard rendering headline numbers, status/waiter breakdowns, 14-day chart
- **Goal 10** (UI): alerts page with active alerts list + dismiss button + nav badge with count
- **Goal 7** (UI): CSV download button

**Frontend scope:**
- `MenuPage`: list, add, edit, archive; multi-select with two bulk actions (set price, set availability) showing per-item success/reject
- `DashboardPage`: render all dashboard JSON fields. 14-day chart rendered as a labeled table (no charting library — see design decision recorded in M7)
- `AlertsPage`: list of active alerts with order id, table, age in minutes, dismiss button
- Top-nav: show "Dashboard", "Menu", "Alerts", "Orders" links for managers; nav badge shows alert count
- **For managers, the default landing view (`/`) redirects to `/dashboard`** (per README Goal 8 "A landing view")
- Decisions to record: bulk-update UI shape, manager landing route

### Milestone 9 — Frontend: Waiter Views (est. 1.5 hours) ⏳ PENDING
**Requirements satisfied:**
- **Goal 2** (UI): create-order form, list of own + collab orders
- **Goal 3** (UI): order detail with lines and running total
- **Goal 4** (UI): status change controls, line voiding with reason prompt
- **Goal 5** (UI): add/remove collaborators
- **Goal 6** (UI): search/filter/sort/paginate the orders list
- **Goal 9** (UI): history timeline panel on order detail

**Frontend scope:**
- `OrdersPage`: list with search input, status filter dropdown, waiter filter, date filter, sort selector, pagination, total match count
- `OrderDetailPage`: header (table, status, primary waiter, collaborator list), lines table with running total, void line button + reason modal, status-change buttons, history timeline, notes panel, add-note form, add-collaborator form
- `NewOrderPage` (or modal): create order with table number
- `OrdersListCreate` button visible to both roles
- For waiters, the default landing view (`/`) redirects to `/orders`
- Decisions to record: void-reason modal pattern, how to render the timeline

### Milestone 10 — Critical Automated Tests (est. 1 hour) ⏳ PENDING
**Purpose:** Verify the server-side rules the README explicitly requires, **before** deployment. A deployed app that breaks the rules is worse than an undeployed app — testing before deploy prevents embarrassing public bugs.

**Test stack:** Vitest + Supertest against a real PostgreSQL test database (Supabase dev project; migrations + seed run before tests, dropped after).

**Test checklist (one suite per row, README requirement in parentheses):**

| # | Test | README target |
|---|------|---------------|
| 1 | Login: valid creds return 200 + user; invalid returns 401; missing fields return 400 | Goal 1 |
| 2 | `GET /me` with no cookie returns 401; with valid cookie returns 200 + user | Goal 1 |
| 3 | AuthZ matrix: every protected route, four roles (manager, primary waiter, collaborator, unrelated waiter) — assert the correct 200/403/404/409 per the matrix in design refinement §1 | Goal 1 |
| 4 | Order state machine: walk every valid transition, assert 200 + status change + history entry; attempt every invalid transition including PREPARING→CANCELLED, PLACED→READY (skip), backward moves, post-terminal moves — assert 409 with `INVALID_TRANSITION` and human message | Goal 4 |
| 5 | Cancellation cutoff: cancel while PLACED succeeds, while ACCEPTED succeeds, while PREPARING returns 409 with explanatory message | Goal 4 |
| 6 | Line void: succeed with reason; reject when reason missing (400); reject when order is SERVED or CANCELLED (409); reject when line is already VOID | Goal 4 |
| 7 | Historical pricing: create line, change menu price, fetch order, assert line total reflects snapshot not current price | Goal 3 |
| 8 | Immutable history: `PATCH /history/:entryId`, `DELETE /history/:entryId`, `PUT /notes/:noteId`, `DELETE /notes/:noteId` all return 405 or 404 — no such routes exist | Goal 9 |
| 9 | Bulk update: submit 3 items where one has negative price, assert response shows 2 succeeded and 1 rejected with reason | Goal 7 |
| 10 | Order search/filter/sort/pagination: query with each filter, each sort direction, page=2 with limit=5, assert total + page contents; manager vs waiter scope; archived excluded from default | Goal 6 |
| 11 | Alerts: order > threshold shows in alerts; dismiss removes it; advance clock past threshold; it reappears; transition to READY/SERVED/CANCELLED removes it permanently | Goal 10 |
| 12 | Dashboard: each metric against seed data; revenue counts ACTIVE lines only; status and waiter breakdowns correct; 14-day chart has 14 entries with zero-fill | Goal 8 |
| 13 | CSV export: response has `text/csv` content-type, filename matches `orders-YYYY-MM-DD.csv`, every expected column present, voided lines included and marked, totals exclude voided | Goal 7 |

**Goal:** 13 test files, ~30-50 test cases total, run in <30 seconds. Run locally before deploying.

### Milestone 11 — Deployment + Smoke Test (est. 0.5 hour) ⏳ PENDING
**Requirements satisfied:**
- README "Host it for free" — live URL on free tiers
- README "Seeded with enough demo data to show the system doing something"
- README "Connection strings, keys and passwords kept in environment variables"
- README "Note in SUBMISSION.md if yours does" (sleep behavior)

**Steps:**
1. Create Supabase production project
2. `prisma migrate deploy` against production
3. `node prisma/seed.js` against production
4. Create Render service, set env vars (`DATABASE_URL`, `JWT_SECRET`, `ALERT_THRESHOLD_MINUTES`, `APP_TIMEZONE`, `FRONTEND_ORIGIN`)
5. Deploy backend
6. Create Vercel project, set `VITE_API_BASE_URL` to backend URL
7. Deploy frontend
8. Smoke test: log in as each demo user, walk through every Goal 1–10 feature, verify
9. Record any host quirks (sleep behavior, cold-start time) for SUBMISSION.md

### Milestone 12 — Pre-Submission Verification (est. 0.25 hour) ⏳ PENDING
**Requirements satisfied:** README "How to submit" + "Use git properly" + "What you must commit"

**Checklist:**
- [ ] GitHub repo is set to **Public** (verify in repo Settings → Danger Zone → Change visibility)
- [ ] All 5 `docs/` files are present and reflect Implemented status
- [ ] `docs/decisions.md` has ≥5 real decisions, ≥1 reversal
- [ ] `docs/ai-prompts.md` has actual prompts including ≥1 that produced wrong output
- [ ] `SUBMISSION.md` filled with all 8 sections (Links, Notes, Demo credentials, Stack, Goal checklist, Time spent, What next, Least happy with)
- [ ] Final commit on `master`; `git log` shows incremental history (no squashing of past milestones)
- [ ] Demo credentials work on the live URL with all 10 goals demonstrable

### Milestone 13 — Documentation Final Pass (est. 0.25 hour) ⏳ PENDING
**Requirements satisfied:** README "What you must commit" (5 docs files filled in as work progressed)

**Steps:**
1. Update `docs/architecture.md` to reflect actual deployed state, not proposed state
2. Update `docs/schema.md` with any schema changes made during implementation
3. Append any new decisions to `docs/decisions.md` (including any reversals)
4. Append any AI prompts that produced wrong output to `docs/ai-prompts.md`
5. Update `docs/plan.md` "Estimate vs Actual" with honest time per milestone
6. Update `docs/plan.md` "What was cut" if anything was cut
7. Final commit

---

## Why This Order

The ordering is dictated by dependency, not by feature surface area:

1. **Database** (M1) — everything reads/writes through it.
2. **Auth** (M2) — every other endpoint checks the user.
3. **Menu** (M3) — orders depend on menu items existing; bulk update is isolated.
4. **Orders + lines** (M4) — creates the entities the rest of the system mutates.
5. **Lifecycle + history** (M5) — adds state and audit on top of M4's entities.
6. **Collaborators + search** (M6) — uses M4's orders and M5's access model; the order list is the entry point for finding work.
7. **Dashboard + alerts + CSV** (M7) — all three are pure aggregations of data produced by M1-M6.
8. **Frontend: Manager views** (M8) — surfaces manager-only features (menu, dashboard, alerts, CSV).
9. **Frontend: Waiter views** (M9) — surfaces the main waiter workflow (orders + detail).
10. **Tests** (M10) — verifies the rules before they go public.
11. **Deploy + smoke** (M11) — exposes the verified app to a reviewer.
12. **Pre-submission** (M12) — guards against a broken submission.
13. **Docs final** (M13) — last, so docs reflect what was actually built.

Splitting frontend into manager and waiter halves (M8 and M9) keeps each slot focused. Tests come **before** deploy so a broken rule is caught privately, not publicly. Deploy is its own slot so its failure modes (Render cold start, Supabase connection, Vercel env var) don't poison the test slot.

---

## What Was Cut / Deferred

**Stretch ideas** (README explicitly optional):
- Kitchen display screen
- Table-side ordering from handheld
- Split checks
- Loyalty/repeat-customer program
- Ingredient-level stock deduction
- Reservation / table management
- Printable / emailed receipts
- Happy-hour / time-of-day pricing
- Multi-location with per-location pricing

**Implementation cuts** (saved time without losing a README goal):
- No charting library for the 14-day chart — rendered as a labeled table (HTML `<table>` with date, count, revenue per day, zero-filled)
- No animations, no dark mode, no responsive mobile design
- No ESLint / Prettier
- Plain CSS (no Tailwind, no component library)
- No loading skeletons (plain "Loading…" text)
- No SSR
- No WebSockets / real-time updates (the README allows polling)

**Not cut:** any of the 10 mandatory goals.

---

## Living Documentation Rules

Documentation is updated **as the work happens**, not from memory at the end:

- **`docs/decisions.md`**: Append a new entry every time a real implementation decision is made. If a previous decision is reversed, mark the original entry and add a new one explaining the reversal. (README requires ≥5 decisions, ≥1 reversal.)
- **`docs/ai-prompts.md`**: Append every prompt used during implementation, with what was produced and what was corrected. (README requires actual prompts, including ones that produced wrong output.)
- **`docs/plan.md`**: Update milestone status (✅ / 🔄 / ⏳) as work progresses. Fill "Estimate vs Actual" as each milestone completes.
- **`docs/architecture.md`** and **`docs/schema.md`**: Update when the actual implementation diverges from the proposed design. (Currently: both files describe the **proposed** design, and are accurate against the actual schema in `prisma/schema.prisma`.)
- **`SUBMISSION.md`**: Filled in Milestone 12 with verified data only. No claims about features that are not yet implemented and verified against the live URL.

---

## Documentation & Traceability Rules

These rules apply from **Milestone 5 through the final milestone** (M13). They are the binding contract for documentation, AI assistance, and milestone sign-off. They supplement — and tighten — the "Living Documentation Rules" above.

### `docs/ai-prompts.md` — Prompt and result log

- Record **every meaningful AI / Claude prompt** used during implementation.
- For each prompt, preserve:
  - the **actual prompt text** (verbatim, not paraphrased)
  - the **purpose** — what the prompt was trying to accomplish
  - the **result** — what was produced (concrete output, not a vague summary)
  - **correctness** — was the output correct, partially correct, or wrong?
  - any **correction** applied when the AI output was wrong
- **Never fabricate historical prompts.** If a prompt wasn't recorded at the time, do not invent it later. The log is a record of what actually happened, not a reconstruction.
- Prompts that produced wrong output are **especially important** — they are the most useful entries for the reviewer and for future work.

### `docs/architecture.md` — Live architecture reference

- Keep `docs/architecture.md` **synchronized with the actual implemented architecture**.
- Update it **whenever a milestone changes** any of:
  - routes (new endpoint, removed endpoint, route shape change)
  - components (new page, new shared component, role-scoped UI)
  - database interactions (new query, new transaction, new snapshot rule)
  - authentication / authorization (new middleware, new role gate, new access rule)
  - state transitions (new valid transition, new terminal state, new blocking rule)
  - testing structure (new test file, new test harness, new test database)
  - or any other **meaningful architectural concern**
- If a milestone does not change architecture, no update is required — but check explicitly.
- The file must never describe a design that the code does not implement. If the code diverged, the docs follow the code, not the original plan.

### `docs/bugs.md` — Bug and issue log

- Continue the bug log from M4 onward. M3 bugs will be reconstructed separately; do not back-fill them here.
- For every **significant bug** record:
  - **Milestone** — which milestone it was found in
  - **Bug / issue** — one-line description
  - **What was observed** — concrete failure (status code, wrong output, crash)
  - **Root cause** — the actual underlying cause, not the symptom
  - **Fix / countermeasure** — the change made
  - **Why this countermeasure was chosen / trade-off** — reasoning, alternative rejected
  - **How it was verified** — the test, command, or inspection that confirmed the fix
- **Do not invent bugs.** Do not record trivial transient errors (one-time network blips, typos caught by the next test run, dev-only environment issues).
- The log is for **meaningful** bugs and implementation issues — those that influenced a design decision, blocked a milestone, or revealed a non-obvious interaction in the system.

### Milestone-completion checklist (mandatory, every milestone M5–M13)

Before declaring a milestone **COMPLETE** in this document:

1. **Verify requirements** — every requirement listed in the milestone's "Requirements satisfied" section is actually implemented and demonstrable.
2. **Run relevant tests / checks** — at minimum the validator-level test suite; integration tests if the harness is in place; manual API smoke if a DB is available.
3. **Update `docs/plan.md`** — change the milestone status from ⏳ / 🔄 to ✅, fill the "Estimate vs Actual" entry, and add the "Delivered" / "Notes" subsections.
4. **Update `docs/ai-prompts.md`** — record every meaningful prompt used during the milestone, with the fields above.
5. **Update `docs/architecture.md`** — only if the milestone changed architecture per the rules above. If unchanged, no edit; if changed, document the change.
6. **Update `docs/bugs.md`** — record any significant bugs found and resolved during the milestone. If none, no edit.
7. **Review `git diff` and `git status`** — confirm only intended changes for the milestone are staged. Flag any unexpected files before committing.
8. **Only then** mark the milestone ✅ in this document and in the Estimate vs Actual table.

A milestone is not complete until all eight steps are done.

### Session-start contract (every new Claude Code session)

At the **beginning of every new Claude Code session** working on this project:

1. **Read `docs/plan.md`** — current milestone status, scope, and these rules.
2. **Follow these documentation rules** for every action in the session.
3. **Do not rely on conversation memory** — the documentation is the source of truth for what was decided, what was built, and what is next. If something is missing from the docs, fix the docs first, then act.

These rules exist so that a reviewer — or a future session — can recover the full state of the project from the `docs/` directory alone, without depending on prior conversation context.

---

## Pre-Submission Checklist (must pass before push)

- [ ] GitHub repo is set to **Public** (verify in repo Settings)
- [ ] All 5 `docs/` files are present and reflect Implemented status
- [ ] `docs/decisions.md` has ≥5 real decisions, ≥1 reversal
- [ ] `docs/ai-prompts.md` has actual prompts including ≥1 that produced wrong output
- [ ] `SUBMISSION.md` filled with all sections (Links, Notes, Demo credentials, Stack, Goal checklist, Time spent, What next, Least happy with)
- [ ] Demo credentials for **every role** (1 manager + 2 waiters) recorded
- [ ] Final commit on `master`; incremental history preserved
- [ ] All automated tests (M10) pass locally
- [ ] Live URL is reachable and all 10 goals are demonstrable
- [ ] Sleep behavior of the host is noted in SUBMISSION.md
- [ ] No secrets in the repository (only `.env.example`)

---

## Estimate vs Actual

| Milestone | Estimate | Actual | Status |
|-----------|----------|--------|--------|
| 1. Foundation + Database | 2h | ~2h | ✅ |
| 2. Auth + AuthZ | 2h | — | 🔄 → ✅ |
| 3. Menu + Bulk | 2h | ~1.5h | ✅ |
| 4. Orders + Lines | 2h | ~2h | ✅ |
| 5. Lifecycle + History | 2h | ~1.5h | ✅ |
| 6. Collaborators + Search | 2h | — | ⏳ |
| 7. Dashboard + Alerts + CSV | 2h | — | ⏳ |
| 8. Frontend: Manager | 1.5h | — | ⏳ |
| 9. Frontend: Waiter | 1.5h | — | ⏳ |
| 10. Critical Tests | 1h | — | ⏳ |
| 11. Deploy + Smoke | 0.5h | — | ⏳ |
| 12. Pre-Submission Check | 0.25h | — | ⏳ |
| 13. Docs Final | 0.25h | — | ⏳ |
| **Total** | **~15.5h** | **~9h so far** | 6 milestones remain |

---

## What Was Cut When Short on Time

Mandatory README goals are never cut. Within a milestone, the first casualties are:

1. **Cosmetic polish** (animations, transitions, hover effects)
2. **Bulk operations on non-menu resources** (no bulk-archive, no bulk-status-change)
3. **Inline error tooltips** (replaced with simple text below the field)
4. **Per-page meta / breadcrumbs** (replaced with a flat nav)
5. **Date-range filter on dashboard** (single-day only)
6. **Password change** (out of scope; would need a "current password" check)

If the dashboard's 14-day chart rendering becomes a time sink, it falls back to a plain numbered list (no styling).

---

## Git Workflow

- Work happens on `master` (the GitHub default branch for this repo is `master` per repo settings).
- Commits are made **after** each milestone is implemented, tested, and documented.
- Each commit message follows the format `<type>: <description>` where type is `feat`, `fix`, `test`, `docs`, or `chore`.
- Commits are **never** squashed or rebased after the fact (the README values the chronological history of how the work was built).
- `git push` only happens **after** the user reviews the commit locally and gives explicit approval.
- No destructive git operations (`reset --hard`, `force push`, branch deletion) without explicit authorization.
- The remote is `https://github.com/Prxnv0/restaurant-orders.git`.
