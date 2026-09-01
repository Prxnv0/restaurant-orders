// Test environment setup.
//
// This file runs once before all tests in the suite.
// It loads dotenv so tests can access environment variables from .env
// without polluting the shell environment.
//
// For database-dependent tests (M10 onward), the setup also ensures
// the test database is migrated and seeded before any test file runs.
// See tests/README.md for the full test database workflow.
require('dotenv').config();
