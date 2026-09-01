# Schema

Answer each of these, in your own words.

- Table by table: what columns and types does each one have?
- Which relationships are one-to-many, and which are many-to-many?
- Which constraints are enforced by the database, and which by application code — and why did you draw the line there?
- What did you deliberately denormalise?
- What would break first if this had 100x the data?

---

**Status: IMPLEMENTED** — The full schema is defined in `prisma/schema.prisma` and seeded via `prisma/seed.js`. Run `prisma migrate dev --name init` against a Supabase PostgreSQL database to create the tables, then `node prisma/seed.js` to populate demo data.

---

## Tables

### 1. users

Stores authenticated accounts. Two roles: MANAGER and WAITER.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| role | TEXT | NOT NULL, CHECK (role IN ('MANAGER', 'WAITER')) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** `CREATE UNIQUE INDEX ON users (email)`

---

### 2. menu_items

The restaurant's offerings. Archived items are hidden from the default list but retained for historical order data.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| price | DECIMAL(10,2) | NOT NULL, CHECK (price >= 0) |
| is_available | BOOLEAN | NOT NULL, DEFAULT TRUE |
| is_archived | BOOLEAN | NOT NULL, DEFAULT FALSE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** `(is_archived, is_available)` for the default menu query.

---

### 3. orders

The central entity. Tracks status, primary waiter, and archive state.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| table_number | VARCHAR(50) | NOT NULL |
| status | TEXT | NOT NULL, CHECK (status IN ('PLACED','ACCEPTED','PREPARING','READY','SERVED','CANCELLED')) |
| primary_waiter_id | UUID | NOT NULL, FK → users(id) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| served_at | TIMESTAMPTZ | NULL (set when status → SERVED) |
| archived_at | TIMESTAMPTZ | NULL (set when archived, cleared on restore) |

**Indexes:** `(primary_waiter_id, created_at)`, `(status)`, `(created_at)`, `(status, created_at)`, `(archived_at)`.

---

### 4. order_lines

One row per menu item on an order. `unit_price` is a snapshot — it stores the menu item's price at the moment the line was added, so the order total remains correct even if the menu price changes later.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| order_id | UUID | NOT NULL, FK → orders(id) ON DELETE CASCADE |
| menu_item_id | UUID | NOT NULL, FK → menu_items(id) |
| quantity | INTEGER | NOT NULL, CHECK (quantity >= 1) |
| unit_price | DECIMAL(10,2) | NOT NULL (snapshot, not FK) |
| special_instructions | TEXT | NULL |
| status | TEXT | NOT NULL, CHECK (status IN ('ACTIVE', 'VOID')), DEFAULT 'ACTIVE' |
| void_reason | TEXT | NULL (required when status = 'VOID') |
| voided_at | TIMESTAMPTZ | NULL |
| voided_by | UUID | FK → users(id), NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| created_by | UUID | FK → users(id), NOT NULL |

**Indexes:** `(order_id)`, `(order_id, status)`

---

### 5. order_collaborators

Join table enabling many waiters per order and many orders per waiter. The composite PK prevents duplicate assignments.

| Column | Type | Constraints |
|--------|------|-------------|
| order_id | UUID | PK (part 1), FK → orders(id) ON DELETE CASCADE |
| waiter_id | UUID | PK (part 2), FK → users(id) |
| added_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| added_by | UUID | FK → users(id), NOT NULL |

---

### 6. order_history_entries

Append-only audit log. **No UPDATE or DELETE endpoint is exposed for this table.** This is enforced by not defining such routes in the API, not by database triggers alone — the application layer is the primary defense.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| order_id | UUID | NOT NULL, FK → orders(id) ON DELETE CASCADE |
| event_type | TEXT | NOT NULL, CHECK (event_type IN ('STATUS_CHANGE','LINE_ADDED','LINE_VOIDED','NOTE_ADDED','COLLABORATOR_ADDED','COLLABORATOR_REMOVED')) |
| details | JSONB | NOT NULL |
| actor_id | UUID | NOT NULL, FK → users(id) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** `(order_id, created_at)` for timeline queries.

