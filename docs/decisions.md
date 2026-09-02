# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least one entry must be a decision you later reversed.

The decisions below reflect what was discussed and decided during the initial analysis and planning phase, before any code was written. Each entry may be updated as implementation proceeds.

---

## Decision 1 — Database choice

- **Chose:** PostgreSQL consistently for both development and production, hosted on Supabase's free tier.
- **Rejected:** SQLite for development, PostgreSQL for production (different dialect testing needed between environments).
- **Why:** Using the same database in dev and prod avoids dialect mismatches and reduces risk when deploying. Prisma's dev workflow supports PostgreSQL directly. The assignment requires PostgreSQL anyway for production, so starting there avoids a costly migration later. SQLite would have been faster to set up but introduces a false sense of simplicity that breaks when switching to Postgres for deployment.

## Decision 2 — Authentication strategy

- **Chose:** JWT tokens stored in httpOnly, SameSite=Strict cookies.
- **Rejected:** JWT in localStorage (vulnerable to XSS), session-based auth with server-side store (requires sticky sessions or Redis, more complex on free-tier deployments), OAuth2 provider integration (overkill for a take-home).
- **Why:** httpOnly cookies provide protection against XSS-based token theft. SameSite=Strict prevents most CSRF attacks without requiring a CSRF library. JWT is stateless — no server-side session store to manage, simplifies deployment to free-tier hosts. This balances security and simplicity within the 12-hour budget.

## Decision 3 — Alert dismissal model

- **Chose:** A separate `alert_dismissals` table that records each dismissal as an individual event, enabling multiple dismissal/reappearance cycles.
- **Rejected:** A single `acknowledged_at` timestamp on the `alerts` table (supports only one dismissal cycle, cannot reappear).
- **Why:** The assignment explicitly requires the alert to reappear after a further threshold period if the order is still not Ready. A single timestamp cannot model repeated dismissal cycles. A separate table with discrete events allows each cycle to be tracked independently: the system queries for the latest dismissal, checks if threshold-minutes have elapsed since then, and re-flags the alert if so.

**Later reversed: ** See Decision 8 below. Initially I planned to store `dismissals` as a JSONB array on the alerts table. During deeper analysis of the query patterns — specifically the need to check "has this order been dismissed since the last status change" efficiently — I realized a separate relational table with proper foreign keys and indexes would be cleaner and support better query performance. Reverted to the separate-table approach.

## Decision 4 — API style

- **Chose:** REST API with JSON, separate endpoints per resource.
- **Rejected:** GraphQL (would require Apollo/GraphQL Yoga setup, more client-side complexity for a simple data model).
- **Why:** The data model is straightforward with clear relationships. REST endpoints map directly to the assignment requirements (GET orders, PATCH order status, POST lines). Fewer dependencies, simpler to test, and the assignment does not mention any requirement that would specifically benefit from GraphQL (like nested data requirements or avoiding over-fetching).

## Decision 5 — Historical pricing approach

- **Chose:** Snapshot the `unit_price` on `order_lines` at the time the line is created.
- **Rejected:** Reference `menu_items.price` at query time (would make historical totals reflect current prices, violating the requirement that totals be calculated from prices at the time each line was added), versioned price table (adds complexity, requires joins and time-range queries).
- **Why:** The snapshot approach is the simplest way to guarantee that an order's total always reflects the prices at the time it was created, not the current menu prices. It requires no joins for historical order data and is trivially correct.

## Decision 6 — Alert threshold configuration

- **Chose:** Environment variable `ALERT_THRESHOLD_MINUTES` with a default of 15 minutes, applied uniformly as both the first-alert and re-alert threshold.
- **Rejected:** Database settings table (user-configurable via UI), hardcoded value, per-order-type thresholds.
- **Why:** The threshold is a deployment-time configuration, not a business-logic requirement that needs a UI. A settings table would add schema complexity and an admin UI that is not part of the assignment. A hardcoded value with no way to tune it would make the system inflexible. An environment variable provides the right balance: simple to implement, configurable at deploy, no UI needed.

## Decision 7 — Authorization scope for primary waiters

