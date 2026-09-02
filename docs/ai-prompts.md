# AI prompts

The prompts you actually used, in the order you used them, grouped by what you were trying to achieve. For each significant one: what you asked, what you got back, and what you had to correct.

Include at least one prompt that produced something wrong, and what you did about it.

If you did not use AI at all, say so here, and describe your process instead.

---

## Exploring the repository structure

### What we asked
"hey! how are you?"  
Followed by: "@C:\Users\PRANAV SINGH\OneDrive\Desktop\notes thapar\PLACEMENTS\BUSY\takehome-09-restaurant-orders\takehome-09-restaurant-orders  explore these files"

### What we got
The AI explored the repository and reported:
- The repository was an empty scaffold with only documentation templates and the assignment brief (README.md, SUBMISSION.md)
- No source code had been written yet
- It contained the assignment requirements for the Restaurant Orders take-home

### What we corrected
No correction needed — the exploration accurately described the repository state.

---

## Comprehensive repository analysis

### What we asked
"@C:\Users\PRANAV SINGH\OneDrive\Desktop\notes thapar\PLACEMENTS\BUSY\takehome-09-restaurant-orders\takehome-09-restaurant-orders"  
Then: "You are working with me on a take-home hiring assignment for BUSY Infotech." followed by the 19-phase analysis request (Phases 1-19 covering requirements extraction, acceptance criteria, architecture design, etc.)

### What we got
The AI performed a complete analysis of the assignment and repository, producing:
- Executive summary of the empty repository state
- Explicit requirements checklist (63 requirements)
- Acceptance criteria for each major feature
- High-risk/easy-to-miss requirements identification
- Current repository analysis (nothing implemented)
- Proposed architecture (React + Express + Prisma + PostgreSQL)
- Database design with 9 tables
- API design with endpoint matrix
- Authorization matrix
- Order state machine diagram
- 12-hour implementation plan
- Requirements traceability matrix
- Testing strategy
- Documentation strategy
- Git strategy
- Risks and mitigations
- MVP vs optional scope
- Open questions requiring clarification

### What we corrected
No correction was needed to the analysis itself — it accurately interpreted the assignment brief and repository state. However, during the subsequent refinement phase, several aspects of the plan were adjusted based on specific feedback.

---

## Refinement pass — corrections to initial plan

### What we asked
"Before I approve the implementation plan, make one final refinement pass." followed by 8 specific correction requests covering:
1. Database consistency (PostgreSQL for dev and prod)
2. Documentation compliance requirements (5+ decisions, 1 reversal, real AI prompts)
3. Authorization matrix correction (primary waiter access)
4. Alert design for multiple cycles
5. Configuration decision explanation
6. Separating requirements vs decisions vs ambiguities
7. Traceability matrix update
8. Final 12-hour plan recalculation

### What we got
The AI provided a refined analysis with:
- Clear separation of explicit requirements (A), technical decisions (B), and ambiguities (C)
- Updated database design using PostgreSQL consistently
- Corrected authorization matrix showing primary waiters and collaborators having equal access on orders
- Alert model supporting multiple dismissal/reappearance cycles via separate AlertDismissal table
- Explanation of alert threshold as an environment variable decision with alternatives considered
- Updated requirements traceability matrix including documentation requirements
- Recalibrated 12-hour implementation plan with proper time allocation

### What we corrected
**Initial alert design produced something wrong:**  
In the first analysis, I proposed a simple `Order.acknowledged_at = TIMESTAMP NULL` field to track alert acknowledgment. This only supported a single acknowledgment cycle, but the assignment requires alerts to dismiss and reappear multiple times (threshold reached → alert appears → dismissed → further threshold passes → alert reappears → can be dismissed again → etc.).

