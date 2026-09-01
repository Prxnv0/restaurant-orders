# Plan

Answer each of these, in your own words.

- How did you break the work into sessions?
- What order did you build in, and why that order?
- What did you estimate versus what it actually took?
- What did you cut when you ran short?

---

## Session Breakdown (Actual)

The work is executed across ~12 hours in 2-hour slots. Milestones 1 and 2 (original plan) were merged into a single slot because the database schema and foundation go together.

### Milestone 1 — Foundation + Database (actual: ~2 hours) ✅ COMPLETE
**Delivered:**
- Backend: Express skeleton, Prisma client, `.env.example`
- Frontend: Vite + React + Router + CSS skeleton
- Database: Full Prisma schema (9 tables) with all indexes, constraints, enums
- Seed script: Creates 2 demo users (manager/waiter), 6 menu items, 7 orders in various states (PLACED, ACCEPTED, PREPARING, READY, SERVED, CANCELLED, archived), order lines with price snapshots, voided line with reason, collaborators, history entries, notes, alerts, and dismissals
- Documentation: Updated schema.md, architecture.md, plan.md to "Implemented (skeleton)" status

### Milestone 2 — Authentication + Authorization (est. 2 hours) 🔄 IN PROGRESS
JWT login/logout/me, auth middleware, role-based + resource-ownership middleware, login page with auth context.

### Milestone 3 — Menu + Bulk Update (est. 2 hours) ⏳ PENDING
Menu CRUD (manager only), bulk update with per-item success/reject, menu page.

### Milestone 4 — Orders + Order Lines (est. 2 hours) ⏳ PENDING
Create order, list orders, add lines with price snapshot, order placement page.

### Milestone 5 — Lifecycle, Void, History (est. 2 hours) ⏳ PENDING
State machine (all transitions + rejection), void line with reason, append-only history, order detail page + timeline.

### Milestone 6 — Collaborators + Search (est. 2 hours) ⏳ PENDING
Add/remove collaborators, order list filtered by primary+collab, search/filter/sort/paginate server-side.

### Milestone 7 — Dashboard + Alerts + CSV (est. 2 hours) ⏳ PENDING
Dashboard metrics, alert list + dismiss/reappear, CSV export (today's orders).

### Milestone 8 — Frontend: Manager Views (est. 2 hours) ⏳ PENDING
Menu page, dashboard page, alerts page, CSV download, nav bar with alert badge.

### Milestone 9 — Frontend: Waiter Views (est. 2 hours) ⏳ PENDING
Orders list with search/filter/sort/paginate, order detail (lines, history, void, collaborators, notes).

### Milestone 10 — Frontend Wire + Polish (est. 1 hour) ⏳ PENDING
API client, error handling, loading states, responsive layout.

### Milestone 11 — Deployment + Testing (est. 1 hour) ⏳ PENDING
Render + Vercel deploy, Supabase seed, smoke test.

### Milestone 12 — Documentation + Final Pass (est. 1 hour) ⏳ PENDING
Update all docs to Implemented status, fill SUBMISSION.md, final commit.

**Total estimated remaining: ~20 hours (actual 12-hour ceiling means we will compress/merge milestones 2–12 into 10 more 2-hour slots, cutting all NICEs).**

---

## Why This Order

Authentication and authorization come first because every subsequent endpoint depends on them. The database schema and seed data are complete (milestone 1). Menu management comes before orders because orders depend on menu items. The state machine and history come after basic order creation because they build on top of it. Dashboard, alerts, and CSV export are later because they aggregate data produced by earlier features. Frontend is built in parallel with backend endpoints so each feature is testable immediately.

---

## What Was Cut / Deferred

Stretch ideas (kitchen display, table-side ordering, split checks, loyalty program, ingredient stock, reservations, receipts, happy-hour pricing, multi-location) are not planned — they would threaten completion of the 10 mandatory goals within 12 hours.

**NICE items already cut from implementation:**
- Animations, dark mode, responsive mobile layout
- Dashboard chart library (will use plain text/table until/unless time permits)
- ESLint / Prettier
- Extra seed data beyond minimum
- Loading skeletons (plain spinners only)

---

## Estimate vs Actual

| Milestone | Original Estimate | Actual (hrs) | Notes |
|-----------|-------------------|--------------|-------|
| 1. Foundation + Database | 1.5 + 1.5 = 3h | **~2h** | Merged; Prisma schema and seed written together |
| 2. Auth + AuthZ | 1 + 1 = 2h | — | |
| 3. Menu + Bulk | 1h | — | |
| 4. Orders + Lines | 1h | — | |
| 5. Lifecycle + History | 1.5h | — | |
| 6. Collaborators + Search | 1h | — | |
| 7. Dashboard + Alerts + CSV | 1h + 0.25h = 1.25h | — | |
| 8. Frontend Manager | 0.75h | — | |
| 9. Frontend Waiter | 1h | — | |
| 10. Frontend Polish | 1h | — | |
| 11. Deploy + Test | 1h + 1h = 2h | — | |
| 12. Docs Final | 1h | — | |
| **Total** | **~17h** | **~2h so far** | Original plan was optimistic; revised schedule targets 12h |

---

## What Was Cut When Short on Time

Visual polish (animations, dark mode, responsive refinements) would be the first to go if time runs short — mandatory requirements always take priority. The revised 12-hour schedule already bakes these cuts in.