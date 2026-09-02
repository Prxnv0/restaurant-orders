// Alert routes.
//   GET  /api/alerts                    — list active alerts, role-scoped, with count
//   POST /api/alerts/:id/dismiss       — dismiss an alert (insert AlertDismissal row)
const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const AppError = require('../utils/errors');

const router = express.Router();

function getThresholdMs() {
  return (Number(process.env.ALERT_THRESHOLD_MINUTES) || 15) * 60 * 1000;
}

// GET /api/alerts
// Returns active alerts that should be shown to the current user.
// Manager: all active alerts.
// Waiter: only alerts for orders where they are primary waiter or collaborator.
// An alert is "active" when:
//   1. The order is not in a terminal status (READY/SERVED/CANCELLED — alerts are deleted there)
//   2. The order is past the threshold since it was last dismissed (or never dismissed)
//   3. resolvedAt is null (deleted when terminal reached, so this is always null for non-deleted rows)
router.get('/', auth, async (req, res, next) => {
  try {
    const thresholdMs = getThresholdMs();
    const now = new Date();
    const thresholdAgo = new Date(now.getTime() - thresholdMs);

    // Find alerts where the order is past the threshold since last dismissal.
    // Subquery: latest dismissal for this alert.
    // Show alert if: no dismissals exist OR latest dismissal < thresholdAgo.
    const alerts = await prisma.alert.findMany({
      where: {
        resolvedAt: null,
        order: {
          status: { in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            tableNumber: true,
            status: true,
            createdAt: true,
            primaryWaiterId: true,
            collaborators: { select: { waiterId: true } },
          },
        },
        dismissals: {
          orderBy: { dismissedAt: 'desc' },
          take: 1,
          select: { dismissedAt: true },
        },
      },
    });

    // Filter by role: waiters only see their own orders.
    const isManager = req.user.role === 'MANAGER';
    const visible = alerts.filter((alert) => {
      if (isManager) return true;
      const order = alert.order;
      return (
        order.primaryWaiterId === req.user.id ||
        order.collaborators.some((c) => c.waiterId === req.user.id)
      );
    });

    // Filter by threshold: show only if no dismissals OR last dismissal is old enough.
    const active = visible.filter((alert) => {
      if (alert.dismissals.length === 0) return true;
      return alert.dismissals[0].dismissedAt < thresholdAgo;
    });

    const count = active.length;

    // Shape the response: include age in minutes for UI display.
    const result = active.map((alert) => ({
      id: alert.id,
      order_id: alert.order.id,
      table_number: alert.order.tableNumber,
      status: alert.order.status,
      triggered_at: alert.triggeredAt,
      age_minutes: Math.round((now.getTime() - alert.order.createdAt.getTime()) / 60000),
      last_dismissed_at: alert.dismissals[0]?.dismissedAt || null,
    }));

    res.json({ alerts: result, count });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/:id/dismiss
// Insert an AlertDismissal row. Requires access to the associated order.
router.post('/:id/dismiss', auth, async (req, res, next) => {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          select: {
            id: true,
            primaryWaiterId: true,
            collaborators: { select: { waiterId: true } },
          },
        },
      },
    });

    if (!alert) {
      return next(AppError.NOT_FOUND('Alert'));
    }

    if (alert.resolvedAt) {
      return next(AppError.BAD_REQUEST('Alert is already resolved'));
    }

    // Check order access (same logic as requireOrderAccess, but inline here
    // to avoid loading the full order through that middleware).
    const isManager = req.user.role === 'MANAGER';
    const isPrimary = alert.order.primaryWaiterId === req.user.id;
    const isCollaborator = alert.order.collaborators.some(
      (c) => c.waiterId === req.user.id
    );

    if (!isManager && !isPrimary && !isCollaborator) {
      return next(
        AppError.FORBIDDEN('You do not have access to this order')
      );
    }

    const dismissal = await prisma.alertDismissal.create({
      data: {
        alertId: alert.id,
        dismissedById: req.user.id,
      },
    });

    res.status(201).json({ dismissal });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
