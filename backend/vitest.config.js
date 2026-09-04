// Vitest configuration for the backend test suite.
//
// Tests run against a real PostgreSQL database via the Prisma client.
// Before the full suite runs, the test database is seeded with the same
// demo data used in development so tests are deterministic.
//
// Files run in this order (so the seed is in place for tests that read it):
//   1. tests/stateMachine.test.js          (pure unit)
//   2. tests/menu-validator.test.js        (pure unit)
//   3. tests/orders-validator.test.js      (pure unit)
//   4. tests/csv.test.js                   (pure unit)
//   5. tests/01-login.test.js              (integration)
//   6. tests/02-auth-me.test.js
//   7. tests/03-authz-matrix.test.js
//   8. tests/04-state-machine.test.js      (via HTTP)
//   9. tests/05-cancellation-cutoff.test.js
//  10. tests/06-void-line.test.js
//  11. tests/07-historical-pricing.test.js
//  12. tests/08-immutable-history.test.js
//  13. tests/09-bulk-update.test.js
//  14. tests/10-order-search.test.js
//  15. tests/11-alerts.test.js
//  16. tests/12-dashboard.test.js
//  17. tests/13-csv-export.test.js
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,           // use explicit imports
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    // Supabase free-tier pooler is slow; 5s default is too tight for integration
    // tests that walk the full order lifecycle (create + 4 transitions + assertions).
    testTimeout: 60000,
    // Order: unit tests (alphabetical) first, then integration tests
    // (numbered) in declaration order.
    sequence: {
      hooks: 'list',
      setupFiles: 'list',
    },
    // Run tests serially to avoid concurrent Prisma connections on the
    // test database. This adds ~1s of wall-clock but avoids connection
    // exhaustion on free-tier Supabase (max 60 connections).
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
