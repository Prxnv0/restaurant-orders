// M10 Test Suite 1 — Login (Goal 1)
//
// Verifies:
//   - Valid manager credentials return 200 + user object
//   - Invalid password returns 401
//   - Missing email returns 400
//   - Missing password returns 400
//   - Non-existent email returns 401 (generic message — no user enumeration)
import { describe, it, expect } from 'vitest';
const supertest = require('supertest');

// Set up env BEFORE importing app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-m10-do-not-use-in-prod';
process.env.ALERT_THRESHOLD_MINUTES = '15';
process.env.APP_TIMEZONE = 'UTC';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const app = require('../src/index');

describe('POST /api/auth/login', () => {
  it('returns 200 + user for valid manager credentials', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'manager@busy-demo.com', password: 'Demo123!' })
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('manager@busy-demo.com');
    expect(res.body.user.role).toBe('MANAGER');
    expect(res.body.user.name).toBe('Alex Manager');
    // Password hash must not be exposed
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('returns 200 + user for valid waiter credentials', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'waiter1@busy-demo.com', password: 'Demo123!' })
      .expect(200);

    expect(res.body.user.role).toBe('WAITER');
    expect(res.body.user.name).toBe('Jordan Waiter');
  });

  it('returns 401 for invalid password', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'manager@busy-demo.com', password: 'wrong-password' })
      .expect(401);

    expect(res.body.error).toBe('UNAUTHORIZED');
    // Generic message — no user enumeration
    expect(res.body.message.toLowerCase()).toMatch(/invalid|email|password/i);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'anypassword' })
      .expect(401);

    // Same generic message as wrong password (no enumeration)
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 400 for missing email', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ password: 'Demo123!' })
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
    expect(res.body.message).toMatch(/email/i);
  });

  it('returns 400 for missing password', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'manager@busy-demo.com' })
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
    expect(res.body.message).toMatch(/password/i);
  });

  it('returns 400 for empty body', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
  });

  it('returns 400 for invalid email format', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'Demo123!' })
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
  });
});