- **Chose:** Primary waiters have the same level of access to an order as collaborators — they can view, edit, add lines, change status, add notes, and see history on orders where they are the primary waiter.
- **Rejected:** Different access levels between primary waiters and collaborators (initially, a draft matrix had collaborators with fewer permissions than primary waiters).
- **Why:** The assignment states both roles should be able to "update" the order, with no indication of reduced permissions. Distinguishing between them adds unnecessary complexity. The key authorization boundary is between "can access this order" and "cannot access this order" — not between levels of access among those who can.

## Decision 8 — Alert dismissal data model (reversal)

- **Original choice (Decision 3 revision):** Store `dismissals` as a JSONB array on the `alerts` table, where each element is `{ dismissed_at: timestamp, dismissed_by: user_id }`.
- **Why:** Initially seemed simpler — no additional table, no joins.
- **Later reversed:** JSONB array queries are harder to index and reason about. Checking "is there a dismissal after the last status change" requires parsing the JSON. A separate `alert_dismissals` table with proper foreign keys and the ability to sort/index by `dismissed_at` makes the reappearance logic clearer and queryable with standard SQL.
- **Why the change:** While no implementation had begun, writing out the alert detection algorithm revealed that the query patterns were more natural against a relational table. The separate table also supports cascading deletes cleanly (if an alert is deleted, its dismissals go with it).
- **How the decision evolved:** I wrote both models side by side in schema design. The array model required a query like `SELECT * FROM alerts WHERE dismissals IS NOT NULL AND dismissals->-1->>'dismissed_at'` — brittle and unindexable. The relational model supports `SELECT * FROM alert_dismissals WHERE alert_id = X ORDER BY dismissed_at DESC LIMIT 1` — clean and fast.

---

## Decisions to be added during implementation

Additional decisions will be recorded here as the project develops. Examples that may arise:
- Choice of chart library for the dashboard
- Validation strategy details
- Bug-driven design changes
- Deployment-specific configuration choices
- Any other non-trivial technical decision

---

## Decision 9 — JavaScript vs TypeScript for the 12-hour build

- **Chose:** Plain JavaScript (`.js` / `.jsx`). No transpilation, no `tsc` step, no type definitions to write or maintain.
- **Rejected:** TypeScript with `ts-node-dev` for backend and Vite's built-in TS support for frontend.
- **Why:** The assignment's 12-hour budget rewards speed and proven-tool fluency over type safety. Prisma generates types from the schema, so the database layer is already strongly typed. Express route handlers and React components are mostly thin; the marginal benefit of explicit types in the 12-hour window does not justify the compilation step, extra config, and risk of type errors delaying a deploy. Pure JavaScript also keeps the simplest possible Render start command (`node src/index.js`) and the simplest Vite build.

## Decision 10 — CommonJS in backend, ESM in frontend

- **Chose:** CommonJS `require()` in the Express backend; ESM `import` in the Vite frontend.
- **Rejected:** ESM throughout (would need `"type": "module"` in backend `package.json` and import statements everywhere).
- **Why:** Vite mandates ESM for the frontend regardless. The backend is simpler in CommonJS because Node's default is CommonJS, no `package.json` flag is required, and the standard tooling (bcrypt, jsonwebtoken) all use `require` out of the box. The mixed style is a deliberate cost paid once for a simpler dev experience.

## Decision 11 — Seed is idempotent (TRUNCATE then INSERT)

- **Chose:** The seed script TRUNCATEs every table at the start, then re-creates all demo data from scratch.
- **Rejected:** Insert-only seed (idempotent inserts, but accumulates junk over multiple runs).
- **Why:** For a take-home that needs to be re-seeded on Supabase after deployment and possibly many times during development, the simplest correct thing is to wipe and re-create. The script is run as a one-shot command (`node prisma/seed.js`); there is no production data we care about preserving.

## Decision 12 — Single `served_at` column on orders

- **Chose:** Add a `served_at` column to the `orders` table, set when `status → SERVED`.
- **Rejected:** Computing served-at from the latest matching `STATUS_CHANGE` history entry at query time.
- **Why:** The dashboard needs "orders served today" and the 14-day chart keyed on serve date. Querying through `order_history_entries` for every dashboard request is a join and a parse; storing `served_at` is a direct indexed lookup. The column is cheap to maintain (one `UPDATE` in the state machine) and consistent with the assignment's emphasis on server-side filtering. This decision was a refinement of the originally-proposed schema and is recorded as a real change made during milestone 1.

## Decision 13 — Prisma enum mapping for status fields

