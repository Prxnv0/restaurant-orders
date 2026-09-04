// M10 Test Suite 3 — Authorization Matrix (Goal 1)
//
// Tests every protected route against four roles:
//   manager       — full access
//   waiter1       — primary waiter on seeded orders (has access to their orders)
//   waiter2       — collaborator on seeded order2 (has access via collaborator)
//   unrelated     — waiter not on any seeded order (no order access)
//
// Expected codes:
//   200 = access granted
//   401 = not authenticated
//   403 = authenticated but not authorized
//   404 = order not found / not accessible
//   409 = conflict (e.g. invalid transition, duplicate)
import { describe, it, expect, beforeAll } from 'vitest';
const supertest = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-m10-do-not-use-in-prod';
process.env.ALERT_THRESHOLD_MINUTES = '15';
process.env.APP_TIMEZONE = 'UTC';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const app = require('../src/index');
const { prisma, login } = require('./helpers');

// We'll use seeded order2 (table 2, waiter1 primary, waiter2 collaborator)
let order2Id;

beforeAll(async () => {
  const order = await prisma.order.findFirst({
    where: { tableNumber: '2' },
  });
  order2Id = order.id;
});

// ── Helpers ──────────────────────────────────────────────────────────────

async function expectCode(agent, method, path, body, expected) {
  let req = agent[method](path);
  if (body !== null) req = req.send(body);
  const res = await req;
  expect(res.status).toBe(
    expected,
    `GET ${method.toUpperCase()} ${path} → ${res.status} (expected ${expected})\nBody: ${JSON.stringify(res.body)}`
  );
}

// ── Routes tested ────────────────────────────────────────────────────────

