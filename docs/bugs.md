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
