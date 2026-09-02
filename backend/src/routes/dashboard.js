// Dashboard route — manager only.
// Returns headline metrics, status/waiter breakdowns, and 14-day served chart.
const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/authorize');
const AppError = require('../utils/errors');

const router = express.Router();

function getLocalDateStrings() {
  // Use APP_TIMEZONE env var (IANA name e.g. 'Asia/Kolkata'), default UTC.
  const tz = process.env.APP_TIMEZONE || 'UTC';
  const now = new Date();
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const offsetMs = localNow.getTime() - now.getTime();

  // Today in local timezone (start of day)
  const todayStart = new Date(localNow);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartUTC = new Date(todayStart.getTime() - offsetMs);

  // Yesterday at midnight local = 14 days ago start local
  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13); // inclusive: 14 entries total
  const fourteenDaysAgoUTC = new Date(fourteenDaysAgo.getTime() - offsetMs);

  // All 14 dates for the chart (inclusive of today)
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(fourteenDaysAgo.getDate() + i);
    const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
    dates.push(iso);
  }

  return { todayStartUTC, fourteenDaysAgoUTC, dates };
}

// GET /api/dashboard
router.get('/', auth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const { todayStartUTC, fourteenDaysAgoUTC, dates } = getLocalDateStrings();
    const thresholdMs = (Number(process.env.ALERT_THRESHOLD_MINUTES) || 15) * 60 * 1000;

    const now = new Date();

    // ── Open orders (non-terminal, non-archived) ──────────────────────────
    const openOrders = await prisma.order.count({
      where: {
        archivedAt: null,
        status: { in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] },
      },
    });

    // ── Placed today (any status, any archive state) ──────────────────────
    const placedToday = await prisma.order.count({
      where: {
        createdAt: { gte: todayStartUTC },
      },
    });

    // ── Served today ─────────────────────────────────────────────────────
    const servedToday = await prisma.order.count({
      where: {
        servedAt: { gte: todayStartUTC },
      },
    });

    // ── Revenue today (ACTIVE lines only, orders created today) ────────────
    const revenueResult = await prisma.orderLine.aggregate({
      where: {
        status: 'ACTIVE',
        order: { createdAt: { gte: todayStartUTC } },
      },
      _sum: { unitPrice: true },
    });
    const revenueToday = revenueResult._sum.unitPrice
      ? Number(revenueResult._sum.unitPrice)
      : 0;

    // ── Status breakdown (non-archived, non-cancelled? per design) ───────
    // Use all non-archived orders across all time for the breakdown.
    const statusRows = await prisma.order.groupBy({
      by: ['status'],
      where: { archivedAt: null },
      _count: { id: true },
    });
    const status_breakdown = {};
    for (const row of statusRows) {
      status_breakdown[row.status] = row._count.id;
    }

    // ── Waiter breakdown (orders created today, any status) ───────────────
    const waiterRows = await prisma.order.groupBy({
      by: ['primaryWaiterId'],
      where: { createdAt: { gte: todayStartUTC } },
      _count: { id: true },
    });
    const waiterIds = waiterRows.map((r) => r.primaryWaiterId);
    const waiters = await prisma.user.findMany({
      where: { id: { in: waiterIds } },
      select: { id: true, name: true },
    });
    const waiterMap = Object.fromEntries(waiters.map((u) => [u.id, u.name]));
    const waiter_breakdown = {};
    for (const row of waiterRows) {
      waiter_breakdown[waiterMap[row.primaryWaiterId] || row.primaryWaiterId] =
        row._count.id;
    }

    // ── 14-day chart ────────────────────────────────────────────────────
    // servedAt is the canonical date key for served orders.
    // Zero-fill: every date in the range appears even if no orders were served.
    const servedRows = await prisma.order.findMany({
      where: {
        servedAt: { gte: fourteenDaysAgoUTC },
        status: 'SERVED',
      },
      select: {
        servedAt: true,
        lines: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, unitPrice: true },
        },
      },
    });

    // Aggregate served data by date
    const servedByDate = {};
    for (const row of servedRows) {
      const dateKey = row.servedAt.toISOString().slice(0, 10);
      if (!servedByDate[dateKey]) servedByDate[dateKey] = { count: 0, revenue: 0 };
      const lineRevenue = row.lines.reduce(
        (sum, l) => sum + Number(l.unitPrice) * l.quantity,
        0
      );
      servedByDate[dateKey].count += 1;
      servedByDate[dateKey].revenue += lineRevenue;
    }

    const chart_14d = dates.map((date) => ({
      date,
      served: servedByDate[date]?.count || 0,
      revenue: servedByDate[date]?.revenue || 0,
    }));

    res.json({
      open_orders: openOrders,
      placed_today: placedToday,
      served_today: servedToday,
      revenue_today: revenueToday,
      status_breakdown,
      waiter_breakdown,
      chart_14d,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
