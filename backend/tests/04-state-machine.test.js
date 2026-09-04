// M10 Test Suite 4 — Order State Machine via HTTP (Goal 4)
//
// Tests every valid and invalid state transition through the PATCH /api/orders/:id/status
// route. Each transition is tested in isolation by creating a fresh order.
//
// Valid transitions tested:
//   PLACED → ACCEPTED
//   ACCEPTED → PREPARING
//   PREPARING → READY
//   READY → SERVED
//   PLACED → CANCELLED
//   ACCEPTED → CANCELLED
//
// Invalid transitions tested:
//   PLACED → PREPARING (skip)
//   PLACED → READY (skip)
//   PLACED → SERVED (skip)
//   ACCEPTED → READY (skip)
//   ACCEPTED → SERVED (skip)
//   PREPARING → SERVED (skip)
//   PREPARING → CANCELLED (cancel too late)
//   READY → CANCELLED (cancel too late)
//   SERVED → any (terminal)
//   CANCELLED → any (terminal)
//   BACKWARD: ACCEPTED → PLACED, PREPARING → ACCEPTED, etc.
import { describe, it, expect } from 'vitest';
const { login, prisma } = require('./helpers');

async function createOrder(agent) {
  const res = await agent
    .post('/api/orders')
    .send({ table_number: 'SM-TEST' })
    .expect(201);
  return res.body.order;
}

function transitionTo(agent, orderId, toStatus) {
  return agent.patch(`/api/orders/${orderId}/status`).send({ status: toStatus });
}

async function countHistory(orderId, eventType) {
  return prisma.orderHistoryEntry.count({ where: { orderId, eventType } });
}

describe('Order State Machine — Valid Transitions', () => {
  it('PLACED → ACCEPTED: returns 200, updates status, creates history entry', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);

    const res = await transitionTo(agent, order.id, 'ACCEPTED').expect(200);

    expect(res.body.order.status).toBe('ACCEPTED');
    const count = await countHistory(order.id, 'STATUS_CHANGE');
    expect(count).toBeGreaterThan(0);
  });

  it('ACCEPTED → PREPARING: returns 200, updates status', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);

    const res = await transitionTo(agent, order.id, 'PREPARING').expect(200);

    expect(res.body.order.status).toBe('PREPARING');
  });

  it('PREPARING → READY: returns 200, updates status', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
    await transitionTo(agent, order.id, 'PREPARING').expect(200);

    const res = await transitionTo(agent, order.id, 'READY').expect(200);

    expect(res.body.order.status).toBe('READY');
  });

  it('READY → SERVED: returns 200, updates status, sets served_at', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
    await transitionTo(agent, order.id, 'PREPARING').expect(200);
    await transitionTo(agent, order.id, 'READY').expect(200);

    const res = await transitionTo(agent, order.id, 'SERVED').expect(200);

    expect(res.body.order.status).toBe('SERVED');
    expect(res.body.order.servedAt).toBeDefined();
  });

  it('PLACED → CANCELLED: returns 200 while order is still PLACED', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);

    const res = await transitionTo(agent, order.id, 'CANCELLED').expect(200);

    expect(res.body.order.status).toBe('CANCELLED');
  });

  it('ACCEPTED → CANCELLED: returns 200 while order is still ACCEPTED', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);

    const res = await transitionTo(agent, order.id, 'CANCELLED').expect(200);

    expect(res.body.order.status).toBe('CANCELLED');
  });
});

describe('Order State Machine — Invalid Transitions', () => {
  async function assertInvalid(fromStatus, toStatus, expectedReason) {
    const agent = await login('waiter1');
    const order = await createOrder(agent);

    // Advance to fromStatus
    if (fromStatus === 'ACCEPTED') {
      await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
    } else if (fromStatus === 'PREPARING') {
      await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
      await transitionTo(agent, order.id, 'PREPARING').expect(200);
    } else if (fromStatus === 'READY') {
      await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
      await transitionTo(agent, order.id, 'PREPARING').expect(200);
      await transitionTo(agent, order.id, 'READY').expect(200);
    } else if (fromStatus === 'SERVED') {
      await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
      await transitionTo(agent, order.id, 'PREPARING').expect(200);
      await transitionTo(agent, order.id, 'READY').expect(200);
      await transitionTo(agent, order.id, 'SERVED').expect(200);
    } else if (fromStatus === 'CANCELLED') {
      await transitionTo(agent, order.id, 'CANCELLED').expect(200);
    }

    const res = await transitionTo(agent, order.id, toStatus);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.code).toBe('INVALID_TRANSITION');
    expect(res.body.details.reason).toBe(expectedReason);
  }

  it('PLACED → PREPARING is rejected (skip)', async () => {
    await assertInvalid('PLACED', 'PREPARING', 'skip_states');
  });

  it('PLACED → READY is rejected (skip)', async () => {
    await assertInvalid('PLACED', 'READY', 'skip_states');
  });

  it('PLACED → SERVED is rejected (skip)', async () => {
    await assertInvalid('PLACED', 'SERVED', 'skip_states');
  });

  it('ACCEPTED → READY is rejected (skip)', async () => {
    await assertInvalid('ACCEPTED', 'READY', 'skip_states');
  });

  it('ACCEPTED → SERVED is rejected (skip)', async () => {
    await assertInvalid('ACCEPTED', 'SERVED', 'skip_states');
  });

  it('PREPARING → SERVED is rejected (skip)', async () => {
    await assertInvalid('PREPARING', 'SERVED', 'skip_states');
  });

  it('PREPARING → CANCELLED is rejected (cancel too late)', async () => {
    await assertInvalid('PREPARING', 'CANCELLED', 'cancel_too_late');
  });

  it('READY → CANCELLED is rejected (cancel too late)', async () => {
    await assertInvalid('READY', 'CANCELLED', 'cancel_too_late');
  });

  it('SERVED → ACCEPTED is rejected (terminal)', async () => {
    await assertInvalid('SERVED', 'ACCEPTED', 'terminal_status');
  });

  it('CANCELLED → PLACED is rejected (terminal)', async () => {
    await assertInvalid('CANCELLED', 'PLACED', 'terminal_status');
  });

  it('BACKWARD: ACCEPTED → PLACED is rejected', async () => {
    await assertInvalid('ACCEPTED', 'PLACED', 'backward_transition');
  });

  it('BACKWARD: PREPARING → ACCEPTED is rejected', async () => {
    await assertInvalid('PREPARING', 'ACCEPTED', 'backward_transition');
  });

  it('BACKWARD: READY → PREPARING is rejected', async () => {
    await assertInvalid('READY', 'PREPARING', 'backward_transition');
  });

  it('SELF: PLACED → PLACED is rejected (no-op)', async () => {
    await assertInvalid('PLACED', 'PLACED', 'no_op');
  });
});

describe('State Machine — Error message is human-readable', () => {
  it('cancel too late message mentions "cancel"', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
    await transitionTo(agent, order.id, 'PREPARING').expect(200);

    const res = await transitionTo(agent, order.id, 'CANCELLED');

    expect(res.status).toBe(409);
    expect(res.body.message.toLowerCase()).toMatch(/cancel/i);
  });

  it('skip states message mentions lifecycle/steps', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);

    const res = await transitionTo(agent, order.id, 'READY');

    expect(res.status).toBe(409);
    expect(res.body.message.toLowerCase()).toMatch(/step|lifecycle|skip/i);
  });
});