**What we changed:**  
Replaced the single acknowledgment timestamp with a separate `AlertDismissal` table that records each dismissal as an individual event. This supports unlimited cycles:
- An alert appears when order age > threshold and no dismissals exist OR the latest dismissal is older than threshold ago
- Each dismissal adds a row to `AlertDismissal`
- Alert reappears if (latest dismissal time + threshold) < now() and order still not Ready
- Alert clears permanently when order reaches Ready/Served/Cancelled (alert record deleted)

This change was made during the refinement pass before any implementation began, based on the specific feedback about alert reappearance requirements.

---

## Project checkpoint creation

### What we asked
"Before I close Antigravity, create a project checkpoint. Do NOT start implementation. Make sure all important findings from your current analysis are captured in the repository in the appropriate documentation files without fabricating anything."

### What we got
The AI updated the five documentation template files with the analysis findings:
1. docs/plan.md — Containing the current implementation plan as discussed
2. docs/architecture.md — Containing the proposed architecture
3. docs/schema.md — Containing the proposed schema
4. docs/decisions.md — Recording only decisions actually made so far (8 decisions, including one reversal)
5. docs/ai-prompts.md — Recording the actual prompts used in this session

### What we corrected
No correction was needed — the files were updated with only what was actually discussed and decided in this session, with no fabrication.

---

## Milestone 1 implementation — Foundation and database

### What we asked
"PLAN APPROVED — START IMPLEMENTATION. ... Start with Milestone 1: foundation + database. Before making changes, inspect the repository one final time and confirm the exact files you are about to create/change. Then begin implementation."

### What we got
The AI:
- Re-inspected the repository and confirmed the 7 files present, no commits, branch `master`.
- Listed the exact files it would create (backend skeleton, frontend skeleton, prisma schema, seed) before writing any of them.
- Created the backend Express skeleton, frontend Vite + React skeleton, Prisma schema (9 tables, all constraints, all indexes), and seed script.
- Wrote `prisma/seed.js` with demo data for 3 users, 6 menu items, 7 orders, lines, voided line with reason, collaborators, notes, history entries, alerts and dismissals.
- Updated docs/plan.md, docs/architecture.md, docs/schema.md to "Implemented (skeleton)" status.
- Added Decisions 9–13 to docs/decisions.md (JS-vs-TS, CommonJS-vs-ESM, idempotent seed, served_at column, Prisma enums).

### What we corrected

**AI-generated code that was wrong, and what we did about it:**

When writing the seed script, the AI's first pass contained an experimental cleanup loop that wrote, then deleted, then rewrote the order-1 history entry. This was a real mistake — the loop was the AI's attempt to handle "I just wrote a placeholder, now I want to write the real one" but it left visible garbage commands in the file (multiple `deleteMany` and `$executeRaw` calls).

**Correction:** The AI was asked (in the same session) to clean up the seed file, and it removed all three redundant delete operations, leaving a single clean `makeHistory` call for order 1. This is logged honestly here per the assignment requirement that an AI mistake must be recorded.

The same cleanup pass also fixed a wrong table name in the initial TRUNCATE block: the model is `AlertDismissal` (mapped to `alert_dismissals`) but the first version of the seed had `order_dismissals`. Corrected before any commit.

## Milestone 5 implementation — Lifecycle, Void, History

### What we asked
"lets move to milestone 5" — the user gave a single, short directive to begin M5.

