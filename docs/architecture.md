# Architecture

Answer each of these, in your own words, once the system has taken real shape.

- What are the moving pieces, and how do they talk to each other?
- Where does each piece run?
- What is the request path for one representative user action, end to end?
- What did you decide *not* to build, and why?

## Moving Pieces

The system is a three-tier application:

1. **Frontend (React + Vite)** — Runs in the user's browser. Renders all UI, manages client-side state, and communicates with the backend via HTTPS requests using JSON. Authenticated requests include a JWT token in an httpOnly cookie for authorization.

2. **Backend (Express.js + Prisma)** — Runs on Render (free tier). Exposes a REST API. Handles authentication, authorization, business logic (order state machine, alert detection, historical pricing), and data access via Prisma ORM. All stateful logic — including filtering, sorting, and pagination — runs here, never in the browser.

3. **Database (PostgreSQL)** — Runs on Supabase (free tier, hosted PostgreSQL). Stores all persistent data: users, menu items, orders, order lines, collaborators, history entries, notes, and alert dismissals.

## Communication

- Browser → Backend: HTTPS + REST (JSON). Auth via JWT in httpOnly cookie.
- Backend → Database: PostgreSQL via Prisma client.
- No real-time updates (no WebSockets) — the assignment's polling model is sufficient for a 12-hour take-home.

## Where Each Piece Runs

| Component | Runtime Location |
|-----------|-----------------|
| React frontend | Browser (Vercel-hosted static + dynamic) |
| Express backend | Render (Node.js process) |
| PostgreSQL | Supabase (managed PostgreSQL) |
| Prisma migrations | Run during backend setup, applied to Supabase |

## Request Path — Representative Action

**Example: Waiter places an order for table 5 with two lines, then the kitchen accepts it.**

1. **Login:** The waiter navigates to the app, enters email/password. The browser POSTs to `/api/auth/login`. The backend validates credentials against the bcrypt-hashed password in the `users` table, generates a JWT, and returns it in an httpOnly, SameSite=Strict cookie. The frontend stores the decoded user in React context.

2. **Create order:** The waiter fills out the order form (table number, no lines yet). The browser POSTs to `/api/orders`. The auth middleware extracts the JWT, verifies it, and attaches the user to the request. The authorization middleware confirms the user's role is WAITER (or MANAGER). The order is inserted with `status = 'PLACED'` and `primary_waiter_id = user.id`. A history entry is created (`STATUS_CHANGE`, PLACED). The order ID is returned.

3. **Add lines:** The waiter selects menu items and quantities. For each line, the browser POSTs to `/api/orders/:id/lines`. The auth middleware confirms the user is the primary waiter, a collaborator, or a manager. The backend reads the current price from the `menu_items` table and stores it as `unit_price` on the `order_lines` row (snapshot, not a reference). A history entry is created (`LINE_ADDED`). The running total is recalculated server-side.

4. **Accept order:** The waiter clicks "Accept". The browser PATCHes to `/api/orders/:id/status` with `{ status: 'ACCEPTED' }`. The state machine validates the transition PLACED → ACCEPTED, updates the order, and creates a history entry with old and new status and the actor's ID. The response returns the updated order.

5. **Render:** The order detail page re-renders, showing the new status badge and the updated timeline.

## What Was Deliberately Not Built

The following are explicitly out of scope for this submission:

- **Kitchen display screen** — Stretch idea, not a mandatory goal.
- **Table-side ordering from handheld** — Stretch idea.
- **Split checks** — Stretch idea.
- **Loyalty/repeat-customer program** — Stretch idea.
- **Ingredient-level stock deduction** — Stretch idea.
- **Reservation/table management** — Stretch idea.
- **Printable/e-mailed receipts** — Stretch idea.
- **Happy-hour/time-of-day pricing** — Stretch idea.
- **Multi-location with per-location pricing** — Stretch idea.
- **Real-time notifications** — Polling the API is sufficient; WebSockets would add deployment complexity (e.g., Redis) that is not justified within the 12-hour budget.
- **Server-side rendering** — The assignment does not require SSR; client-side rendering is simpler and equally functional.
- **Mobile native app** — Responsive web is the minimum viable approach for the browser-side requirement.

## Key Architectural Decisions

- **REST over GraphQL:** Simpler to implement and test within 12 hours; endpoints map directly to assignment requirements.
- **JWT cookies over sessions:** Stateless, simple to deploy (no server-side session store), and httpOnly cookies prevent XSS-based token theft.
- **Server-side filtering/pagination:** The assignment explicitly requires it ("do not load every order into the browser and filter there"), so all aggregation happens in the SQL query.
- **Append-only history:** The `order_history_entries` table has no UPDATE or DELETE endpoint. Immutability is enforced by never exposing such endpoints in the API. Same applies to `order_notes` (no edit/delete).
- **Historical pricing via snapshot:** The `order_lines.unit_price` column stores the price at the moment the line is added, independent of any future price changes to `menu_items`.
- **Database-backed authorization matrix:** The actual access-control rules are expressed in the authorization matrix (see docs/decisions.md) and enforced in Express middleware, not hidden in the frontend.
- **State machine as a dedicated module:** All legal order status transitions are encoded in a single `VALID_TRANSITIONS` map in `backend/src/stateMachine.js`. Every endpoint that changes order status calls `assertValidTransition(from, to)`, which throws a uniform `AppError 409` with `code: INVALID_TRANSITION` on illegal moves. The `reason` field categorises the violation (`cancel_too_late`, `skip_states`, `backward_transition`, `terminal_status`, `no_op`). This keeps the rule auditable in one place and testable in isolation from the routes.
- **Standardised history details JSONB shape:** Each `order_history_entries.details` JSONB uses a consistent per-event-type shape (see Decision 19). The timeline renderer dispatches on `event_type` and reads known fields from the details object.

