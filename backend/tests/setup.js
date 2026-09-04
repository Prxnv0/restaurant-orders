// Test environment setup.
//
// This file runs once before all tests in the suite.
// It loads dotenv so tests can access environment variables from .env
// without polluting the shell environment.
//
// For database-dependent tests (M10 onward), the setup also ensures
// the test database is migrated and seeded before any test file runs.
// See tests/README.md for the full test database workflow.
//
// Env precedence: root .env (if present) → tests/.env (test DB credentials).
// tests/.env points to the dedicated Supabase TEST database, not dev or prod.
require('dotenv').config();
require('dotenv').config({ path: 'tests/.env' }); // test DB credentials override root .env
