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
- **Append-only history:** The `order_history_entries` table has no UPDATE or DELETE endpoint. Immutability is enforced by never exposing such endpoints in the API.
- **Historical pricing via snapshot:** The `order_lines.unit_price` column stores the price at the moment the line is added, independent of any future price changes to `menu_items`.
- **Database-backed authorization matrix:** The actual access-control rules are expressed in the authorization matrix (see docs/decisions.md) and enforced in Express middleware, not hidden in the frontend.

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
| React frontend | Browser (Vercel-hosted static + dynamic) | Implemented (skeleton) |
| Express backend | Render (Node.js process) | Implemented (skeleton) |
| PostgreSQL | Supabase (managed PostgreSQL) | Implemented (schema + seed) |
| Prisma migrations | Run during backend setup, applied to Supabase | Implemented (migrations pending) |

## Request Path — Representative Action (revised)

**Example: Waiter places an order for table 5 with two lines, then the kitchen accepts it — implementation in progress.**

1. **Login:** The waiter navigates to the app, enters email/password. The browser POSTs to `/api/auth/login`. The backend validates credentials against the bcrypt-hashed password in the `users` table, generates a JWT, and returns it in an httpOnly, SameSite=Strict cookie. The frontend stores the decoded user in React context.

2. **Create order:** The waiter fills out the order form (table number, no lines yet). The browser POSTs to `/api/orders`. The auth middleware extracts the JWT, verifies it, and attaches the user to the request. The authorization middleware confirms the user's role is WAITER (or MANAGER). The order is inserted with `status = 'PLACED'` and `primary_waiter_id = user.id`. A history entry is created (`STATUS_CHANGE`, PLACED). The order ID is returned.

3. **Add lines:** The waiter selects menu items and quantities. For each line, the browser POSTs to `/api/orders/:id/lines`. The auth middleware confirms the user is the primary waiter, a collaborator, or a manager. The backend reads the current price from the `menu_items` table and stores it as `unit_price` on the `order_lines` row (snapshot, not a reference). A history entry is created (`LINE_ADDED`). The running total is recalculated server-side.

4. **Accept order:** The waiter clicks "Accept". The browser PATCHes to `/api/orders/:id/status` with `{ status: 'ACCEPTED' }`. The state machine validates the transition PLACED → ACCEPTED, updates the order, and creates a history entry with old and new status and the actor's ID. The response returns the updated order.

5. **Render:** The order detail page re-renders, showing the new status badge and the updated timeline.

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