// M10 Test Suite 8 — Immutable History (Goal 9)
//
// The README states: "history of every status change (old, new, actor),
// every line added/voided, every note" must be immutable — no edit or
// delete endpoints. This test verifies that no such routes exist.
//
// We attempt PATCH/DELETE/PUT/POST against history and notes entries and
// assert that the server returns 404 or 405 (no such route), not 200/204.
import { describe, it, expect } from 'vitest';
const { login, prisma } = require('./helpers');

describe('Immutable History & Notes', () => {
  it('rejects PATCH /api/orders/:id/history/:entryId with 404', async () => {
    const agent = await login('manager');

    // Use a seeded order with history entries
    const order = await prisma.order.findFirst({
      where: { historyEntries: { some: {} } },
    });
    expect(order).toBeDefined();

    const entry = await prisma.orderHistoryEntry.findFirst({
      where: { orderId: order.id },
    });
    expect(entry).toBeDefined();

    const res = await agent
      .patch(`/api/orders/${order.id}/history/${entry.id}`)
      .send({ eventType: 'TAMPERED' });

    // Express returns 404 for unmatched routes
    expect([404, 405]).toContain(res.status);
  });

  it('rejects DELETE /api/orders/:id/history/:entryId with 404', async () => {
    const agent = await login('manager');

    const order = await prisma.order.findFirst({
      where: { historyEntries: { some: {} } },
    });
    const entry = await prisma.orderHistoryEntry.findFirst({
      where: { orderId: order.id },
    });

    const res = await agent.delete(`/api/orders/${order.id}/history/${entry.id}`);

    expect([404, 405]).toContain(res.status);

    // Entry should still exist
    const stillThere = await prisma.orderHistoryEntry.findUnique({
      where: { id: entry.id },
    });
    expect(stillThere).toBeDefined();
  });

  it('rejects PUT /api/orders/:id/notes/:noteId with 404', async () => {
    const agent = await login('manager');

    const order = await prisma.order.findFirst({
      where: { notes: { some: {} } },
    });
    expect(order).toBeDefined();

    const note = await prisma.orderNote.findFirst({
      where: { orderId: order.id },
    });
    expect(note).toBeDefined();

    const res = await agent
      .put(`/api/orders/${order.id}/notes/${note.id}`)
      .send({ content: 'Edited content' });

    expect([404, 405]).toContain(res.status);
  });

  it('rejects DELETE /api/orders/:id/notes/:noteId with 404', async () => {
    const agent = await login('manager');

    const order = await prisma.order.findFirst({
      where: { notes: { some: {} } },
    });
    const note = await prisma.orderNote.findFirst({
      where: { orderId: order.id },
    });

    const res = await agent.delete(`/api/orders/${order.id}/notes/${note.id}`);

    expect([404, 405]).toContain(res.status);

    // Note should still exist
    const stillThere = await prisma.orderNote.findUnique({
      where: { id: note.id },
    });
    expect(stillThere).toBeDefined();
  });

  it('rejects PATCH /api/orders/:id/notes/:noteId with 404', async () => {
    const agent = await login('manager');

    const order = await prisma.order.findFirst({
      where: { notes: { some: {} } },
    });
    const note = await prisma.orderNote.findFirst({
      where: { orderId: order.id },
    });

    const res = await agent
      .patch(`/api/orders/${order.id}/notes/${note.id}`)
      .send({ content: 'Updated text' });

    expect([404, 405]).toContain(res.status);
  });

  it('rejects POST /api/orders/:id/notes with empty body (400)', async () => {
    const agent = await login('waiter1');
    const order = await prisma.order.findFirst({
      where: { primaryWaiter: { email: 'waiter1@busy-demo.com' } },
    });

    const res = await agent.post(`/api/orders/${order.id}/notes`).send({});

    // Empty body is a 400, not 201 — the validator catches it
    expect(res.status).toBe(400);
  });
});