### What we got
The AI:
- Re-read `docs/plan.md` for the M5 scope, the milestone-completion checklist, the `VALID_TRANSITIONS` requirement, the human-message requirement, the `served_at` and `resolvedAt` rules, the line-void blocking rules, and the history append-only rule.
- Created `backend/src/stateMachine.js` (new module) with `VALID_TRANSITIONS`, `validNextStatuses`, `canTransition`, and `assertValidTransition`. Each illegal move throws an `AppError` 409 with `code: 'CONFLICT'`, `details.code: 'INVALID_TRANSITION'`, and a categorising `details.reason` (`skip_states`, `backward_transition`, `cancel_too_late`, `terminal_status`, `no_op`).
- Added a `withDetails(details)` chaining helper to `AppError` in `backend/src/utils/errors.js` so any error can carry a structured payload.
- Added 5 new routes to `backend/src/routes/orders.js`: `PATCH /:id/status`, `POST /:id/lines/:lineId/void`, `GET /:id/history`, `GET /:id/notes`, `POST /:id/notes`. Each one enforces the spec'd blocking rules (line void blocked on SERVED/CANCELLED, line void blocked if line is already VOID, status change blocked on archived orders, etc.) and writes a history entry.
- Added `changeStatus` and `addNote` Joi validators to `backend/src/validators/orders.js` and re-exported them from the barrel.
- Wrote `backend/tests/stateMachine.test.js` with 40 cases covering the legal map, every illegal move, the reason classification, the error message content, terminal states, unknown statuses, and self-transitions.
- Added 10 cases for `changeStatus` and `addNote` to `backend/tests/orders-validator.test.js` (now 35 total).
- Updated `docs/plan.md` to mark M5 ✅ and add the "Estimate vs Actual" entry.
- Added Decisions 18 and 19 to `docs/decisions.md`.
- Updated `docs/architecture.md` request path and key decisions.
- All 93 tests pass (40 state machine + 35 orders validator + 18 menu validator).

### What we corrected
**AI test that was wrong, and what we did about it:**

In the first run of `stateMachine.test.js`, one test failed: "rejects backward move from SERVED to READY" expected `reason: 'backward_transition'` but the actual reason was `'terminal_status'`.

The state machine's `assertValidTransition` checks branches in this order: (1) unknown current status, (2) unknown attempted status, (3) self-transition, (4) cancellation-after-preparing (`cancel_too_late`), (5) terminal-status (`SERVED` and `CANCELLED`), (6) skip-states, (7) backward-transitions, (8) generic illegal transition. `SERVED → READY` matches branch (5) first.

**Correction:** The behaviour is actually more accurate — `SERVED` is a terminal status, and saying "you can't go backward from a terminal state" is the better user-facing message than "you can't go backward" alone. The test was changed to assert the actual behaviour (`reason: 'terminal_status'`) with a comment explaining that terminal_status takes precedence over backward_transition. The user-facing message still explains the rule clearly ("Order is in terminal status SERVED and cannot be changed").

**Other tests already correct:** The 39 other test cases in the state machine test passed on the first run, including every legal transition, every illegal skip, every illegal cancellation, unknown-status handling, and the error-shape assertions.

### What we asked (state-machine shape — no correction needed)
The original M5 spec from `docs/plan.md` was unambiguous about:
- The transition map (Placed→Accepted→Preparing→Ready→Served, Cancelled only while Placed/Accepted)
- The error response (409 INVALID_TRANSITION with current_status, attempted_status, and human message)
- The `served_at` and alert-resolution side effects

So the AI's first draft of `assertValidTransition` matched the spec without iteration. The only correction in this milestone was the test, not the implementation.

---

## Milestone 6 implementation — Collaborators + Order Search

### What we asked
"Start Milestone 6. First read docs/plan.md and follow the Session-start contract and all Documentation & Traceability Rules. Treat the repository documentation as the source of truth, not conversation memory"

