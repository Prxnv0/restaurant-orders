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
