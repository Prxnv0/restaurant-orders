# Bug / Issue Log

Significant bugs and unexpected issues discovered during implementation, from Milestone 4 onward. Trivial transient errors (network timeouts, one-time typos caught by tests) are not recorded. Each entry is technically accurate and was verified before closing.

---

## M4 — Orders + Order Lines

### Bug 1 — `joiCheck` helper return value misused in `GET /api/orders`

**Milestone:** M4
**Route:** `GET /api/orders`

**What was observed:**
The route handler called `const value = joiCheck(listOrders, req.query)` and then tried to destructure fields from `value`. The `joiCheck` helper is defined as:

```js
function joiCheck(schema, value) {
  const { error } = schema.validate(value, { abortEarly: false });
  if (error) {
    throw AppError.BAD_REQUEST(...);
  }
}
```

It has no `return` statement, so `value` would always be `undefined`. All subsequent field reads (`search`, `status`, `page`, etc.) would silently return `undefined`, causing every filter to be silently ignored and the query to use `undefined` values (or crash).

**Root cause:**
Copy-paste of the `joiCheck` helper from `routes/menu.js`, where it is used as a pure statement (fire-and-forget: `joiCheck(schema, req.body)`). The same pattern was applied in `orders.js` but with an incorrect attempt to capture a return value that was never returned.

**Fix / countermeasure:**
Replaced the incorrect call with a direct `listOrders.validate()` invocation that captures `{ value, error }`, matching the pattern used in `routes/auth.js`:

```js
const { value, error } = listOrders.validate(req.query, { abortEarly: false });
if (error) {
  throw AppError.BAD_REQUEST(error.details.map((d) => d.message).join('; '));
}
```

**Why this countermeasure was chosen:**
`joiCheck` is a thin helper designed for the simple case where the validated body fields map 1:1 to `req.body`. For query-string validation, the values need to be captured and used, so the helper is bypassed and `validate()` is called directly. This is consistent with how `routes/auth.js` handles login validation.

**How it was verified:**
All 43 backend tests (including 25 new orders-validator tests) pass. The module loads and starts without errors. The `GET /api/orders` route was confirmed to register 6 handler layers.

---

## M6 — Collaborators + Order Search

### Bug 2 — Pre-existing broken `ProtectedRoute` import blocked `npm run build` (found during M6)

**Milestone:** M6
**Files:** `frontend/src/App.jsx`, `frontend/src/components/ProtectedRoute.jsx`

**What was observed:**
`npm run build` failed with:
```
src/App.jsx (10:7): "default" is not exported by "src/components/ProtectedRoute.jsx", imported by "src/App.jsx".
```

`App.jsx` was doing `import ProtectedRoute from './components/ProtectedRoute'` (default import), but `ProtectedRoute.jsx` only exports a named function (`export function ProtectedRoute(...)`).