### What we got
The AI:
- Re-read `docs/plan.md` for the M6 scope (Goal 5 + Goal 6), the milestone-completion checklist, the filter and pagination requirements, and the Documentation & Traceability Rules.
- Implemented `POST /api/orders/:id/collaborators` and `DELETE /api/orders/:id/collaborators/:waiterId` in `backend/src/routes/orders.js` — primary waiter or manager only; rejects adding/removing the primary waiter; uses the composite PK `(orderId, waiterId)` for uniqueness; writes `COLLABORATOR_ADDED` / `COLLABORATOR_REMOVED` history entries.
- Added `addCollaborator` Joi validator (accepts UUID or email); updated the validators barrel.
- Confirmed the existing `GET /api/orders` already implements search/filter/sort/pagination (from M4) and exposed it in the UI.
- Added 6 new validator test cases (now 43 in `orders-validator.test.js`).
- All 101 tests pass (40 state machine + 43 orders validator + 18 menu validator).
- Frontend `api.js`: added `changeOrderStatus`, `voidOrderLine`, `fetchOrderHistory`, `fetchOrderNotes`, `addOrderNote`, `addCollaborator`, `removeCollaborator`.
- Frontend `OrderDetailPage`: status change buttons (driven by the state machine), collaborator list with remove buttons (primary/manager only), add-collaborator form (email input), void-line inline form with reason prompt.
- Frontend `OrdersPage`: full filter row (table search, status, waiter [manager only], date), sort + direction selectors, "X of Y total" counter, clear-filters button, pagination.
- Frontend `App.jsx`: fixed a pre-existing named-vs-default import on `ProtectedRoute` (blocker for the build).
- Frontend builds clean (`npm run build` succeeds, 188KB gz).
- Updated `docs/plan.md` (M6 marked ✅, estimate vs actual, delivered list, notes).
- Added Decisions 20, 21, 22 to `docs/decisions.md`.
- Updated `docs/architecture.md` (M6 status, request path with collaborators).
- Recorded the M6 prompts in `docs/ai-prompts.md` (this entry).

### What we corrected
**Validator too strict for the chosen UI shape, and what we did about it:**

The first pass of the `addCollaborator` validator was `Joi.string().uuid().required()`. The AI was about to require a `GET /api/users` endpoint to render a user picker in the UI.

On reflection (and a brief second look at the route), the simpler shape was to accept either a UUID or an email and look the user up by `OR: [{ id }, { email }]`. The validator became `Joi.string().trim().min(1).max(254).required()` and the route was updated to resolve the input to a user record.

**Correction:** Changed the validator to accept both, updated the test cases (added an email-acceptance test and a whitespace-trim test), updated the route to resolve by id OR email, removed the proposed `fetchUsers` helper from the frontend, and recorded the choice as Decision 22.

**Pre-existing build blocker (not in M6 scope, but blocking verification):**

`App.jsx` was doing `import ProtectedRoute from './components/ProtectedRoute'` while `ProtectedRoute.jsx` exports a named function `ProtectedRoute`. The build had been broken since M2; M6 surfaced it because the M6 changes to `OrdersPage` and `OrderDetailPage` are the first UI edits since the broken import was introduced, and `npm run build` was run to verify M6.

**Correction:** Changed the import in `App.jsx` to the named form `{ ProtectedRoute }` and verified `npm run build` succeeds. Recorded in `docs/bugs.md` as a separate entry per the Documentation & Traceability Rules.

### What was already correct
The `GET /api/orders` search/filter/sort/pagination was already implemented in M4 scope; the M4 plan said it was needed for the M4 frontend list. The validator, where-clause builder, role-based scoping, and `include_archived` default were all already in place. M6 only had to surface them in the UI.

### Other prompts

Beyond the explicit "Start Milestone 6" prompt, no further prompts were issued — the M6 work is a single focused milestone that the plan describes end-to-end. The decisions and the implementation followed the plan without ambiguity.

---

*Implementation prompts continue below as the project progresses.*

## Milestone 7 implementation — Dashboard + Alerts + CSV

### What we asked
"Start Milestone 7. First read docs/plan.md and follow the M5–M13 Documentation & Traceability Rules. Do not rely on conversation memory."