`details` is JSONB because event types have different shapes:
- STATUS_CHANGE: `{ old_status, new_status }`
- LINE_ADDED: `{ line_id, menu_item_id, quantity, unit_price }`
- LINE_VOIDED: `{ line_id, reason }`
- NOTE_ADDED: `{ content }`
- COLLABORATOR_ADDED / REMOVED: `{ waiter_id }`

---

### 7. order_notes

Free-text notes attached to an order. Notes are immutable after creation — no edit/delete endpoints are defined.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| order_id | UUID | NOT NULL, FK → orders(id) ON DELETE CASCADE |
| content | TEXT | NOT NULL |
| created_by | UUID | NOT NULL, FK → users(id) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

### 8. alerts

Tracks the active alert state for orders that have exceeded the slow-order threshold. One row per order at a time; deleted when the order reaches Ready/Served/Cancelled.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| order_id | UUID | UNIQUE, FK → orders(id) ON DELETE CASCADE |
| triggered_at | TIMESTAMPTZ | NOT NULL |
| resolved_at | TIMESTAMPTZ | NULL (set when order is resolved) |

---

### 9. alert_dismissals

Tracks each dismissal cycle independently. An alert can be dismissed multiple times; each dismissal is a new row. This supports the requirement that alerts reappear after a further threshold period.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| alert_id | UUID | NOT NULL, FK → alerts(id) ON DELETE CASCADE |
| dismissed_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| dismissed_by | UUID | NOT NULL, FK → users(id) |

---

## Relationships

| Relationship | Type |
|--------------|------|
| users → orders (as primary waiter) | 1:Many |
| users → order_lines (as creator) | 1:Many |
| users → order_lines (as voided_by) | 1:Many |
| users → order_collaborators | 1:Many |
| users → order_notes (as creator) | 1:Many |
| users → alert_dismissals | 1:Many |
| orders → order_lines | 1:Many |
| orders → order_collaborators | 1:Many |
| orders → order_history_entries | 1:Many |
| orders → order_notes | 1:Many |
| orders → alerts | 1:1 |
| alerts → alert_dismissals | 1:Many |
| menu_items → order_lines | 1:Many |
| order_collaborators (order ↔ waiter) | Many:Many via join table |

---

## Constraints: Database vs Application

| Constraint | Enforced By |
|------------|-------------|
| User email unique | Database (UNIQUE index) |
| User role in ('MANAGER', 'WAITER') | Database (CHECK) + application validation |
| Menu item price >= 0 | Database (CHECK) + application validation |
| Order status in valid set | Database (CHECK) + application state machine |
| Order line quantity >= 1 | Database (CHECK) |
| Order line status in ('ACTIVE', 'VOID') | Database (CHECK) |
| Void reason required when VOID | Application (no DB mechanism for conditional NOT NULL) |
| Cannot cancel once Preparing | Application state machine |
| Cannot skip order statuses | Application state machine |
| History immutability | Application (no UPDATE/DELETE routes defined) |
| No delete on notes | Application (no DELETE route defined) |
| Collaborator cannot double-add | Database (composite PK prevents duplicates) |

The database enforces data-type and range constraints. The application enforces business rules (state machine, authorization, conditional fields). The reason for this split: database constraints catch data corruption at the storage layer; application constraints encode business logic that requires context (e.g., "can this user cancel this order?").

---

## Denormalisation

`order_lines.unit_price` is the primary deliberate denormalisation. It duplicates data from `menu_items.price` at the moment of insertion. This is intentional: the menu price can change, but past orders must reflect what was actually charged. Storing the snapshot eliminates the need for price-history tables or complex temporal queries.

No other significant denormalisation. `order_history_entries` uses JSONB for flexibility, but this is a schemaless column on a write-once table — not a performance denormalisation.

---

## 100x Scale

If this had 100x the data (roughly ~50,000 orders), the first bottleneck would likely be the orders list query with multiple filters and joins. Mitigation: the composite indexes on `(status, created_at)` and `(primary_waiter_id, created_at)` help, but at scale we would need:

1. **Partitioning** by `created_at` on the orders table (PostgreSQL native partitioning).
2. **Partial indexes** on `order_lines` for only ACTIVE lines.
3. **Query result caching** for the dashboard stats (they don't need to be real-time to the second).
4. **Pagination cursor-based** rather than OFFSET-based (OFFSET becomes slow at high page numbers).

The historical pricing snapshot means order totals never require joins — this will continue to perform well at scale.