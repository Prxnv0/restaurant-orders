// M10 Test Suite 6 — Line Void (Goal 4)
//
// Verifies:
//   - Succeeds with a non-empty reason → 200
//   - Rejects missing reason (400)
//   - Rejects empty reason (400)
//   - Rejects when order is SERVED (409)
//   - Rejects when order is CANCELLED (409)
//   - Rejects when line is already VOID (409)
//   - History entry created with the reason
import { describe, it, expect } from 'vitest';
const { login, prisma } = require('./helpers');

async function createOrderWithLine(agent) {
  const order = (
    await agent.post('/api/orders').send({ table_number: 'VOID-TEST' }).expect(201)
  ).body.order;
  const menuItem = await prisma.menuItem.findFirst({ where: { isAvailable: true } });
  const line = (
    await agent
      .post(`/api/orders/${order.id}/lines`)
      .send({ menu_item_id: menuItem.id, quantity: 1 })
      .expect(201)
  ).body.line;
  return { order, line };
}

describe('Line Void', () => {
  it('succeeds with a valid reason → 200', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);

    const res = await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: 'Customer changed mind' })
      .expect(200);

    expect(res.body.line.status).toBe('VOID');
    expect(res.body.line.voidReason).toBe('Customer changed mind');
    expect(res.body.line.voidedAt).toBeDefined();
  });

  it('rejects when reason is missing (400)', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);

    const res = await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({})
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
    expect(res.body.message.toLowerCase()).toMatch(/reason/i);
  });

  it('rejects when reason is empty (400)', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);

    const res = await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: '' })
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
  });

  it('rejects when reason is whitespace only (400)', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);

    const res = await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: '   ' })
      .expect(400);

    expect(res.body.error).toBe('BAD_REQUEST');
  });

  it('rejects when order is SERVED (409)', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);
    // Walk to SERVED
    await agent
      .patch(`/api/orders/${order.id}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    await agent
      .patch(`/api/orders/${order.id}/status`)
      .send({ status: 'PREPARING' })
      .expect(200);
    await agent
      .patch(`/api/orders/${order.id}/status`)
      .send({ status: 'READY' })
      .expect(200);
    await agent
      .patch(`/api/orders/${order.id}/status`)
      .send({ status: 'SERVED' })
      .expect(200);

    const res = await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: 'too late' })
      .expect(409);

    expect(res.body.error).toBe('CONFLICT');
    expect(res.body.message).toMatch(/SERVED/);
  });

  it('rejects when order is CANCELLED (409)', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);
    await agent
      .patch(`/api/orders/${order.id}/status`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    const res = await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: 'after cancel' })
      .expect(409);

    expect(res.body.error).toBe('CONFLICT');
    expect(res.body.message).toMatch(/CANCELLED/);
  });

  it('rejects when line is already VOID (409)', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);

    // First void
    await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: 'first' })
      .expect(200);

    // Second attempt
    const res = await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: 'second' })
      .expect(409);

    expect(res.body.error).toBe('CONFLICT');
    expect(res.body.message.toLowerCase()).toMatch(/already.*void/i);
  });

  it('creates a LINE_VOIDED history entry with the reason', async () => {
    const agent = await login('waiter1');
    const { order, line } = await createOrderWithLine(agent);

    await agent
      .post(`/api/orders/${order.id}/lines/${line.id}/void`)
      .send({ reason: 'Kitchen out of stock' })
      .expect(200);

    const entries = await prisma.orderHistoryEntry.findMany({
      where: { orderId: order.id, eventType: 'LINE_VOIDED' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].details.reason).toBe('Kitchen out of stock');
    expect(entries[0].details.line_id).toBe(line.id);
  });
});