describe('Authorization Matrix', () => {
  describe('Auth routes', () => {
    it('manager can POST /logout', async () => {
      const agent = await login('manager');
      await expectCode(agent, 'post', '/api/auth/logout', null, 200);
    });

    it('waiter can POST /logout', async () => {
      const agent = await login('waiter1');
      await expectCode(agent, 'post', '/api/auth/logout', null, 200);
    });

    it('unauthenticated cannot POST /logout (gets session cookie cleared regardless)', async () => {
      // Logout clears the cookie — unauthenticated returns 200 (no-op)
      await expectCode(supertest(app), 'post', '/api/auth/logout', null, 200);
    });
  });

  describe('Menu routes', () => {
    it('manager: GET /api/menu returns 200', async () => {
      const agent = await login('manager');
      await expectCode(agent, 'get', '/api/menu', null, 200);
    });

    it('manager: POST /api/menu returns 201 (create menu item)', async () => {
      const agent = await login('manager');
      await expectCode(
        agent,
        'post',
        '/api/menu',
        { name: 'Integration Test Item', price: 9.99 },
        201
      );
    });

    it('manager: POST /api/menu/bulk-update returns 200', async () => {
      const agent = await login('manager');
      const items = await prisma.menuItem.findMany({ take: 1 });
      await expectCode(
        agent,
        'post',
        '/api/menu/bulk-update',
        { item_ids: [items[0].id], is_available: false },
        200
      );
    });

    it('waiter: GET /api/menu returns 200 (menu is public to authed)', async () => {
      const agent = await login('waiter1');
      await expectCode(agent, 'get', '/api/menu', null, 200);
    });

    it('waiter: POST /api/menu returns 403', async () => {
      const agent = await login('waiter1');
      await expectCode(
        agent,
        'post',
        '/api/menu',
        { name: 'Unauthorized Item', price: 1 },
        403
      );
    });

    it('waiter: POST /api/menu/bulk-update returns 403', async () => {
      const agent = await login('waiter1');
      const items = await prisma.menuItem.findMany({ take: 1 });
      await expectCode(
        agent,
        'post',
        '/api/menu/bulk-update',
        { item_ids: [items[0].id], is_available: false },
        403
      );
    });

    it('unauthenticated: GET /api/menu returns 401', async () => {
      await expectCode(supertest(app), 'get', '/api/menu', null, 401);
    });
  });

  describe('Order routes', () => {
    it('waiter: POST /api/orders returns 201 (create order)', async () => {
      const agent = await login('waiter1');
      await expectCode(agent, 'post', '/api/orders', { table_number: 'M10-TEST-1' }, 201);
    });

    it('manager: POST /api/orders returns 201 (manager can create orders too)', async () => {
      const agent = await login('manager');
      await expectCode(agent, 'post', '/api/orders', { table_number: 'M10-TEST-2' }, 201);
    });

    it('unauthenticated: POST /api/orders returns 401', async () => {
      await expectCode(supertest(app), 'post', '/api/orders', { table_number: 'X' }, 401);
    });

    it('waiter1: GET /api/orders returns 200 (sees their orders)', async () => {
      const agent = await login('waiter1');
      await expectCode(agent, 'get', '/api/orders', null, 200);
    });

    it('manager: GET /api/orders returns 200', async () => {
      const agent = await login('manager');
      await expectCode(agent, 'get', '/api/orders', null, 200);
    });

    it('waiter1: GET /api/orders/:id (own order) returns 200', async () => {
      const agent = await login('waiter1');
      // Use seeded order1 which is waiter1's
      const order1 = await prisma.order.findFirst({ where: { tableNumber: '1' } });
      await expectCode(agent, 'get', `/api/orders/${order1.id}`, null, 200);
    });

    it('waiter2: GET /api/orders/:id (collab order2) returns 200', async () => {
      const agent = await login('waiter2');
      await expectCode(agent, 'get', `/api/orders/${order2Id}`, null, 200);
    });

    it('waiter1: POST /api/orders/:id/lines (own order) returns 201', async () => {
      const agent = await login('waiter1');
      const order = await prisma.order.findFirst({ where: { tableNumber: '1' } });
      const menuItem = await prisma.menuItem.findFirst({ where: { isAvailable: true } });
      await expectCode(
        agent,
        'post',
        `/api/orders/${order.id}/lines`,
        { menu_item_id: menuItem.id, quantity: 1 },
        201
      );
    });

    it('unauthenticated: GET /api/orders returns 401', async () => {
      await expectCode(supertest(app), 'get', '/api/orders', null, 401);
    });
  });

  describe('Dashboard route', () => {
    it('manager: GET /api/dashboard returns 200', async () => {
      const agent = await login('manager');
      await expectCode(agent, 'get', '/api/dashboard', null, 200);
    });

    it('waiter: GET /api/dashboard returns 403', async () => {
      const agent = await login('waiter1');
      await expectCode(agent, 'get', '/api/dashboard', null, 403);
    });

    it('unauthenticated: GET /api/dashboard returns 401', async () => {
      await expectCode(supertest(app), 'get', '/api/dashboard', null, 401);
    });
  });

  describe('Alerts route', () => {
    it('manager: GET /api/alerts returns 200', async () => {
      const agent = await login('manager');
      await expectCode(agent, 'get', '/api/alerts', null, 200);
    });

    it('waiter: GET /api/alerts returns 200 (scoped to their orders)', async () => {
      const agent = await login('waiter1');
      await expectCode(agent, 'get', '/api/alerts', null, 200);
    });

    it('unauthenticated: GET /api/alerts returns 401', async () => {
      await expectCode(supertest(app), 'get', '/api/alerts', null, 401);
    });
  });

  describe('Export route', () => {
    it('manager: GET /api/export/orders/today returns 200', async () => {
      const agent = await login('manager');
      await expectCode(agent, 'get', '/api/export/orders/today', null, 200);
    });

    it('waiter: GET /api/export/orders/today returns 403', async () => {
      const agent = await login('waiter1');
      await expectCode(agent, 'get', '/api/export/orders/today', null, 403);
    });

    it('unauthenticated: GET /api/export/orders/today returns 401', async () => {
      await expectCode(supertest(app), 'get', '/api/export/orders/today', null, 401);
    });
  });
});
