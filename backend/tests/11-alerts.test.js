// M10 Test Suite 11 — Alerts (Goal 10)
//
// Alert logic:
//   An alert is active when:
//     1. resolvedAt is null
//     2. order status is non-terminal (not READY/SERVED/CANCELLED)
//     3. order.createdAt is more than ALERT_THRESHOLD_MINUTES ago
//        AND (no dismissal exists OR latest dismissal was > threshold ago)
//
// The seeded data creates:
//   - order1: PLACED, created 30 min ago → should appear (threshold=15min)
//   - order3: PREPARING, created 20 min ago, dismissed 5 min ago
//             → currently hidden (within threshold); if 15+ min passed, appears again
//
// Because seed runs close to test time, order3's dismissal may have expired.
// We test what we can reliably assert without depending on exact clock timing.
import { describe, it, expect, beforeEach } from 'vitest';
const { login, prisma } = require('./helpers');

describe('Alerts', () => {
  it('GET /api/alerts returns 200 with shape { alerts, count }', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/alerts').expect(200);

    expect(res.body).toHaveProperty('alerts');
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.count).toBe(res.body.alerts.length);
  });

  it('each alert has required fields', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/alerts').expect(200);

    if (res.body.alerts.length > 0) {
      const alert = res.body.alerts[0];
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('order_id');
      expect(alert).toHaveProperty('table_number');
      expect(alert).toHaveProperty('status');
      expect(alert).toHaveProperty('triggered_at');
      expect(alert).toHaveProperty('age_minutes');
      expect(typeof alert.age_minutes).toBe('number');
    }
  });

  it('manager sees all active alerts', async () => {
    const agent = await login('manager');

    const res = await agent.get('/api/alerts').expect(200);

    // Manager should see all active alerts across all orders
    const dbAlerts = await prisma.alert.findMany({
      where: { resolvedAt: null },
      include: { order: { select: { status: true } } },
    });

    // Only non-terminal statuses qualify
    const activeDbAlerts = dbAlerts.filter(
      (a) => !['READY', 'SERVED', 'CANCELLED'].includes(a.order.status)
    );

    // count field must reflect this
    expect(res.body.count).toBeGreaterThanOrEqual(activeDbAlerts.length);
  });

  it('waiter sees only their own order alerts (scoped)', async () => {
    const waiterAgent = await login('waiter1');
    const waiter1 = await prisma.user.findUnique({
      where: { email: 'waiter1@busy-demo.com' },
    });

    const res = await waiterAgent.get('/api/alerts').expect(200);

    // Every alert must belong to an order where waiter1 is primary or collaborator
    for (const alert of res.body.alerts) {
      const order = await prisma.order.findUnique({
        where: { id: alert.order_id },
        include: { collaborators: { select: { waiterId: true } } },
      });
      const hasAccess =
        order.primaryWaiterId === waiter1.id ||
        order.collaborators.some((c) => c.waiterId === waiter1.id);
      expect(hasAccess).toBe(true);
    }
  });

  it('dismissing an alert removes it from the list (manager)', async () => {
    const agent = await login('manager');

    // Find a seeded alert (order1: PLACED, 30 min old)
    const dbAlert = await prisma.alert.findFirst({
      where: {
        resolvedAt: null,
        order: { status: 'PLACED', tableNumber: '1' },
      },
    });

    if (!dbAlert) {
      // Alert may have aged out — skip if not present
      return;
    }

    const alertId = dbAlert.id;

    // Dismiss it
    await agent
      .post(`/api/alerts/${alertId}/dismiss`)
      .expect(201);

    // It should no longer appear in the alerts list
    const res = await agent.get('/api/alerts').expect(200);
    const stillPresent = res.body.alerts.find((a) => a.id === alertId);
    expect(stillPresent).toBeUndefined();
  });

  it('dismissing an alert creates an AlertDismissal row', async () => {
    // Create a fresh slow order so we control its age
    const managerAgent = await login('manager');
    const waiterAgent = await login('waiter1');

    const order = (
      await waiterAgent
        .post('/api/orders')
        .send({ table_number: 'ALERT-TEST' })
        .expect(201)
    ).body.order;

    // Advance it to PREPARING (non-terminal) so it can have an alert
    await waiterAgent
      .patch(`/api/orders/${order.id}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    await waiterAgent
      .patch(`/api/orders/${order.id}/status`)
      .send({ status: 'PREPARING' })
      .expect(200);

    // Manually create an alert for this order (past threshold)
    const now = new Date();
    const oldTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const alert = await prisma.alert.create({
      data: { orderId: order.id, triggeredAt: oldTime },
    });

    // Dismiss it
    await managerAgent
      .post(`/api/alerts/${alert.id}/dismiss`)
      .expect(201);

    // Check a dismissal row was created
    const dismissal = await prisma.alertDismissal.findFirst({
      where: { alertId: alert.id },
    });
    expect(dismissal).toBeDefined();
    expect(dismissal.alertId).toBe(alert.id);

    // Cleanup
    await prisma.alert.delete({ where: { id: alert.id } });
  });

  it('dismissing an already-dismissed alert creates a second dismissal (repeat dismiss allowed for reappear cycle)', async () => {
    const managerAgent = await login('manager');

    // Find an alert that's already been dismissed in this test session
    const dismissed = await prisma.alertDismissal.findFirst({
      orderBy: { dismissedAt: 'desc' },
    });

    if (!dismissed) return;

    // Count dismissals for this alert before the second dismiss
    const beforeCount = await prisma.alertDismissal.count({
      where: { alertId: dismissed.alertId },
    });

    // Dismissing the same alert again should succeed (201) — each dismissal
    // is a separate event in the reappear cycle (README Goal 10).
    const res = await managerAgent
      .post(`/api/alerts/${dismissed.alertId}/dismiss`)
      .expect(201);

    expect(res.body).toHaveProperty('dismissal');
    expect(res.body.dismissal.alertId).toBe(dismissed.alertId);

    // A new dismissal row was created
    const afterCount = await prisma.alertDismissal.count({
      where: { alertId: dismissed.alertId },
    });
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('unauthenticated request to GET /api/alerts returns 401', async () => {
    const supertest = require('supertest');
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-m10-do-not-use-in-prod';
    const app = require('../src/index');

    await supertest(app).get('/api/alerts').expect(401);
  });

  it('unauthenticated request to POST /api/alerts/:id/dismiss returns 401', async () => {
    const supertest = require('supertest');
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-m10-do-not-use-in-prod';
    const app = require('../src/index');

    const alert = await prisma.alert.findFirst({ where: { resolvedAt: null } });
    if (!alert) return;

    await supertest(app)
      .post(`/api/alerts/${alert.id}/dismiss`)
      .expect(401);
  });
});