---

## Communication (revised)

- Browser → Backend: HTTPS + REST (JSON). Auth via JWT in httpOnly cookie.
- Backend → Database: PostgreSQL via Prisma client.
- No real-time updates — polling model only.
- The authentication matrix (see docs/decisions.md) is enforced in middleware, not hidden in the UI.

---

## Where Each Piece Runs (revised)

| Component | Runtime Location | Status |
|-----------|-----------------|--------|
| React frontend | Browser (Vercel-hosted static + dynamic) | Implemented: auth (M2), orders + detail (M4), menu CRUD (M3), lifecycle + history (M5), collaborators + search (M6) |
| Express backend | Render (Node.js process) | Implemented: auth (M2), menu CRUD (M3), orders + lines (M4), lifecycle + history (M5), collaborators + search (M6) |
| PostgreSQL | Supabase (managed PostgreSQL) | Implemented (schema + seed) |
| Prisma migrations | Run during backend setup, applied to Supabase | Implemented (migrations pending) |

## Request Path — Representative Action (revised)

**Example: Waiter places an order for table 5 with two lines, then the kitchen accepts it, voids a line with a reason, adds a collaborator, and adds a note — implementation complete through M6.**

1. **Login:** The waiter navigates to the app, enters email/password. The browser POSTs to `/api/auth/login`. The backend validates credentials against the bcrypt-hashed password in the `users` table, generates a JWT, and returns it in an httpOnly, SameSite=Strict cookie. The frontend stores the decoded user in React context.

2. **Create order:** The waiter fills out the order form (table number, no lines yet). The browser POSTs to `/api/orders`. The auth middleware extracts the JWT, verifies it, and attaches the user to the request. The authorization middleware confirms the user's role is WAITER (or MANAGER). The order is inserted with `status = 'PLACED'` and `primary_waiter_id = user.id`. The order ID is returned.

3. **Add lines:** The waiter selects menu items and quantities. For each line, the browser POSTs to `/api/orders/:id/lines`. The auth middleware confirms the user is the primary waiter, a collaborator, or a manager. The backend reads the current price from the `menu_items` table and stores it as `unit_price` on the `order_lines` row (snapshot, not a reference). A history entry is created (`LINE_ADDED`, with `line_id`, `menu_item_id`, `quantity`, `unit_price` in the `details` JSONB). The running total is recalculated server-side from active lines.

4. **Accept order:** The waiter clicks "Accept". The browser PATCHes to `/api/orders/:id/status` with `{ status: 'ACCEPTED' }`. The state machine validates the transition PLACED → ACCEPTED (encoded in `VALID_TRANSITIONS` in `src/stateMachine.js`). The order is updated, and a history entry is created (`STATUS_CHANGE`, `{ old_status: 'PLACED', new_status: 'ACCEPTED' }`). The response returns the updated order.

5. **Render:** The order detail page re-renders, showing the new status badge and the updated timeline (fetched via `GET /api/orders/:id/history`, which returns entries ordered ascending by `created_at` with each entry's actor name).

6. **Void a line:** The waiter selects a line and enters a reason. The browser POSTs to `/api/orders/:id/lines/:lineId/void` with `{ reason }`. The route enforces: (a) non-empty reason via Joi `voidLine` schema, (b) order not in `SERVED` or `CANCELLED`, (c) line not already `VOID`. On success the line is updated to `status = VOID`, `void_reason = reason`, `voided_at = NOW()`, `voided_by = current user`, and a `LINE_VOIDED` history entry is created (`{ line_id, reason }`). The voided line drops out of the running total immediately.

7. **Add a note:** The waiter enters a note and submits. The browser POSTs to `/api/orders/:id/notes` with `{ content }`. The note is created and a `NOTE_ADDED` history entry is written. There is no PATCH or DELETE route for notes — they are append-only by absence of routes, not by triggers. Notes are listed via `GET /api/orders/:id/notes` (newest first).

8. **Add a collaborator:** The primary waiter (or a manager) enters the collaborator's email in the order detail page. The browser POSTs to `/api/orders/:id/collaborators` with `{ waiter_id: 'collaborator@example.com' }`. The route looks the user up by email (or id) and confirms they are a WAITER role, not already on the order, and not the primary waiter. The `OrderCollaborator` row is created (composite PK prevents duplicates). A `COLLABORATOR_ADDED` history entry is written. The new collaborator now sees the order in their list on the next page load (the `GET /api/orders` waiter-scoping query includes `collaborators: { some: { waiterId } }`).

9. **List orders:** The collaborator (or primary waiter) opens the orders page. The browser GETs `/api/orders`. The backend's role-based scoping returns orders where `primaryWaiterId = currentUserId OR collaborators contains currentUserId`. Waiters cannot see other waiters' orders. The list supports `search` (table number ILIKE), `status`, `date`, `waiter` filters (manager only), sort, and pagination. All filtering and sorting is done server-side; the response includes `{ orders, total }` for the pagination UI.

---

## What Was Deliberately Not Built (revised)

The following are explicitly out of scope for this submission:
- Kitchen display screen
- Table-side ordering from handheld
- Split checks
- Loyalty/repeat-customer program
- Ingredient-level stock deduction
- Reservation/table management
- Printable/e-mailed receipts
- Happy-hour/time-of-day pricing
- Multi-location with per-location pricing
- Real-time notifications (polling sufficient)
- Server-side rendering (client-side is sufficient)
- Mobile native app (responsive web is minimum)
- UI animations and transitions
- Charting library for dashboard (will use plain text until time permits)