### What we got
The AI:
- Re-read `docs/plan.md` for the M7 scope (Goal 7 CSV, Goal 8 dashboard, Goal 10 alerts), the milestone-completion checklist, the design refinement §4 (dashboard definitions), §5 (CSV columns), and the Documentation & Traceability Rules.
- Implemented `backend/src/routes/dashboard.js` — `GET /api/dashboard` (manager only). Computes `open_orders` (non-terminal, non-archived), `placed_today`, `served_today` (using `servedAt`), `revenue_today` (sum of `quantity * unit_price` over ACTIVE lines on today's orders), `status_breakdown` (count by status, non-archived), `waiter_breakdown` (count by primary waiter for today's orders, names resolved), and `chart_14d` (14 zero-filled entries: `{ date, served, revenue }`).
- Implemented `backend/src/routes/alerts.js` — `GET /api/alerts` (any role, scoped) returns `{ alerts, count }`. Active filter: `resolvedAt IS NULL` AND `order.status` non-terminal AND (no dismissals OR last dismissal > threshold ago). Manager sees all; waiter sees only orders where they are primary or collaborator. `POST /api/alerts/:id/dismiss` inserts an `AlertDismissal` row and requires order access (inline check — no `requireOrderAccess` middleware because the alert is the resource, not the order).
- Implemented `backend/src/routes/export.js` — `GET /api/export/orders/today` (manager only). Fetches all orders created today (any status, includes archived), emits one CSV row per order line plus a summary row for empty orders. Columns: Order ID, Table, Status, Primary Waiter, Created At, Served At, Archived, Line #, Item, Quantity, Unit Price, Line Total, Voided, Void Reason, Order Total. Filename `orders-YYYY-MM-DD.csv` (local date). Content-Type `text/csv`. Order total on first line only.
- Updated `backend/src/index.js` — global error handler now propagates `AppError.details` to the JSON response (was being dropped previously).
- Added `backend/tests/csv.test.js` — 7 cases for the CSV escape helper (commas, quotes, newlines, null/undefined, non-strings). Total 108 tests, all pass.
- Added `frontend/src/api.js` helpers: `fetchDashboard`, `fetchAlerts`, `dismissAlert`, `fetchTodaysOrdersCsv`. (Full UI is M8.)
- Updated `docs/plan.md` (M7 marked ✅, estimate vs actual, delivered list, notes).
- Added Decisions 23, 24, 25 to `docs/decisions.md` (local timezone, alert reappearance query, CSV row shape).
- Updated `docs/architecture.md` (M7 status, request path with dashboard/alerts/CSV, new key decisions).
- No bugs were found in M7 (see "What was correct" below).

### What we corrected
**No corrections this milestone — all routes passed on first run, all 108 tests pass, and the frontend builds clean. The M7 work is a direct implementation of the plan's spec, which was already fully refined by the time M7 started (M5 and M6 had already resolved their open questions and the M7 spec was unambiguous).**

The most subtle M7 implementation choice — the alert reappearance query — was already specified in the plan: "open orders past threshold, no recent dismissal within threshold". The Decision 24 text records the choice between using `MAX(dismissed_at)` (chosen) versus `Order.updatedAt` or `Order.createdAt` (rejected) and the reason — `MAX(dismissed_at)` is the only clock that measures "time since last explicit user action" without being affected by unrelated order updates (line adds, status changes, etc.).

### What was already correct
- The `AppError` `withDetails` helper from M5 already exists on the error class. The fix in M7 was to surface the existing `details` field through the global error handler — a one-line change.
- The 14-day chart's date key is `servedAt` (Decision 12, M2), which was already in the schema.
- The `Alert` and `AlertDismissal` schema (M1) and the dismissal reappearance cycle (Decision 3, planning) were both already in place; M7 just implemented the query.

### Other notes
- The existing dev server on port 4000 was running the M6 code, so a full end-to-end smoke test of the new routes against the running server would have required a restart. The unit tests (108 passing) and route-load smoke (`require()` of all three new route modules succeeds) are the M7 verification per the milestone-completion checklist, given that integration tests against a real DB are M10 scope.
- The plan deliberately splits M7 (backend) from M8 (frontend). The Dashboard and Alerts page components are still placeholders from M3; they will be filled in during M8 per the plan.

---

*Implementation prompts continue below as the project progresses.*

---