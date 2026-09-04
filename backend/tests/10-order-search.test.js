// M10 Test Suite 10 — Order Search / Filter / Sort / Pagination (Goal 6)
//
// Verifies:
//   - Each search/filter/sort param works correctly
//   - Pagination: page + limit return correct total + items
//   - Manager sees all orders; waiter sees only their own + collab
//   - Archived orders excluded by default
import { describe, it, expect } from 'vitest';
const { login, prisma } = require('./helpers');

describe('Order Search / Filter / Sort / Pagination', () => {
  it('returns orders with pagination shape { orders, total, page, limit }', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/orders').expect(200);

    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it('search by table number (case-insensitive)', async () => {
    const agent = await login('manager');

    // Seeded order 1 has tableNumber '1'
    const res = await agent.get('/api/orders?search=1').expect(200);

    expect(res.body.orders.length).toBeGreaterThan(0);
    for (const order of res.body.orders) {
      expect(order.tableNumber.toLowerCase()).toMatch(/1/);
    }
  });

  it('filter by single status', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/orders?status=PLACED').expect(200);

    for (const order of res.body.orders) {
      expect(order.status).toBe('PLACED');
    }
  });

  it('filter by multiple statuses (array)', async () => {
    const agent = await login('manager');

    const res = await agent
      .get('/api/orders?status=PLACED&status=ACCEPTED')
      .expect(200);

    const statuses = res.body.orders.map((o) => o.status);
    expect(statuses.every((s) => ['PLACED', 'ACCEPTED'].includes(s))).toBe(true);
  });

  it('sort by table_number asc', async () => {
    const agent = await login('manager');

    const res = await agent
      .get('/api/orders?sort=table_number&order=asc&include_archived=true')
      .expect(200);

    if (res.body.orders.length > 1) {
      const tables = res.body.orders.map((o) => o.tableNumber);
      const sorted = [...tables].sort();
      expect(tables).toEqual(sorted);
    }
  });

  it('sort by table_number desc', async () => {
    const agent = await login('manager');

    const res = await agent
      .get('/api/orders?sort=table_number&order=desc&include_archived=true')
      .expect(200);

    if (res.body.orders.length > 1) {
      const tables = res.body.orders.map((o) => o.tableNumber);
      const sorted = [...tables].sort().reverse();
      expect(tables).toEqual(sorted);
    }
  });

  it('sort by placed_at desc (default)', async () => {
    const agent = await login('manager');

    const res = await agent
      .get('/api/orders?sort=placed_at&order=desc')
      .expect(200);

    if (res.body.orders.length > 1) {
      const dates = res.body.orders.map((o) => new Date(o.createdAt));
      const sorted = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sorted);
    }
  });

  it('pagination: page=2 with limit=5', async () => {
    const agent = await login('manager');

    const res = await agent
      .get('/api/orders?page=2&limit=5')
      .expect(200);

    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(5);
    expect(res.body.orders.length).toBeLessThanOrEqual(5);
  });

  it('total count is consistent regardless of page', async () => {
    const agent = await login('manager');

    const page1 = await agent.get('/api/orders?page=1&limit=5').expect(200);
    const page2 = await agent.get('/api/orders?page=2&limit=5').expect(200);

    // Both pages should report the same total
    expect(page1.body.total).toBe(page2.body.total);
  });

  it('archived orders are excluded by default', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/orders').expect(200);

    // Seeded order7 is archived
    for (const order of res.body.orders) {
      expect(order.archivedAt).toBeNull();
    }
  });

  it('archived orders are included when include_archived=true', async () => {
    const agent = await login('manager');

    // Query the total to determine the last page, then fetch it.
    // The seeded archived order (table 7) drifts to the last page as more
    // test orders accumulate during the run — a fixed page number is not stable.
    const listRes = await agent
      .get('/api/orders?include_archived=true&limit=1')
      .expect(200);
    const lastPage = Math.ceil(listRes.body.total / 20);

    const res = await agent
      .get(`/api/orders?include_archived=true&page=${lastPage}&limit=20`)
      .expect(200);

    // We expect at least one order (the archived one)
    const hasArchived = res.body.orders.some((o) => o.archivedAt !== null);
    expect(hasArchived).toBe(true);
  });

  it('waiter only sees their own + collaborator orders', async () => {
    const waiterAgent = await login('waiter1');
    const waiter1 = await prisma.user.findUnique({
      where: { email: 'waiter1@busy-demo.com' },
    });

    const res = await waiterAgent.get('/api/orders').expect(200);

    // Every order must be either primary or collaborator
    for (const order of res.body.orders) {
      const isPrimary = order.primaryWaiterId === waiter1.id;
      const isCollab = await prisma.orderCollaborator.findFirst({
        where: { orderId: order.id, waiterId: waiter1.id },
      });
      expect(isPrimary || isCollab).toBeTruthy();
    }
  });

  it('manager sees all orders regardless of waiter', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/orders').expect(200);

    // Manager should see all non-archived orders
    const total = await prisma.order.count({ where: { archivedAt: null } });
    expect(res.body.total).toBe(total);
  });

  it('filter by date (created_at day)', async () => {
    const agent = await login('manager');

    // Use today's date
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const res = await agent.get(`/api/orders?date=${today}`).expect(200);

    for (const order of res.body.orders) {
      const orderDate = new Date(order.createdAt).toISOString().slice(0, 10);
      expect(orderDate).toBe(today);
    }
  });

  it('returns 400 for invalid sort field', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/orders?sort=invalid_field').expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
  });
});
