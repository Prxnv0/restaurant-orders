// Shared helpers for M10 integration tests.
//
// Provides:
//   - app      — the express app (loaded once per test run)
//   - prisma   — Prisma client connected to the test database
//   - login()  — POST /api/auth/login, returns supertest agent with cookie
//   - getUser() — return the seeded user record for a demo role
//
// The seed must be run by hand before the first `npm test` (see tests/README.md).
// Each test file does not need to re-seed; the data is the same across runs.
const supertest = require('supertest');

// Set required env before requiring the app
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-m10-do-not-use-in-prod';
process.env.ALERT_THRESHOLD_MINUTES = process.env.ALERT_THRESHOLD_MINUTES || '15';
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE || 'UTC';
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const app = require('../src/index');
const prisma = require('../src/db');

// Demo credentials seeded by prisma/seed.js
const CREDENTIALS = {
  manager: { email: 'manager@busy-demo.com', password: 'Demo123!' },
  waiter1: { email: 'waiter1@busy-demo.com', password: 'Demo123!' },
  waiter2: { email: 'waiter2@busy-demo.com', password: 'Demo123!' },
};

/**
 * Logs in as the given role and returns a supertest agent with the JWT cookie.
 * Usage:
 *   const agent = await login('manager');
 *   await agent.get('/api/auth/me').expect(200);
 */
async function login(role = 'manager') {
  const creds = CREDENTIALS[role];
  if (!creds) throw new Error(`Unknown role: ${role}`);

  const agent = supertest.agent(app);
  const res = await agent.post('/api/auth/login').send(creds);
  if (res.status !== 200) {
    throw new Error(
      `Login failed for ${role}: status=${res.status} body=${JSON.stringify(res.body)}`
    );
  }
  return agent;
}

/**
 * Returns the seeded user record for the given demo account.
 */
async function getUser(role) {
  const creds = CREDENTIALS[role];
  return prisma.user.findUnique({ where: { email: creds.email } });
}

module.exports = {
  app,
  prisma,
  login,
  getUser,
  CREDENTIALS,
};