**Root cause:**
The mismatch was introduced when `ProtectedRoute.jsx` was first written in M2 with a named export, but `App.jsx` (also written in M2) was using a default import. The mismatch was never caught because no M2-onwards milestone ran `npm run build` as part of its verification — M3/M4/M5 all added backend routes and tested the backend; only the M4 frontend work touched the `frontend/` directory, and M4's Pages don't go through the build step (the dev server would have shown the same error at runtime, but the M4 verification didn't run `vite build`).

**Fix / countermeasure:**
Changed the import in `App.jsx` from `import ProtectedRoute from './components/ProtectedRoute'` to `import { ProtectedRoute } from './components/ProtectedRoute'`. One line, no other changes.

**Why this countermeasure was chosen:**
The named export in `ProtectedRoute.jsx` is the existing public surface (it was first written as named and the rest of the file expects a single export). The minimum-risk fix is to make the importer match. Switching `ProtectedRoute.jsx` to also export a default would add a second export that no one else uses.

**How it was verified:**
`npm run build` now succeeds: `✓ 44 modules transformed` → `dist/index.html 0.40 kB, dist/assets/index-DG6rIFJf.css 2.56 kB, dist/assets/index-AHaCR6fj.js 188.83 kB`. The frontend bundle is generated without errors.

**Why this is logged as an M6 bug, not an M2 bug:**
The bug was discovered during M6 verification (`npm run build` to confirm the M6 frontend changes compile). Per the Documentation & Traceability Rules, the milestone that *found* the bug records it. The M2 milestone's verification checklist did not include `npm run build`, which is why it was missed. The fix is one line and does not affect the M2 contract.

---

## M10 — Critical Automated Tests

### BUG-001 — `export.js` passed raw numeric dates to Prisma DateTime filters

- **Found in:** Test 13 (CSV export)
- **Observed:** Export tests failed or returned incorrect results when filtering today's orders. Prisma DateTime filters expected `Date` objects but received raw numeric values from `Date.UTC(...)`.
- **Root cause:** `export.js` computed `todayStartUTC` and `todayEndUTC` as raw `Date` objects and passed them directly to Prisma's `where` clause. The Prisma client silently accepted the values but did not handle them as proper Date filters, causing the query to return incorrect or empty results.
- **Fix/countermeasure:** Updated the date-filter logic to ensure Prisma receives proper JavaScript `Date` objects. The `Intl.DateTimeFormat` approach with explicit `Date.UTC()` calls was kept, but the output is now explicitly wrapped/converted so Prisma receives valid date objects for its `gte`/`lt` filters.
- **Why this fix:** Prisma's PostgreSQL adapter requires JavaScript `Date` objects for DateTime filters. Raw numbers or improperly constructed dates are not reliably interpreted as timestamps. Ensuring the values are proper `Date` instances makes the query deterministic regardless of how the date-computation logic evolves.
- **Verification:** Test 13 (CSV export) passed with correct row counts and date-filtering behavior after the fix.
- **Status:** Fixed

---

### BUG-002 — Orders routes passed `requireOrderAccess` instead of `requireOrderAccess()` (middleware factory not invoked)

- **Found in:** Test 03 (authz matrix)
- **Observed:** Multiple protected routes on `/api/orders/:id/...` hung on requests or returned 403/404 errors inconsistently. The `requireOrderAccess` middleware was never executing — the route would hang until the client timed out.
- **Root cause:** `requireOrderAccess` in `resourceOwner.js` is an Express middleware factory — it returns a middleware function when called (`requireOrderAccess()`). The orders routes were passing the factory itself (`requireOrderAccess`) as middleware instead of invoking it (`requireOrderAccess()`). Express treated the function object as a route handler rather than middleware, causing requests to never reach the actual access-check logic.
- **Fix/countermeasure:** Updated all `router.get('/:id', auth, requireOrderAccess, ...)` and `router.post('/:id/...', auth, requireOrderAccess, ...)` route registrations to call the factory: `requireOrderAccess()`. Every order-scoped route now correctly receives and executes the access-check middleware.
- **Why this fix:** The factory pattern (returning a function from a function) allows the middleware to capture `req.user` at request time while keeping the Prisma query inside the returned function. Calling the factory at registration time is the correct Express pattern. Not calling it means Express receives the outer function and tries to use it as a request handler, which causes the hang.
- **Verification:** Test 03 authz matrix tests completed without timeouts after the fix. All order-access checks now correctly grant/deny access based on the user's role and relationship to the order.
- **Status:** Fixed

---

### BUG-003 — `resourceOwner.js` Prisma query combined `include` and `select` (Prisma validation error)

- **Found in:** Test 03 (authz matrix)
- **Observed:** Prisma threw a validation error when `requireOrderAccess()` executed its query. The error indicated that a Prisma `findUnique` call was trying to combine `include` and `select` options, which is not permitted.
- **Root cause:** The `findUnique` query in `resourceOwner.js` included both an `include` block (for the `collaborators` relation) and a `select` block (for scalar fields). Prisma does not allow both `include` and `select` on the same query.
- **Fix/countermeasure:** Replaced the query with a single `select` block that explicitly names only the required scalar fields and includes a filtered `collaborators` sub-select:
  ```js
  select: {
    id: true,
    tableNumber: true,
    status: true,
    primaryWaiterId: true,
    archivedAt: true,
    servedAt: true,
    createdAt: true,
    updatedAt: true,
    collaborators: {
      where: { waiterId: req.user.id },
    },
  },
  ```
- **Why this fix:** `select` gives fine-grained control over exactly which fields are fetched, which is preferable for a security-critical middleware that runs on every order-scoped request. Moving the collaborator check into a `where` clause on the sub-select (`where: { waiterId: req.user.id }`) achieves the same access check without needing an `include`. The resulting object is then manually reshaped in `req.order` to exclude internal fields.
- **Verification:** Test 03 authz matrix passed without Prisma validation errors. Order-access checks correctly identified managers, primary waiters, and collaborators.
- **Status:** Fixed

---

### BUG-004 — Test helpers `transitionTo` and `cancel` declared `async`, breaking `.expect()` chaining

- **Found in:** Test 04 (state machine)
- **Observed:** State machine transition tests failed because `.expect()` calls on the return value of `transitionTo` and `cancel` did not resolve as expected. The test assertions ran before the HTTP response was received.
- **Root cause:** The test helper functions were declared `async`:
  ```js
  async function transitionTo(agent, orderId, toStatus) {
    return agent.patch(`/api/orders/${orderId}/status`).send({ status: toStatus });
  }
  ```
  `async` makes the function return a `Promise` wrapping the Supertest request object. Calling `.expect()` on the `Promise` instead of the request object means the assertion runs on the resolved promise value (the response), not on the chained request — causing the test to receive the response without applying the `.expect()` assertion.
- **Fix/countermeasure:** Removed `async` from both `transitionTo` and `cancel` helper functions so they return the Supertest `ChainedRequest` object directly. Supertest's `.expect()` attaches an assertion to the request chain, which executes when the request completes.
- **Why this fix:** `async` was added to the helpers perhaps to handle some other async operation, but neither helper performs any `await` — they just construct and return a request. Removing `async` is the minimal correct fix. Supertest's chaining is designed to work synchronously through the chain-building phase; only the terminal `.then()` or `.expect()` is async.
- **Verification:** Test 04 state machine tests passed with correct 200/409 assertions on every transition after the fix.
- **Status:** Fixed

---

### BUG-005 — Test 08 used wrong Prisma relation name (`history` instead of `historyEntries`)

- **Found in:** Test 08 (immutable history)
- **Observed:** Test 08 failed because its Prisma query used `history` as the relation name on the `Order` model, but the actual Prisma schema defines the relation as `historyEntries`.
- **Root cause:** The test was written with the assumption that the Prisma relation on `Order` for history entries would be named `history`. However, the Prisma schema defines it as `historyEntries` (the field name in `schema.prisma`).
- **Fix/countermeasure:** Updated all references in Test 08 from `history` to `historyEntries` to match the actual Prisma schema. Used `historyEntries: { some: {} }` in `findFirst` queries and `findUnique` references.
- **Why this fix:** Prisma generates relation names from the field names in `schema.prisma`. The field is defined as `historyEntries  OrderHistoryEntry[]` on the `Order` model, so the relation accessor is `order.historyEntries`, not `order.history`. The test must match the actual schema, not an assumed name.
- **Verification:** Test 08 passed after correcting the relation name.
- **Status:** Fixed

---

### BUG-006 — Terminal-status transitions updated a non-existent Alert, causing Prisma P2025 errors

- **Found in:** Test 04 (state machine) and Test 11 (alerts)
- **Observed:** When transitioning an order to a terminal status (READY/SERVED/CANCELLED), Prisma threw error `P2025 — Record to update not found` if the order had no associated Alert record. The cascade of P2025 failures caused cascading test failures in Test 04 and Test 11.
- **Root cause:** The status-change handler unconditionally called `prisma.alert.update(...)` after a terminal transition without checking whether an unresolved alert existed for that order. When no alert row existed, Prisma raised P2025 because the `where` clause matched zero rows.
- **Fix/countermeasure:** Updated the status-change handler to update the order first, then query for an unresolved alert and update it only if one exists:
  ```js
  const updated = await prisma.order.update({ where: { id: order.id }, data: updateData });
  if (resolveAlert) {
    const alert = await prisma.alert.findFirst({ where: { orderId: order.id, resolvedAt: null } });
    if (alert) {
      await prisma.alert.update({ where: { id: alert.id }, data: { resolvedAt: new Date() } });
    }
  }
  ```
- **Why this fix:** An alert is created by a background job when an order exceeds the time threshold — not every order has an alert. Attempting to update a non-existent row is a logic error, not a data error. The fix separates the state update (which must always happen) from the alert resolution (which only happens when an alert is present), making the code correct by construction.
- **Verification:** Test 04 state machine tests (including terminal transitions) and Test 11 alert lifecycle tests both passed without P2025 errors after the fix.
- **Status:** Fixed

---

### TEST-SUITE-001 — Test database used wrong Supabase pooler port, causing connection resets

- **Found in:** Test infrastructure / all M10 test suites
- **Observed:** Integration tests experienced intermittent connection resets, timeouts, and `ECONNREFUSED` errors when running against the Supabase test database. Tests would hang mid-request or fail with pool-exhaustion errors.
- **Root cause:** The test harness was configured to connect to Supabase's **Transaction Pooler** port (6543) instead of the **Session Pooler** port (5432). Supabase's transaction pooler is designed for short-lived transactions and does not support PostgreSQL features that Persistify (session state, prepared statements) — which Prisma relies on for connection management. The Prisma client uses long-lived session features that are incompatible with the transaction pooler.
- **Fix/countermeasure:** Changed `DATABASE_URL` in the test configuration to use the Supabase Session Pooler port (5432), matching the standard PostgreSQL port. `DIRECT_URL` (used by Prisma Accelerate or direct connections for migrations) remained on the correct port. For the test harness, the Session Pooler is appropriate since tests run as individual requests rather than pooled transactions.
- **Why this fix:** Supabase's transaction pooler is incompatible with Prisma's connection model. The Session Pooler (port 5432) properly handles Prisma's connection behavior. This is a Supabase-specific infrastructure detail, not a bug in the application or test code. Classified as a test/infrastructure configuration issue, not a proven Supabase bug.
- **Verification:** All 13 test suites ran to completion without connection errors after switching to the Session Pooler port.
- **Status:** Fixed (configuration)

---

### BUG-007 — Dashboard revenue calculated from `unitPrice` instead of `quantity * unitPrice`

- **Found in:** Test 12 (dashboard)
- **Observed:** Dashboard revenue metric was significantly understated. The revenue figure appeared to be summing only the unit price of each active line rather than the line total (unit price × quantity).
- **Root cause:** The revenue calculation in `dashboard.js` used only `unitPrice` per line instead of `quantity * unitPrice`. For seeded orders where each line has a quantity > 1, this caused the revenue to be a fraction of the correct value.
- **Fix/countermeasure:** Updated the revenue calculation in `dashboard.js` to multiply `quantity * unitPrice` for each active line:
  ```js
  const revenueToday = revenueLines.reduce(
    (sum, l) => sum + Number(l.unitPrice) * l.quantity,
    0
  );
  ```
  The same correct formula was already used in `export.js` and the 14-day chart revenue calculation — it was missed in the initial dashboard revenue computation.
- **Why this fix:** Revenue is defined as the sum of line totals (price per item × quantity). Using only `unitPrice` undercounts every multi-item line. The fix aligns the calculation with the definition of revenue and with how the same computation is done elsewhere in the codebase.
- **Verification:** Test 12 dashboard revenue test passed after correcting the calculation. The revenue value now matches the sum of `quantity * unitPrice` over all active lines on today's orders.
- **Status:** Fixed

---

### BUG-008 — State machine `cancel_too_late` and `no_op` checks fired before `terminal_status` check, misclassifying terminal-state cancel attempts

- **Found in:** Test 05 (cancellation cutoff)
- **Observed:** Two assertions in Test 05 failed: `SERVED → CANCELLED` returned `reason: 'cancel_too_late'` instead of `'terminal_status'`, and `CANCELLED → CANCELLED` returned `reason: 'no_op'` instead of `'terminal_status'`. HTTP status codes (409) were correct; only the reason label in `details.reason` was wrong.
- **Root cause:** In `backend/src/stateMachine.js`, `assertValidTransition` performed the checks in this order: (1) `from === to` → `no_op`, (2) `to === 'CANCELLED' && !['PLACED', 'ACCEPTED'].includes(from)` → `cancel_too_late`, (3) `['SERVED', 'CANCELLED'].includes(from)` → `terminal_status`. Because the `cancel_too_late` check did not exclude terminal source states, it fired for `SERVED → CANCELLED` before the `terminal_status` check ran. The `no_op` check fired for `CANCELLED → CANCELLED` before any other classification could apply. The M5 unit test at `tests/stateMachine.test.js:229` documents the intended ordering: `"SERVED is terminal — terminal_status reason takes precedence over backward_transition"` — meaning `terminal_status` is meant to take precedence over every other reason classification when the source state is terminal.
- **Fix/countermeasure:** Two minimal guards in `stateMachine.js`:

  1. Excluded terminal source states from the `cancel_too_late` branch:
     ```js
     if (
       to === 'CANCELLED' &&
       !['PLACED', 'ACCEPTED'].includes(from) &&
       !['SERVED', 'CANCELLED'].includes(from)
     ) {
       reason = 'cancel_too_late';
       ...
     }
     ```
  2. Excluded terminal source states from the `no_op` early-throw, so that `CANCELLED → CANCELLED` falls through to the `terminal_status` branch:
     ```js
     if (from === to && !['SERVED', 'CANCELLED'].includes(from)) {
       throw AppError.CONFLICT(`Order is already in status ${from}`).withDetails({ ..., reason: 'no_op' });
     }
     ```
  Non-terminal self-transitions (`PLACED → PLACED`, `ACCEPTED → ACCEPTED`, `PREPARING → PREPARING`, `READY → READY`) still classify as `no_op` because the `terminal_status` branch at line 103 only fires for `from` in `['SERVED', 'CANCELLED']`. The M5 unit test at `tests/stateMachine.test.js:281` (`PLACED → PLACED` expects `no_op`) is preserved.
- **Why this fix:** The M5 specification (`docs/plan.md` Milestone 5, line 96) defines the reason categories and the M5 unit tests at `tests/stateMachine.test.js:223–232, 255–263, 265–273` explicitly require `terminal_status` for every transition originating from a terminal state, including cancel attempts. The integration tests in Test 05 align with that contract. The two targeted guards are the minimal change that resolves both Test 05 failures without altering the classification of any non-terminal transition.
- **Verification:** Both Test 05 assertions now pass: `SERVED → CANCELLED` classifies as `terminal_status` and `CANCELLED → CANCELLED` classifies as `terminal_status`. The four pre-existing passing assertions (PLACED → CANCELLED, ACCEPTED → CANCELLED, PREPARING → CANCELLED, READY → CANCELLED) continue to pass. The M5 unit test at `tests/stateMachine.test.js:281` (`PLACED → PLACED` expects `no_op`) is preserved because the `no_op` guard only excludes terminal source states.
- **Status:** Fixed

---

### TEST-SUITE-002 — Test 07 cleanup tried to delete a menu item with active order lines (FK violation)

- **Found in:** Test 07 (historical pricing)
- **Observed:** Both Test 07 tests failed in the cleanup phase with `PrismaClientKnownRequestError: Foreign key constraint violated: 'order_lines_menu_item_id_fkey (index)'`. The actual price-snapshot assertions all passed; the failure was in the `prisma.menuItem.delete(...)` call at the end of each test.
- **Root cause:** Each Test 07 case creates a menu item, creates an order that adds a line to that menu item, and then attempts to delete the menu item directly. The `order_lines.menu_item_id` foreign key is a non-nullable relation, so deleting a menu item that has associated order lines is rejected by Postgres. The test's cleanup logic did not account for the cascading relationship.
- **Fix/countermeasure:** Updated the cleanup in `backend/tests/07-historical-pricing.test.js` to delete the test orders first (using `prisma.order.delete`), which cascades to their `order_lines`, releasing the FK lock on the menu item. The menu item is then deleted. The cleanup is scoped by the unique `tableNumber` value used in each test:
  ```js
  const testOrders = await prisma.order.findMany({
    where: { tableNumber: 'SNAPSHOT' },
    select: { id: true },
  });
  for (const o of testOrders) {
    await prisma.order.delete({ where: { id: o.id } });
  }
  await prisma.menuItem.delete({ where: { id: menuItem.id } });
  ```
- **Why this fix:** Postgres enforces FK constraints on the database side. The application cannot delete a menu item that has order lines attached — those lines reference it. The schema's `onDelete` rule for `order_lines.menu_item_id` is `Restrict` (the default) which is the right production behavior (you cannot delete a menu item that is part of any order's history). For tests, the clean way to remove the menu item is to remove the referencing order first; deleting the order cascades to its lines.
- **Verification:** Both Test 07 tests pass after the cleanup fix. The price-snapshot assertions are unaffected; only the cleanup logic changed.
- **Status:** Fixed

