// M10 Test Suite 9 — Bulk Update (Goal 7)
//
// Verifies the per-item result shape of POST /api/menu/bulk-update:
//   - 3 items submitted where 1 has a problem → response has
//     { succeeded: [2 items], rejected: [1 item with reason] }
//   - Valid items have their updates applied
//   - Invalid items are unchanged
import { describe, it, expect, afterAll } from 'vitest';
const { login, prisma } = require('./helpers');

describe('Bulk Update', () => {
  it('submits 3 items where 1 has a non-existent id; 2 succeed, 1 rejected', async () => {
    const agent = await login('manager');

    // Get 2 real menu items
    const items = await prisma.menuItem.findMany({ take: 2 });
    expect(items).toHaveLength(2);
    const realId1 = items[0].id;
    const realId2 = items[1].id;
    const fakeId = '00000000-0000-0000-0000-000000000999';

    const res = await agent
      .post('/api/menu/bulk-update')
      .send({
        item_ids: [realId1, fakeId, realId2],
        is_available: false,
      })
      .expect(200);

    expect(res.body.succeeded).toBeDefined();
    expect(res.body.rejected).toBeDefined();

    expect(res.body.succeeded).toHaveLength(2);
    expect(res.body.rejected).toHaveLength(1);

    // The 2 successful ids should be the real ones
    const successIds = res.body.succeeded.map((s) => s.id);
    expect(successIds).toContain(realId1);
    expect(successIds).toContain(realId2);
    expect(successIds).not.toContain(fakeId);

    // The rejected one is the fake id with a reason
    expect(res.body.rejected[0].id).toBe(fakeId);
    expect(res.body.rejected[0].reason).toMatch(/not found/i);

    // Verify the 2 real items were actually updated
    const updated1 = await prisma.menuItem.findUnique({ where: { id: realId1 } });
    const updated2 = await prisma.menuItem.findUnique({ where: { id: realId2 } });
    expect(updated1.isAvailable).toBe(false);
    expect(updated2.isAvailable).toBe(false);
  });

  it('rejecting one item does not fail the whole batch', async () => {
    const agent = await login('manager');

    const items = await prisma.menuItem.findMany({ take: 1 });
    const realId = items[0].id;
    const fakeId = '00000000-0000-0000-0000-000000000000';

    // Mix: real + fake + real
    const res = await agent
      .post('/api/menu/bulk-update')
      .send({
        item_ids: [realId, fakeId],
        price: 99.99,
      })
      .expect(200);

    // Status is 200 (not 4xx) — the per-item rejection is in the body
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toHaveLength(1);
    expect(res.body.rejected).toHaveLength(1);
  });

  it('empty item_ids list is rejected by validator (400)', async () => {
    const agent = await login('manager');

    const res = await agent
      .post('/api/menu/bulk-update')
      .send({ item_ids: [], price: 5 })
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
  });

  it('body with neither price nor is_available is rejected (400)', async () => {
    const agent = await login('manager');
    const items = await prisma.menuItem.findMany({ take: 1 });

    const res = await agent
      .post('/api/menu/bulk-update')
      .send({ item_ids: [items[0].id] })
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
  });

  it('waiter is forbidden from bulk update (403)', async () => {
    const agent = await login('waiter1');
    const items = await prisma.menuItem.findMany({ take: 1 });

    const res = await agent
      .post('/api/menu/bulk-update')
      .send({ item_ids: [items[0].id], is_available: false })
      .expect(403);

    expect(res.body.error).toBe('FORBIDDEN');
  });

  // Cleanup: restore the items we changed
  afterAll(async () => {
    const items = await prisma.menuItem.findMany({ take: 2 });
    for (const item of items) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { isAvailable: true },
      });
    }
  });
});