- **Chose:** Use Prisma's `enum` declarations for `Role`, `OrderStatus`, `LineStatus`, and `EventType`.
- **Rejected:** String fields with `@@check` constraints only (no Prisma enums).
- **Why:** Prisma enums give compile-time guarantees in the Prisma client (`status: OrderStatus.ACCEPTED` instead of `'ACCEPTED'`) and generate a PostgreSQL `enum` type under the hood, which is more efficient than a CHECK constraint and more discoverable in pgAdmin.

**Updated during M3 (see Decision 15):** the "defence-in-depth `@@check` backstop" mentioned in the original version of this decision was not actually added to the schema. The original M1 schema had raw `@@check(...)` block attributes that Prisma does not support; they were removed in M3 so `prisma generate` could run. The enum + Joi application-layer enforcement remains the only check. This is a correction to the original decision text, not a reversal of the choice — Prisma enums are still the primary mechanism, and application-layer enforcement still backs them.

## Decision 20 — Filter combination in `GET /api/orders` (M6)

- **Chose:** Every filter (`search`, `status`, `waiter`, `date`, `include_archived`) and the sort/page/limit parameters are applied as **AND** conditions in the Prisma `where` clause. Empty / missing params are skipped (no `undefined` values end up in the query). The `waiter` filter is honoured **only** when the requester is a manager; waiters cannot pass a `waiter` param and have it applied (the server silently ignores it for them — see code in `backend/src/routes/orders.js`). The `include_archived` filter is honoured for both roles (waiters can see their own archived orders).
- **Rejected:** OR-combining the filter parameters (would let a single query mean "show me orders on table 5 OR in PLACED status" which is not what the UI wants), running filters in JavaScript after a single broad query (would defeat the purpose of pagination and stress the database), issuing a separate count query before the search to populate the total (would add a round trip; `prisma.order.count` on the same `where` is cheap).
- **Why:** The README says "text search on table number, status/waiter/date filters, sort by placed time/status/table, pagination with total match count, all server-side." AND-combining independent filters is the natural read of "search on table number + status filter + date filter" — the user wants a single result set matching all of them, not a union. The waiter-scoping is enforced at the same time (the manager can opt into a single waiter's queue; a waiter's `waiter` param is ignored because the OR-scope to "my orders" is already in place). `prisma.order.count` with the same `where` runs in microseconds and gives the client a real total for the "X of Y" UI.
- **What users see:** Filters compose. Selecting "Placed" status + today's date returns only orders that are both Placed and created today. Pagination reflects the total of the filtered set, not the whole table.
- **What this cost:** None. The query plan is the same shape as the unfiltered query, with extra predicates the planner can push into existing indexes (`@@index([status, createdAt])` and `@@index([archivedAt])` cover most filter combos; the table_number ILIKE search is the only one without an index, acceptable because table numbers are short and the row count is small).

## Decision 21 — Default sort, limit, and `include_archived` (M6)

- **Chose:** Defaults are `sort=placed_at`, `order=desc`, `limit=20`, `page=1`, `include_archived=false`. The default sort matches the most common view (newest first) and is what every waiter needs when they open the page. `include_archived=false` matches the README's "default queue excludes archived" rule. The 20-item default fits a small restaurant and is small enough that pagination is rarely needed.
- **Rejected:** Defaulting `include_archived=true` (would clutter the active queue with archived orders), defaulting to `order=asc` (would put oldest first, the opposite of what waiters want when they check the kitchen status), defaulting to `limit=50` (more rows, slower render; users can opt in if they need more).
- **Why:** "Newest first" is the right default for an active order queue — a waiter wants to see what's just been placed. Excluding archived by default matches the spec. The 20-row limit is a small enough number that the page renders quickly on a low-powered device, but a paginated 20 keeps the URL bookmarkable.
- **What users see:** Opening `/orders` shows the 20 most recent non-archived orders. Selecting a status, date, or waiter filter narrows the list; the "X of Y" counter reflects the filtered total. A separate "Show archived" toggle (in the M6 UI) is left to a future milestone; the current UI lets the manager un-archive orders via the detail page.
- **What this cost:** None.

## Decision 22 — `waiter_id` accepts email or UUID on `POST /:id/collaborators` (M6)