---

### TEST-SUITE-003 — Test 10 `include_archived=true` assertion checked page 1, but seeded archived order sits on page 4

- **Found in:** Test 10 (order search)
- **Observed:** Test 10's "archived orders are included when include_archived=true" assertion failed with `expected false to be true` because the first page (default `page=1&limit=20`) did not contain any order with `archivedAt !== null`.
- **Root cause:** The `GET /api/orders` route sorts by `createdAt desc` by default, so the most recently created orders come first. After running prior tests (01–09), the test database accumulated ~300 orders created at the current test run's wall-clock time. The seeded archived order (table 7, `createdAt` 3 hours before the seed run) is therefore on the *last* page of results, not the first. The default page (1, limit=20) contains only freshly-created test orders, none of which are archived. The application behavior is correct: `include_archived=true` does include the archived order in the *total* count (319 → 320) and the order is reachable via pagination. The test's assertion only inspected the first page.
- **Fix/countermeasure:** Updated the test in `backend/tests/10-order-search.test.js` to read the total count first (using `limit=1` to minimise data transfer), compute the last page number (`Math.ceil(total / 20)`), and then request that page. This makes the test stable regardless of how many test orders accumulate during the run. The seeded archived order (table 7) is always on the last page because results are sorted `createdAt desc` and it is older than all freshly-created test orders. No application code changed.
- **Why this fix:** A fixed page number (e.g. `page=4`) is not stable — each test run that creates orders pushes the archived order further back. Computing the last page from the total count is deterministic and self-correcting. Using `limit=1` for the total query is the most efficient way to retrieve just the count without fetching data rows.
- **Verification:** Test 10 passed after the test fix. All 15 Test 10 tests now pass.
- **Status:** Fixed

---

## M11 — Deployment + Smoke Test

No bugs were introduced in M11. The milestone is purely declarative (YAML/JSON config + documentation); no application code was changed, so the existing 242 backend tests and `npm run build` continue to pass unchanged. The pre-existing `/api/health` endpoint (added in M1) is reused for the Render health check; no new endpoint or middleware was added. `git status` confirms only the 7 intended files were touched (4 new: `render.yaml`, `vercel.json`, `DEPLOY.md`, `frontend/.env.example`; 3 modified: `backend/.env.example`, `docs/plan.md`, `SUBMISSION.md`).
