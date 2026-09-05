/**
 * Seed script.
 *
 * Creates enough demo data to showcase every mandatory goal.
 * Run with: node prisma/seed.js
 * (Ensure DATABASE_URL is set and prisma generate has run.)
 *
 * Data is deterministic-ish: each run drops and recreates all tables first
 * so the seed is idempotent.
 */

const { PrismaClient } = require('@prisma/client');
const { hashSync } = require('bcryptjs');
const { randomUUID } = require('crypto');

// Load .env from backend root
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const prisma = new PrismaClient();

// ── Helpers ─────────────────────────────────────────────────────────────
async function main() {
  // Clean slate (order matters because of FKs)
  await prisma.$executeRaw`TRUNCATE TABLE "alert_dismissals" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "alerts" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "order_notes" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "order_history_entries" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "order_collaborators" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "order_lines" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "orders" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "menu_items" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`;

  // ── Users ──────────────────────────────────────────────────────────
  const manager = await prisma.user.create({
    data: {
      email: 'manager@busy-demo.com',
      passwordHash: hashSync('password123', 10),
      name: 'Alex Manager',
      role: 'MANAGER',
    },
  });

  const waiter1 = await prisma.user.create({
    data: {
      email: 'waiter1@busy-demo.com',
      passwordHash: hashSync('password123', 10),
      name: 'Jordan Waiter',
      role: 'WAITER',
    },
  });

  const waiter2 = await prisma.user.create({
    data: {
      email: 'waiter2@busy-demo.com',
      passwordHash: hashSync('password123', 10),
      name: 'Casey Collaborator',
      role: 'WAITER',
    },
  });

  // ── Menu items ─────────────────────────────────────────────────────
  const menuItems = await Promise.all(
    [
      { name: 'Classic Burger', price: 12.5, available: true },
      { name: 'Truffle Fries', price: 5.5, available: true },
      { name: 'Caesar Salad', price: 8.0, available: true },
      { name: 'Grilled Salmon', price: 18.0, available: true },
      { name: 'Mushroom Risotto', price: 14.0, available: false }, // unavailable
      { name: 'Tiramisu', price: 7.5, available: true },
    ].map((m) =>
      prisma.menuItem.create({
        data: {
          name: m.name,
          price: m.price,
          isAvailable: m.available,
          isArchived: false,
        },
      })
    )
  );

  // ── Orders ─────────────────────────────────────────────────────────
  const now = new Date();

  // Order 1: PLACED, ~30 minutes old (should trigger alert)
  const order1 = await prisma.order.create({
    data: {
      tableNumber: '1',
      status: 'PLACED',
      primaryWaiterId: waiter1.id,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
      archivedAt: null,
    },
  });

  // Order 2: ACCEPTED
  const order2 = await prisma.order.create({
    data: {
      tableNumber: '2',
      status: 'ACCEPTED',
      primaryWaiterId: waiter1.id,
      createdAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 min ago
    },
  });

  // Order 3: PREPARING
  const order3 = await prisma.order.create({
    data: {
      tableNumber: '3',
      status: 'PREPARING',
      primaryWaiterId: waiter1.id,
      createdAt: new Date(now.getTime() - 20 * 60 * 1000), // 20 min ago
    },
  });

  // Order 4: READY
  const order4 = await prisma.order.create({
    data: {
      tableNumber: '4',
      status: 'READY',
      primaryWaiterId: waiter1.id,
      createdAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 min ago
    },
  });

  // Order 5: SERVED
  const order5 = await prisma.order.create({
    data: {
      tableNumber: '5',
      status: 'SERVED',
      primaryWaiterId: waiter1.id,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
      servedAt: new Date(now.getTime() - 2 * 60 * 1000), // served 2 min ago
    },
  });

  // Order 6: CANCELLED (while PLACED)
  const order6 = await prisma.order.create({
    data: {
      tableNumber: '6',
      status: 'CANCELLED',
      primaryWaiterId: waiter1.id,
      createdAt: new Date(now.getTime() - 12 * 60 * 1000),
    },
  });

  // Order 7: Archived
  const order7 = await prisma.order.create({
    data: {
      tableNumber: '7',
      status: 'PLACED',
      primaryWaiterId: waiter1.id,
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
      archivedAt: now,
    },
  });

  // ── Order lines ────────────────────────────────────────────────────
  // Order 1 lines
  const order1Line1 = await prisma.orderLine.create({
    data: {
      orderId: order1.id,
      menuItemId: menuItems[0].id, // Classic Burger 12.50
      quantity: 2,
      unitPrice: 12.5,
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
  });
  const order1Line2 = await prisma.orderLine.create({
    data: {
      orderId: order1.id,
      menuItemId: menuItems[1].id, // Truffle Fries 5.50
      quantity: 1,
      unitPrice: 5.5,
      specialInstructions: 'no salt please',
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
  });

  // Order 2 lines
  await prisma.orderLine.create({
    data: {
      orderId: order2.id,
      menuItemId: menuItems[2].id, // Caesar Salad 8.00
      quantity: 1,
      unitPrice: 8.0,
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 10 * 60 * 1000),
    },
  });

  // Order 3 lines — one will be voided
  const order3Line1 = await prisma.orderLine.create({
    data: {
      orderId: order3.id,
      menuItemId: menuItems[3].id, // Grilled Salmon 18.00
      quantity: 1,
      unitPrice: 18.0,
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 20 * 60 * 1000),
    },
  });
  const order3Line2 = await prisma.orderLine.create({
    data: {
      orderId: order3.id,
      menuItemId: menuItems[5].id, // Tiramisu 7.50
      quantity: 2,
      unitPrice: 7.5,
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 20 * 60 * 1000),
    },
  });

  // Void order3Line2 with reason
  await prisma.orderLine.update({
    where: { id: order3Line2.id },
    data: {
      status: 'VOID',
      voidReason: 'Customer changed mind',
      voidedById: waiter1.id,
      voidedAt: new Date(now.getTime() - 15 * 60 * 1000),
    },
  });

  // Order 4 lines
  await prisma.orderLine.create({
    data: {
      orderId: order4.id,
      menuItemId: menuItems[0].id,
      quantity: 1,
      unitPrice: 12.5,
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 15 * 60 * 1000),
    },
  });

  // Order 5 lines (served)
  await prisma.orderLine.create({
    data: {
      orderId: order5.id,
      menuItemId: menuItems[3].id,
      quantity: 2,
      unitPrice: 18.0,
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000),
    },
  });

  // Order 6 lines (cancelled)
  await prisma.orderLine.create({
    data: {
      orderId: order6.id,
      menuItemId: menuItems[1].id,
      quantity: 1,
      unitPrice: 5.5,
      createdById: waiter1.id,
      createdAt: new Date(now.getTime() - 12 * 60 * 1000),
    },
  });

  // ── History entries ────────────────────────────────────────────────
  // No entry is written for the initial PLACED status — the order's
  // createdAt timestamp is the source of truth for that event.
  const makeHistory = async (orderId, eventType, details, actorId) => {
    await prisma.orderHistoryEntry.create({
      data: { orderId, eventType, details, actorId },
    });
  };

  await makeHistory(order1.id, 'STATUS_CHANGE', { old_status: 'PLACED', new_status: 'ACCEPTED' }, waiter1.id);
  await makeHistory(order2.id, 'STATUS_CHANGE', { old_status: 'PLACED', new_status: 'ACCEPTED' }, waiter1.id);
  await makeHistory(order3.id, 'STATUS_CHANGE', { old_status: 'ACCEPTED', new_status: 'PREPARING' }, waiter1.id);
  await makeHistory(order4.id, 'STATUS_CHANGE', { old_status: 'PREPARING', new_status: 'READY' }, waiter1.id);
  await makeHistory(order5.id, 'STATUS_CHANGE', { old_status: 'READY', new_status: 'SERVED' }, waiter1.id);
  await makeHistory(order6.id, 'STATUS_CHANGE', { old_status: 'PLACED', new_status: 'CANCELLED' }, waiter1.id);

  // Line-added history for order1
  await makeHistory(order1.id, 'LINE_ADDED', { line_id: order1Line1.id, menu_item_id: menuItems[0].id, quantity: 2, unit_price: 12.5 }, waiter1.id);
  await makeHistory(order1.id, 'LINE_ADDED', { line_id: order1Line2.id, menu_item_id: menuItems[1].id, quantity: 1, unit_price: 5.5 }, waiter1.id);

  // Line-voided history for order3
  await makeHistory(order3.id, 'LINE_VOIDED', { line_id: order3Line2.id, reason: 'Customer changed mind' }, waiter1.id);

  // Collaborator added history (order2)
  await makeHistory(order2.id, 'COLLABORATOR_ADDED', { waiter_id: waiter2.id }, waiter1.id);

  // ── Collaborators ──────────────────────────────────────────────────
  await prisma.orderCollaborator.create({
    data: { orderId: order2.id, waiterId: waiter2.id, addedById: waiter1.id },
  });

  // ── Notes ──────────────────────────────────────────────────────────
  await prisma.orderNote.create({
    data: { orderId: order1.id, content: 'Customer is celebrating a birthday — please keep noise down.', createdById: waiter1.id },
  });
  await prisma.orderNote.create({
    data: { orderId: order3.id, content: 'Grilled Salmon cooked medium-well per customer.', createdById: waiter1.id },
  });

  // ── Alerts ─────────────────────────────────────────────────────────
  // Order 1 is 30 min old and PLACED → alert triggered
  const alert1 = await prisma.alert.create({
    data: { orderId: order1.id, triggeredAt: new Date(now.getTime() - 30 * 60 * 1000) },
  });

  // Order 2 is 10 min old → no alert (below threshold)
  // Order 3 is 20 min old and PREPARING → alert triggered (assuming 15 min threshold)
  const alert3 = await prisma.alert.create({
    data: { orderId: order3.id, triggeredAt: new Date(now.getTime() - 20 * 60 * 1000) },
  });

  // Order 3 has one dismissal from 5 min ago → currently hidden (within threshold)
  await prisma.alertDismissal.create({
    data: { alertId: alert3.id, dismissedById: waiter1.id },
  });

  // ── Print summary ──────────────────────────────────────────────────
  console.log('Seed complete.');
  console.log({
    manager: manager.email,
    waiter1: waiter1.email,
    waiter2: waiter2.email,
    orders: await prisma.order.count(),
    menuItems: await prisma.menuItem.count(),
    orderLines: await prisma.orderLine.count(),
    historyEntries: await prisma.orderHistoryEntry.count(),
    alerts: await prisma.alert.count(),
    dismissals: await prisma.alertDismissal.count(),
    collaborators: await prisma.orderCollaborator.count(),
    notes: await prisma.orderNote.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
