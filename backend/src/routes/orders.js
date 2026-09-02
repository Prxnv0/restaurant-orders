// Order routes.
//   POST   /api/orders                  — create order (waiter/manager)
//   GET    /api/orders                  — list orders (scoped by role, with search/filter/sort/pagination)
//   GET    /api/orders/:id              — get order with lines and computed total
//   POST   /api/orders/:id/lines        — add line to order (primary/collab/manager)
//   POST   /api/orders/:id/archive      — archive order (primary/manager)
//   POST   /api/orders/:id/restore      — restore archived order (primary/manager)
const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/authorize');
const requireOrderAccess = require('../middleware/resourceOwner');
const AppError = require('../utils/errors');
const { createOrder, addLine, listOrders, voidLine } = require('../validators');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────
function joiCheck(schema, value) {
  const { error } = schema.validate(value, { abortEarly: false });
  if (error) {
    throw AppError.BAD_REQUEST(
      error.details.map((d) => d.message).join('; ')
    );
  }
}

// Compute total for an order from ACTIVE lines
async function computeOrderTotal(orderId) {
  const lines = await prisma.orderLine.findMany({
    where: { orderId, status: 'ACTIVE' },
    select: { quantity: true, unitPrice: true },
  });
  return lines.reduce((sum, line) => sum + Number(line.unitPrice) * line.quantity, 0);
}

// Create history entry
async function makeHistory(orderId, eventType, details, actorId) {
  await prisma.orderHistoryEntry.create({
    data: { orderId, eventType, details, actorId },
  });
}

// ── POST /api/orders ────────────────────────────────────────────────────
// Create a new order with PLACED status, primary_waiter_id = current user
router.post('/', auth, requireRole('WAITER', 'MANAGER'), async (req, res, next) => {
  try {
    joiCheck(createOrder, req.body);

    const { table_number } = req.body;

    const order = await prisma.order.create({
      data: {
        tableNumber: table_number,
        status: 'PLACED',
        primaryWaiterId: req.user.id,
      },
    });

    // Create history entry for initial status (though order createdAt serves as source of truth)
    // Per seed pattern: no history entry for initial PLACED — createdAt is source of truth

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/orders ─────────────────────────────────────────────────────
// List orders with search, filter, sort, pagination. Scoped by role.
router.get('/', auth, async (req, res, next) => {
  try {
    // Joi schema coerces numeric/boolean query strings
    const { value, error } = listOrders.validate(req.query, { abortEarly: false });
    if (error) {
      throw AppError.BAD_REQUEST(error.details.map((d) => d.message).join('; '));
    }

    const {
      search,
      status,
      waiter,
      date,
      sort,
      order,
      page,
      limit,
      include_archived,
    } = value;

    // Build where clause
    const where = {};

    // Role-based scoping
    if (req.user.role !== 'MANAGER') {
      // Waiter sees orders where they are primary OR collaborator
      where.OR = [
        { primaryWaiterId: req.user.id },
        { collaborators: { some: { waiterId: req.user.id } } },
      ];
    }

    // Default: exclude archived unless explicitly requested
    if (!include_archived) {
      where.archivedAt = null;
    }

    // Search on table_number (case-insensitive)
    if (search) {
      where.tableNumber = { contains: search, mode: 'insensitive' };
    }

    // Status filter (single or array)
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = { in: statuses };
    }

    // Waiter filter (by user id or email) — manager only
    if (waiter && req.user.role === 'MANAGER') {
      // Could be user id or email
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: waiter }, { email: waiter }],
        },
        select: { id: true },
      });
      if (user) {
        where.OR = [
          { primaryWaiterId: user.id },
          { collaborators: { some: { waiterId: user.id } } },
        ];
      }
    }

    // Date filter (created_at day)
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.createdAt = { gte: start, lt: end };
    }

    // Sort
    const orderBy = {};
    orderBy[sort] = order;

    // Pagination
    const skip = (page - 1) * limit;
    const take = limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          tableNumber: true,
          status: true,
          primaryWaiterId: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
          servedAt: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/orders/:id ─────────────────────────────────────────────────
// Get order with lines, total, and access check
router.get('/:id', auth, requireOrderAccess, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        lines: {
          where: { status: 'ACTIVE' },
          include: {
            menuItem: {
              select: { id: true, name: true, price: true, isAvailable: true },
            },
            createdBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        primaryWaiter: {
          select: { id: true, name: true },
        },
        collaborators: {
          include: {
            waiter: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Compute total from ACTIVE lines only
    const total = await computeOrderTotal(order.id);

    res.json({ order: { ...order, total } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/orders/:id/lines ──────────────────────────────────────────
// Add a line to an order (price snapshot at time of add)
// Blocked if order is SERVED or CANCELLED
router.post('/:id/lines', auth, requireOrderAccess, async (req, res, next) => {
  try {
    joiCheck(addLine, req.body);

    const order = req.order;

    // Block line addition if order is in terminal state
    if (order.status === 'SERVED' || order.status === 'CANCELLED') {
      return next(
        AppError.CONFLICT(`Cannot add lines to an order with status ${order.status}`)
      );
    }

    const { menu_item_id, quantity, special_instructions } = req.body;

    // Get current menu item price
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menu_item_id },
      select: { id: true, name: true, price: true, isAvailable: true },
    });

    if (!menuItem) {
      return next(AppError.NOT_FOUND('Menu item'));
    }

    // Create order line with price snapshot
    const line = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        menuItemId: menu_item_id,
        quantity,
        unitPrice: menuItem.price,
        specialInstructions: special_instructions,
        createdById: req.user.id,
        status: 'ACTIVE',
      },
      include: {
        menuItem: {
          select: { id: true, name: true, price: true, isAvailable: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Create history entry
    await makeHistory(order.id, 'LINE_ADDED', {
      line_id: line.id,
      menu_item_id: line.menuItemId,
      quantity: line.quantity,
      unit_price: Number(line.unitPrice),
    }, req.user.id);

    res.status(201).json({ line });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/orders/:id/archive ────────────────────────────────────────
// Archive order (primary waiter or manager only)
router.post('/:id/archive', auth, requireOrderAccess, async (req, res, next) => {
  try {
    const order = req.order;

    if (order.archivedAt) {
      return next(AppError.BAD_REQUEST('Order is already archived'));
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { archivedAt: new Date() },
    });

    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/orders/:id/restore ────────────────────────────────────────
// Restore archived order (primary waiter or manager only)
router.post('/:id/restore', auth, requireOrderAccess, async (req, res, next) => {
  try {
    const order = req.order;

    if (!order.archivedAt) {
      return next(AppError.BAD_REQUEST('Order is not archived'));
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { archivedAt: null },
    });

    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;