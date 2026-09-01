# Backend tests

Vitest + Supertest. Run with `npm test`.

## What's covered now (M3)

`menu-validator.test.js` — 18 cases. Pure Joi schema validation, no DB:

- `createMenuItem`: name required / empty / too long; price required / negative / zero; is_available optional
- `updateMenuItem`: partial updates; archive toggle; empty body rejected; negative price rejected
- `bulkUpdate`: at least one of price / is_available; item_ids must be UUIDs and non-empty; max 500 ids

## What's coming (M10)

The full integration suite per `docs/plan.md` M10:

- Login / `/me` / AuthZ matrix
- Order state machine + cancellation cutoff
- Line void rules
- Historical pricing
- Immutable history (no PUT/PATCH/DELETE on history or notes)
- Bulk update with a real DB (succeeded / rejected shape)
- Order search / filter / sort / pagination
- Alerts (threshold, dismiss, reappear, status-resolved)
- Dashboard metrics
- CSV export

These need a real PostgreSQL test database. The intended workflow:

1. Set `DATABASE_URL` in `.env` to a dedicated test database (NOT the dev one)
2. `npx prisma migrate deploy` against it
3. `node prisma/seed.js` against it
4. `npm test` — tests run serially (single fork) so the seed state is deterministic
5. `prisma migrate reset` to drop the test DB when done

The test harness (`tests/setup.js`, `vitest.config.js`, `singleFork: true`) is already in place — M10 only needs to add the suites and helpers.
