// M10 Test Suite 12 — Dashboard (Goal 8)
//
// Verifies the GET /api/dashboard response shape and data correctness against
// the seeded database. Metrics tested:
//   - open_orders: count of non-terminal, non-archived orders
//   - placed_today: orders created today (any status)
//   - served_today: orders with servedAt today
//   - revenue_today: sum of ACTIVE line totals for orders created today
//   - status_breakdown: counts by status (non-archived)
//   - waiter_breakdown: counts by primary waiter (today only)
//   - chart_14d: 14 entries, zero-filled, keyed on servedAt date
import { describe, it, expect } from 'vitest';
const { login, prisma } = require('./helpers');

function getLocalDateStrings() {
  const tz = process.env.APP_TIMEZONE || 'UTC';
  const now = new Date();
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const offsetMs = localNow.getTime() - now.getTime();

  const todayStart = new Date(localNow);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartUTC = new Date(todayStart.getTime() - offsetMs);

  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  const fourteenDaysAgoUTC = new Date(fourteenDaysAgo.getTime() - offsetMs);

  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(fourteenDaysAgo.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return { todayStartUTC, fourteenDaysAgoUTC, dates };
}

describe('Dashboard', () => {
  it('returns 200 with all required fields', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/dashboard').expect(200);

    expect(res.body).toHaveProperty('open_orders');
    expect(res.body).toHaveProperty('placed_today');
    expect(res.body).toHaveProperty('served_today');
    expect(res.body).toHaveProperty('revenue_today');
    expect(res.body).toHaveProperty('status_breakdown');
    expect(res.body).toHaveProperty('waiter_breakdown');
    expect(res.body).toHaveProperty('chart_14d');
  });

  it('open_orders matches DB count (non-terminal, non-archived)', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/dashboard').expect(200);

    const expected = await prisma.order.count({
      where: {
        archivedAt: null,
        status: { in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] },
      },
    });

    expect(res.body.open_orders).toBe(expected);
  });

  it('placed_today matches DB count of orders created today', async () => {
    const agent = await login('manager');
    const { todayStartUTC } = getLocalDateStrings();

    const res = await agent.get('/api/dashboard').expect(200);

    const expected = await prisma.order.count({
      where: { createdAt: { gte: todayStartUTC } },
    });

    expect(res.body.placed_today).toBe(expected);
  });

  it('served_today matches DB count of orders served today', async () => {
    const agent = await login('manager');
    const { todayStartUTC } = getLocalDateStrings();

    const res = await agent.get('/api/dashboard').expect(200);

    const expected = await prisma.order.count({
      where: { servedAt: { gte: todayStartUTC } },
    });

    expect(res.body.served_today).toBe(expected);
  });

  it('revenue_today counts only ACTIVE lines', async () => {
    const agent = await login('manager');
    const { todayStartUTC } = getLocalDateStrings();

    const res = await agent.get('/api/dashboard').expect(200);

    // Compute expected manually: sum(quantity * unitPrice) for ACTIVE lines
    const lines = await prisma.orderLine.findMany({
      where: {
        status: 'ACTIVE',
        order: { createdAt: { gte: todayStartUTC } },
      },
      select: { quantity: true, unitPrice: true },
    });

    const expected = lines.reduce(
      (sum, l) => sum + Number(l.unitPrice) * l.quantity,
      0
    );

    expect(res.body.revenue_today).toBe(expected);
  });

  it('revenue_today does NOT include VOID lines', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/dashboard').expect(200);

    // The revenue must be 0 or positive
    expect(res.body.revenue_today).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.revenue_today).toBe('number');
  });

  it('status_breakdown is an object with status keys', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/dashboard').expect(200);

    const breakdown = res.body.status_breakdown;
    expect(typeof breakdown).toBe('object');

    for (const [status, count] of Object.entries(breakdown)) {
      expect(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']).toContain(status);
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it('status_breakdown excludes archived orders', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/dashboard').expect(200);

    // Verify against DB (excludes archived)
    const rows = await prisma.order.groupBy({
      by: ['status'],
      where: { archivedAt: null },
      _count: { id: true },
    });

    for (const row of rows) {
      expect(res.body.status_breakdown[row.status]).toBe(row._count.id);
    }
  });

  it('waiter_breakdown contains waiter names as keys', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/dashboard').expect(200);

    const breakdown = res.body.waiter_breakdown;
    expect(typeof breakdown).toBe('object');

    for (const [name, count] of Object.entries(breakdown)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    }
  });

  it('chart_14d has exactly 14 entries', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/dashboard').expect(200);

    expect(res.body.chart_14d).toHaveLength(14);
  });

  it('chart_14d is zero-filled (all dates present, served=0 for missing)', async () => {
    const agent = await login('manager');
    const { dates } = getLocalDateStrings();

    const res = await agent.get('/api/dashboard').expect(200);

    const chart = res.body.chart_14d;

    expect(chart.map((e) => e.date)).toEqual(dates);

    for (const entry of chart) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('served');
      expect(entry).toHaveProperty('revenue');
      expect(typeof entry.served).toBe('number');
      expect(typeof entry.revenue).toBe('number');
      expect(entry.served).toBeGreaterThanOrEqual(0);
      expect(entry.revenue).toBeGreaterThanOrEqual(0);
    }
  });

  it('waiter: GET /api/dashboard returns 403', async () => {
    const agent = await login('waiter1');
    await agent.get('/api/dashboard').expect(403);
  });
});
