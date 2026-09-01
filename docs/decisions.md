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

---

*Decisions continue below as implementation progresses.*