- **Chose:** The `waiter_id` body field on the add-collaborator endpoint accepts either a user UUID or an email. The route looks the user up by `OR: [{ id: waiter_id }, { email: waiter_id }]` and uses the resolved id for the `OrderCollaborator` insert.
- **Rejected:** Restricting to UUID only (would force the frontend to ship a user directory endpoint just to render a list of selectable waiters — out of M6 scope), or restricting to email only (would still require the frontend to map a "selected email" back to a uuid for any non-add operation).
- **Why:** The UI takes an email input from the primary waiter or manager. Looking up by email is one indexed column with a unique constraint, so the cost is identical to a UUID lookup. Accepting both makes the route robust: a future "user picker" UI can pass either. The endpoint shape is stable across both inputs.
- **What users see:** On the order detail page, the "Add Collaborator" form is a single email input. Typing an unknown email returns a 404. Typing a manager's email returns 400 ("Collaborator must be a waiter") — the lookup distinguishes roles.
- **What this cost:** None. The validator is a `Joi.string().trim().min(1).max(254)` (RFC 5321 max email length) so the input shape is the same in both cases.

## Decision 14 — Per-item try/catch for menu bulk-update

- **Chose:** Validate the bulk-update request body once with Joi (id list, at least one of `price` / `is_available`), then loop over the ids and run each `prisma.menuItem.update` inside its own try/catch. The response is `{ succeeded: [...], rejected: [{ id, reason }] }` — never an HTTP error for per-item issues.
- **Rejected:** Validate every id + change upfront and reject the whole request if any item fails; or run the whole batch as a single Prisma transaction.
- **Why:** The README explicitly says "a request can list multiple items and what succeeded and what was rejected is reported back" — the contract is per-item outcomes, not all-or-nothing. A single transaction would also be wrong: one bad item would rollback the good ones. The upfront-validation approach would force the client to repeatedly fix the same item while every other item in the batch stays stale. Per-item try/catch is the only shape that satisfies the requirement and also keeps the manager UI's "X succeeded, Y rejected" display honest.
- **Trade-off accepted:** A bulk request that hits many bad ids performs N+1 queries. This is fine for a restaurant with at most a few hundred menu items, and the route is manager-only so it is not a hot path. Documented as a known limitation rather than a premature optimization.

## Decision 15 — Drop raw `@@check` constraints; rely on Joi + Prisma enums

- **Chose:** Remove the four raw `@@check(...)` block attributes from `prisma/schema.prisma` (price ≥ 0 on `MenuItem`; status in valid set on `Order`; quantity ≥ 1 and status in valid set on `OrderLine`; event_type in valid set on `OrderHistoryEntry`). Application-layer Joi validation on every write is the sole enforcement mechanism. Schema-correctness invariants that were not raw CHECKs (enums, foreign keys, composite primary keys, `onDelete: Cascade`) are unchanged.
- **Rejected (in M1):** Keep raw `@@check` constraints as a defence-in-depth backstop (the original Decision 13 wording).
- **Why the change:** Prisma's schema DSL does not actually support the `@@check` block attribute — the M1 schema did not validate. `prisma generate` failed with `P1012: This line is not a valid field or attribute definition`, which would have blocked any deploy (and any test that loaded the Prisma client). Rather than switch to a raw SQL migration to add the constraints, we drop them and accept application-layer enforcement.
- **What the user sees:** None. The API contract is unchanged: invalid prices, quantities, and statuses are still rejected, just by Joi before they reach the database. The "Where enforced" table in `docs/schema.md` has been updated to reflect this.
- **Why the trade-off is acceptable:** A take-home with one application server and no other write paths cannot reach the database except through Joi-validated controllers. The defence-in-depth value of a DB CHECK would be in catching direct SQL writes from migrations, ad-hoc psql sessions, or a future second service — none of which exist in this 12-hour build. Adding a raw SQL migration would also create a second source of truth (Prisma schema + raw migration) that has to stay in sync.
- **Cost of the original choice:** Zero user-facing impact (the invalid attributes never compiled), but it would have been a deploy blocker. Found and fixed during M3 because `prisma generate` is required to run the backend.

## Decision 16 — Total computed from `ACTIVE` lines only (M4)

