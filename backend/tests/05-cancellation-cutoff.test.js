// M10 Test Suite 5 — Cancellation Cutoff (Goal 4)
//
// Verifies:
//   - Can cancel while PLACED  → 200
//   - Can cancel while ACCEPTED → 200
//   - Cannot cancel while PREPARING → 409 with explanatory message
//   - Cannot cancel while READY  → 409
//   - Cannot cancel while SERVED → 409 (terminal)
//   - Cannot cancel while CANCELLED → 409 (terminal)
import { describe, it, expect } from 'vitest';
const { login } = require('./helpers');

async function createOrder(agent) {
  const res = await agent
    .post('/api/orders')
    .send({ table_number: 'CANCEL-TEST' })
    .expect(201);
  return res.body.order;
}

function transitionTo(agent, orderId, toStatus) {
  return agent.patch(`/api/orders/${orderId}/status`).send({ status: toStatus });
}

function cancel(agent, orderId) {
  return agent.patch(`/api/orders/${orderId}/status`).send({ status: 'CANCELLED' });
}

describe('Cancellation Cutoff', () => {
  it('can cancel while PLACED', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);

    const res = await cancel(agent, order.id);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELLED');
  });

  it('can cancel while ACCEPTED', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);

    const res = await cancel(agent, order.id);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELLED');
  });

  it('cannot cancel while PREPARING — returns 409 with cancel_too_late', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
    await transitionTo(agent, order.id, 'PREPARING').expect(200);

    const res = await cancel(agent, order.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
    expect(res.body.details.code).toBe('INVALID_TRANSITION');
    expect(res.body.details.reason).toBe('cancel_too_late');
    expect(res.body.message.toLowerCase()).toMatch(/cancel/i);
  });

  it('cannot cancel while READY — returns 409 with cancel_too_late', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
    await transitionTo(agent, order.id, 'PREPARING').expect(200);
    await transitionTo(agent, order.id, 'READY').expect(200);

    const res = await cancel(agent, order.id);

    expect(res.status).toBe(409);
    expect(res.body.details.reason).toBe('cancel_too_late');
  });

  it('cannot cancel while SERVED — returns 409 (terminal)', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await transitionTo(agent, order.id, 'ACCEPTED').expect(200);
    await transitionTo(agent, order.id, 'PREPARING').expect(200);
    await transitionTo(agent, order.id, 'READY').expect(200);
    await transitionTo(agent, order.id, 'SERVED').expect(200);

    const res = await cancel(agent, order.id);

    expect(res.status).toBe(409);
    expect(res.body.details.reason).toBe('terminal_status');
  });

  it('cannot cancel an already CANCELLED order', async () => {
    const agent = await login('waiter1');
    const order = await createOrder(agent);
    await cancel(agent, order.id).expect(200); // first cancel succeeds

    const res = await cancel(agent, order.id);

    expect(res.status).toBe(409);
    expect(res.body.details.reason).toBe('terminal_status');
  });
});
