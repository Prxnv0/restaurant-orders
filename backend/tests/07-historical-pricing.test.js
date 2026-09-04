// M10 Test Suite 7 — Historical Pricing (Goal 3)
//
// Verifies the price-snapshot rule:
//   When an order line is created, its unitPrice is captured at the menu
//   item's current price. If the menu price is later changed, the line
//   total must still reflect the snapshot, not the new price.
import { describe, it, expect } from 'vitest';
const { login, prisma, getUser } = require('./helpers');

describe('Historical Pricing — order lines use price snapshot', () => {
  it('a line added at $12.50 stays at $12.50 even if the menu price is changed to $20.00', async () => {
    const agent = await login('manager');
    const manager = await getUser('manager');

    // Create a menu item at $12.50
    const itemRes = await agent
      .post('/api/menu')
      .send({ name: 'Snapshot Test Burger', price: 12.5 })
      .expect(201);
    const menuItem = itemRes.body.item;

    // Create an order as a waiter
    const waiterAgent = await login('waiter1');
    const order = (
      await waiterAgent
        .post('/api/orders')
        .send({ table_number: 'SNAPSHOT' })
        .expect(201)
    ).body.order;

    // Add a line at the current price ($12.50)
    const lineRes = await waiterAgent
      .post(`/api/orders/${order.id}/lines`)
      .send({ menu_item_id: menuItem.id, quantity: 2 })
      .expect(201);
    const line = lineRes.body.line;

    // The line should have unitPrice = 12.50
    expect(Number(line.unitPrice)).toBe(12.5);

    // Compute the line total: 2 × 12.50 = 25.00
    const initialTotal = Number(line.unitPrice) * line.quantity;
    expect(initialTotal).toBe(25.0);

    // Now change the menu price to $20.00
    await agent
      .patch(`/api/menu/${menuItem.id}`)
      .send({ price: 20.0 })
      .expect(200);

    // Fetch the order again
    const orderRes = await waiterAgent.get(`/api/orders/${order.id}`).expect(200);
    const fetchedLine = orderRes.body.order.lines.find((l) => l.id === line.id);

    // The fetched line should still have unitPrice = 12.50 (snapshot, not 20.00)
    expect(Number(fetchedLine.unitPrice)).toBe(12.5);

    // The order total should be 2 × 12.50 = 25.00, NOT 2 × 20.00
    expect(orderRes.body.order.total).toBe(25.0);

    // Verify in the DB directly
    const dbLine = await prisma.orderLine.findUnique({ where: { id: line.id } });
    expect(Number(dbLine.unitPrice)).toBe(12.5);

    // Cleanup: delete test orders first (cascades to order lines), then the menu item
    const testOrders = await prisma.order.findMany({
      where: { tableNumber: 'SNAPSHOT' },
      select: { id: true },
    });
    for (const o of testOrders) {
      await prisma.order.delete({ where: { id: o.id } });
    }
    await prisma.menuItem.delete({ where: { id: menuItem.id } });
  });

  it('a NEW line added after the price change uses the NEW price', async () => {
    const agent = await login('manager');

    // Create a menu item at $10
    const itemRes = await agent
      .post('/api/menu')
      .send({ name: 'New Line Price Test', price: 10.0 })
      .expect(201);
    const menuItem = itemRes.body.item;

    // Change price to $15
    await agent
      .patch(`/api/menu/${menuItem.id}`)
      .send({ price: 15.0 })
      .expect(200);

    // Create an order and add a new line
    const waiterAgent = await login('waiter1');
    const order = (
      await waiterAgent
        .post('/api/orders')
        .send({ table_number: 'NEW-LINE' })
        .expect(201)
    ).body.order;

    const lineRes = await waiterAgent
      .post(`/api/orders/${order.id}/lines`)
      .send({ menu_item_id: menuItem.id, quantity: 3 })
      .expect(201);

    // The new line should use the NEW price ($15)
    expect(Number(lineRes.body.line.unitPrice)).toBe(15.0);

    // Cleanup: delete test orders first (cascades to order lines), then the menu item
    const testOrders = await prisma.order.findMany({
      where: { tableNumber: 'NEW-LINE' },
      select: { id: true },
    });
    for (const o of testOrders) {
      await prisma.order.delete({ where: { id: o.id } });
    }
    await prisma.menuItem.delete({ where: { id: menuItem.id } });
  });
});