- **Chose:** The order total returned to clients is computed server-side as `SUM(quantity * unit_price)` over rows where `status = 'ACTIVE'`. Voided lines are excluded from the displayed total. The query runs against the `order_lines` table directly (not against any cached value on the `Order` model).
- **Rejected:** Caching the total on the `Order` model as a column updated by a trigger, computing the total in JavaScript after loading all lines, returning the raw line rows and letting the client sum.
- **Why:** A cached column requires a trigger to stay in sync and creates two sources of truth (the column and the sum of the lines). A frontend-computed total means the server never returns a single canonical number, which contradicts the README requirement that totals be calculated server-side. Computing at query time is one extra `SUM` against a tiny table (single-digit to low-double-digit rows per order); the cost is negligible and the data is always current.
- **What users see:** The total on the order detail page reflects only active lines. A line voided with a reason disappears from the total immediately on the next fetch.

## Decision 17 — Line-add blocking rule (M4)

- **Chose:** The `POST /api/orders/:id/lines` endpoint refuses (HTTP 409) to add a line when the order is in `SERVED` or `CANCELLED` status. No other statuses block the add — including `PLACED`, `ACCEPTED`, `PREPARING`, and `READY`. The error message includes the current status so the caller can present a helpful message.
- **Rejected:** Allowing line adds in any status (including post-serve, requiring a manual override), or only allowing line adds in `PLACED` (locking the door too early — the kitchen may accept a new side dish after the order is already preparing).
- **Why:** The README is explicit that lines can be added until the order is "Served or cancelled" — that's the natural end of an order's life. The status model treats `READY` as still a state where the order is open and could plausibly receive a last-minute addition (e.g., "and a coffee too"). The error code 409 (Conflict) is the right HTTP code because the request is well-formed but conflicts with the current resource state.
- **What users see:** On a served or cancelled order, the "Add Line" form on the order detail page is hidden, and any direct API call receives a 409 with a message naming the blocking status.

## Decision 18 — State machine encoded as a single transitions map (M5)

- **Chose:** The legal order status transitions are encoded in a single constant `VALID_TRANSITIONS` in `backend/src/stateMachine.js`, with one function `assertValidTransition(from, to)` that every status-changing route calls. The map is a small, declarative structure: `{ PLACED: ['ACCEPTED', 'CANCELLED'], ACCEPTED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY'], READY: ['SERVED'], SERVED: [], CANCELLED: [] }`.
- **Rejected:** A class hierarchy of `OrderState` subclasses with a `canTransitionTo(nextState)` method (overkill — six states with one map is simpler), scattered `if (currentStatus === 'X' && newStatus === 'Y')` checks inside each route handler (would make the rule impossible to audit in one place), or relying on the database `CHECK` constraint (cannot express transition rules in SQL).
- **Why:** One map is the simplest thing that captures the entire rule. A new state or transition is a one-line change. A test can import the map and assert the rule directly without a database. The single function provides a uniform error shape: every illegal move throws the same `AppError` 409 with `code: INVALID_TRANSITION` and a `details` object that includes `current_status`, `attempted_status`, `valid_next_statuses`, and a categorising `reason` (`skip_states`, `backward_transition`, `cancel_too_late`, `terminal_status`, `no_op`, `illegal_transition`). The client can show the user a helpful message and the categorising reason is useful for tests and logging.
- **What users see:** Every illegal status change returns the same 409 shape. The `details.valid_next_statuses` array tells the client which buttons to render next, and the `details.reason` and `message` fields explain what went wrong in human terms.
- **Where the map lives:** `backend/src/stateMachine.js` — a dedicated module, not buried inside the route file. This makes the rule testable in isolation and prevents the routes from drifting out of sync with each other.

## Decision 19 — History `details` JSON shape (M5)

- **Chose:** Standardised the `details` JSONB column on `order_history_entries` so every event type uses a consistent camelCase-shaped object with a single primary identifier and any relevant secondary fields. The shapes are:
  - `STATUS_CHANGE`: `{ old_status, new_status }`
  - `LINE_ADDED`: `{ line_id, menu_item_id, quantity, unit_price }`
  - `LINE_VOIDED`: `{ line_id, reason }`
  - `NOTE_ADDED`: `{ content }`
  - `COLLABORATOR_ADDED` / `COLLABORATOR_REMOVED` (M6): `{ waiter_id }`
