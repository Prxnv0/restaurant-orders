// Vitest configuration for the backend test suite.
//
// Tests run against a real PostgreSQL database via the Prisma client.
// Before the full suite runs, the test database is seeded with the same
// demo data used in development so tests are deterministic.
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,           // use explicit imports
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
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
