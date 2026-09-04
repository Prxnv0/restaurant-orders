// M10 Test Suite 2 — GET /me (Goal 1)
//
// Verifies:
//   - GET /api/auth/me with no cookie returns 401
//   - GET /api/auth/me with valid cookie returns 200 + user
//   - Response does not include password hash
import { describe, it, expect } from 'vitest';
const supertest = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-m10-do-not-use-in-prod';
process.env.ALERT_THRESHOLD_MINUTES = '15';
process.env.APP_TIMEZONE = 'UTC';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const app = require('../src/index');

describe('GET /api/auth/me', () => {
  it('returns 401 when no cookie is sent', async () => {
    const res = await supertest(app).get('/api/auth/me').expect(401);

    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(res.body.message.toLowerCase()).toMatch(/auth|login/i);
  });

  it('returns 200 + user when a valid manager cookie is sent', async () => {
    const agent = supertest.agent(app);

    // Log in first to get the cookie
    await agent
      .post('/api/auth/login')
      .send({ email: 'manager@busy-demo.com', password: 'Demo123!' })
      .expect(200);

    const res = await agent.get('/api/auth/me').expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('manager@busy-demo.com');
    expect(res.body.user.role).toBe('MANAGER');
    expect(res.body.user.name).toBe('Alex Manager');
    // Password hash must not be exposed
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('returns 200 + user for waiter', async () => {
    const agent = supertest.agent(app);

    await agent
      .post('/api/auth/login')
      .send({ email: 'waiter1@busy-demo.com', password: 'Demo123!' })
      .expect(200);

    const res = await agent.get('/api/auth/me').expect(200);

    expect(res.body.user.email).toBe('waiter1@busy-demo.com');
    expect(res.body.user.role).toBe('WAITER');
  });

  it('returns 401 for a tampered/invalid token cookie', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Cookie', 'token=clearly-not-a-valid-jwt')
      .expect(401);

    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});