- **Rejected:** Free-form details per event type with no contract (would make timeline rendering fragile and require a switch statement everywhere details is read), storing every field as a top-level column on the history table (would require schema migrations every time a new event type is added and produce a sparse table).
- **Why:** JSONB gives us per-event-type flexibility without schema migrations. The standardised shape per type keeps the timeline renderer simple: it can dispatch on `event_type` and read known fields. Storing `line_id` and `waiter_id` inside the details JSON lets the timeline link to the relevant resource even if the resource is later deleted (a soft FK that survives CASCADE on the order — the history entry still records who did what, when, with which resource).
- **What users see:** The order history timeline panel renders a clean chronological list. Each entry has an icon by `event_type`, a human-readable summary built from the known fields, the actor's name, and the timestamp.

---

*Decisions continue below as implementation progresses.*

## Decision 23 — "Today" defined in local timezone, not UTC (M7)

- **Chose:** Dashboard and CSV export determine "today" by converting `new Date()` to `APP_TIMEZONE` (IANA name, e.g. `Asia/Kolkata`), defaulting to `UTC`.
- **Rejected:** Using UTC midnight as the boundary (would cause midnight misalignment for restaurants in timezones with a positive UTC offset — orders placed at 00:05 local on a +5:30 restaurant would appear on the wrong day in the dashboard and CSV).
- **Why:** A restaurant's day is defined by their local clock, not by UTC. The `APP_TIMEZONE` env var keeps this deployment-specific without hard-coding any specific offset. The offset is computed once per request via `toLocaleString` (cheap and accurate for the IANA zone database).
- **What users see:** Dashboard revenue and order counts match the restaurant's actual working day. The CSV export is named for the local date. This is especially important for restaurants that operate past midnight — an order placed at 00:30 on a Monday belongs to Monday, not Sunday.
- **What this cost:** `toLocaleString('en-US', { timeZone: tz })` has a small runtime overhead per request; acceptable for dashboard (not a hot path) and CSV (one-off export). If it became a bottleneck, the offset could be cached as a numeric `±hhmm` string.

## Decision 24 — Alert reappearance logic: last dismissal timestamp only (M7)

- **Chose:** An alert is "active" when `resolvedAt IS NULL` AND `order.status` is non-terminal AND (there are no `alert_dismissals` for this alert OR `MAX(dismissed_at) < now - threshold`). The alert is suppressed while a dismissal is recent enough; it reappears as soon as threshold-minutes have elapsed since that dismissal.
- **Rejected:** Using the order's `updatedAt` or `createdAt` as the reappearance clock — this would be wrong because the order is updated on every status change, collaborator add, line add, etc., which would restart the clock unexpectedly.
- **Why:** The dismissal table's `dismissedAt` is the right clock because it is set once, never updated, and correctly measures "time since last explicit user action". A dismissal that happened 10 minutes ago is no longer recent; after 15 minutes the alert should reappear. The `MAX(dismissed_at)` aggregate (implemented in the route as `alert.dismissals[0].dismissedAt` — we always fetch the most-recent dismissal first) gives exactly that.
- **What users see:** A waiter dismisses an alert; it disappears from the alerts list. If the order is still not Ready/Served after 15 more minutes, the alert reappears — the same alert record still exists, and the query re-exposes it. The count in the nav badge reflects the reappeared alert.
- **What this cost:** None — the query already fetches `dismissals` ordered by `dismissedAt DESC LIMIT 1` for the `last_dismissed_at` response field; the same check is reused for the visibility filter.

## Decision 25 — CSV: one row per line, order total on first line only (M7)

- **Chose:** The CSV exports one row per `order_lines` row. The order total (sum of ACTIVE lines) appears in the `Order Total` column on the first line of each order and is blank on subsequent lines. Voided lines are included with `Voided=Yes` and `Line Total=0`; the order total excludes them. If an order has no lines, a single summary row is emitted.
- **Rejected:** One row per order with a denormalised total column (would require joining all lines into one cell and then splitting on import), or outputting per-line totals only without a per-order total (would make it harder to reconcile the CSV against the POS).
- **Why:** A spreadsheet with one row per line is the most natural representation of a restaurant bill in tabular form — each row is one item. The order total on the first row is a standard spreadsheet convention that makes the bill readable without a separate aggregate. Including voided lines with a clear `Voided` flag gives a full audit trail.
- **What users see:** The manager downloads `orders-2026-09-03.csv` and opens it in Excel. Each line is a row, the order total is in column O (visible on the first line), voided items are flagged. The file opens correctly in Excel, LibreOffice, and Google Sheets.
- **What this cost:** None — this is the simplest representation that matches how order-line data is stored.
