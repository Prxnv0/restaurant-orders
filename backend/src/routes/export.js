// Export route — manager only.
// GET /api/export/orders/today — CSV of today's orders with lines.
const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/authorize');

const router = express.Router();

// Escape a value for CSV (handle commas, quotes, newlines).
function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// GET /api/export/orders/today
router.get('/orders/today', auth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    // Determine today's date range in local timezone using Intl.DateTimeFormat.
    // This avoids the unreliable toLocaleString → Date round-trip.
    const tz = process.env.APP_TIMEZONE || 'UTC';
    const now = new Date();

    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA format: YYYY-MM-DD — parseable by Date constructor as UTC midnight.
    const [year, month, day] = fmt.format(now).split('-').map(Number);

    const todayStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const todayEndUTC = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

    // Local date string for the filename (YYYY-MM-DD in the configured timezone).
    const localDateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Fetch today's orders (any status, include archived) with lines.
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: todayStartUTC, lt: todayEndUTC },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        primaryWaiter: { select: { name: true } },
        lines: {
          include: {
            menuItem: { select: { name: true } },
            createdBy: { select: { name: true } },
            voidedBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Build CSV.
    const headers = [
      'Order ID',
      'Table',
      'Status',
      'Primary Waiter',
      'Created At',
      'Served At',
      'Archived',
      'Line #',
      'Item',
      'Quantity',
      'Unit Price',
      'Line Total',
      'Voided',
      'Void Reason',
      'Order Total',
    ];

    const rows = [];
    for (const order of orders) {
      // Compute order total from ACTIVE lines only.
      const orderTotal = order.lines
        .filter((l) => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + Number(l.unitPrice) * l.quantity, 0);

      // One row per line.
      for (let i = 0; i < order.lines.length; i++) {
        const line = order.lines[i];
        const lineTotal = line.status === 'ACTIVE'
          ? Number(line.unitPrice) * line.quantity
          : 0;

        rows.push([
          csvEscape(order.id),
          csvEscape(order.tableNumber),
          csvEscape(order.status),
          csvEscape(order.primaryWaiter.name),
          csvEscape(order.createdAt.toISOString()),
          csvEscape(order.servedAt ? order.servedAt.toISOString() : ''),
          csvEscape(order.archivedAt ? 'Yes' : 'No'),
          csvEscape(i + 1),
          csvEscape(line.menuItem.name),
          csvEscape(line.quantity),
          csvEscape(line.unitPrice),
          csvEscape(lineTotal),
          csvEscape(line.status === 'VOID' ? 'Yes' : 'No'),
          csvEscape(line.voidReason || ''),
          csvEscape(i === 0 ? orderTotal : ''), // show order total only on first line
        ]);
      }

      // If the order has no lines, emit a single summary row.
      if (order.lines.length === 0) {
        rows.push([
          csvEscape(order.id),
          csvEscape(order.tableNumber),
          csvEscape(order.status),
          csvEscape(order.primaryWaiter.name),
          csvEscape(order.createdAt.toISOString()),
          csvEscape(order.servedAt ? order.servedAt.toISOString() : ''),
          csvEscape(order.archivedAt ? 'Yes' : 'No'),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          csvEscape(orderTotal),
        ]);
      }
    }

    // Build CSV string.
    const csvLines = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ];
    const csv = csvLines.join('\r\n');

    // Filename: orders-YYYY-MM-DD.csv
    const filename = `orders-${localDateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
