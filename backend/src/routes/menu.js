// Menu routes.
//   GET    /api/menu             — list (any authed user, scoped by query)
//   GET    /api/menu/:id         — one item
//   POST   /api/menu             — create (manager only)
//   PATCH  /api/menu/:id         — update incl. archive (manager only)
//   POST   /api/menu/bulk-update — apply one change to many items, per-item result
//
// Per the README: bulk update must report per item what succeeded and
// what was rejected, not fail the whole batch. The bulk endpoint therefore
// processes each item in a try/catch and returns { succeeded, rejected }.
const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/authorize');
const AppError = require('../utils/errors');
const { createMenuItem, updateMenuItem, bulkUpdate } = require('../validators/menu');

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────
function joiCheck(schema, value) {
  const { error } = schema.validate(value, { abortEarly: false });
  if (error) {
    throw AppError.BAD_REQUEST(
      error.details.map((d) => d.message).join('; ')
    );
  }
}

// ── GET /api/menu ────────────────────────────────────────────────────
// Query: ?include=available | all | archived (default: available)
//   available  = not archived AND is_available
//   all        = not archived (regardless of availability)
//   archived   = archived only
router.get('/', auth, async (req, res, next) => {
  try {
    const include = (req.query.include || 'available').toLowerCase();
    let where = {};
    if (include === 'available') {
      where = { isArchived: false, isAvailable: true };
    } else if (include === 'archived') {
      where = { isArchived: true };
    } else if (include === 'all') {
      where = { isArchived: false };
    } else {
      throw AppError.BAD_REQUEST(
        "include must be one of: 'available', 'all', 'archived'"
      );
    }
    const items = await prisma.menuItem.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/menu/:id ────────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const item = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item) throw AppError.NOT_FOUND('Menu item');
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/menu (manager only) ───────────────────────────────────
router.post('/', auth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const value = await joiCheck(createMenuItem, req.body);
    const item = await prisma.menuItem.create({
      data: {
        name: value.name,
        price: value.price,
        isAvailable: value.is_available !== undefined ? value.is_available : true,
      },
    });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/menu/:id (manager only) ──────────────────────────────
router.patch('/:id', auth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const value = await joiCheck(updateMenuItem, req.body);

    const existing = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw AppError.NOT_FOUND('Menu item');

    const data = {};
    if (value.name !== undefined) data.name = value.name;
    if (value.price !== undefined) data.price = value.price;
    if (value.is_available !== undefined) data.isAvailable = value.is_available;
    if (value.is_archived !== undefined) data.isArchived = value.is_archived;

    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/menu/bulk-update (manager only) ───────────────────────
// Per README: each item is processed independently; one bad item must
// not fail the whole batch. The response reports per item what
// succeeded and what was rejected and why.
router.post('/bulk-update', auth, requireRole('MANAGER'), async (req, res, next) => {
  try {
    const value = await joiCheck(bulkUpdate, req.body);
    const { item_ids, price, is_available } = value;

    // Build the per-item data
    const data = {};
    if (price !== undefined) data.price = price;
    if (is_available !== undefined) data.isAvailable = is_available;

    // Process each item independently
    const succeeded = [];
    const rejected = [];

    for (const id of item_ids) {
      try {
        const existing = await prisma.menuItem.findUnique({ where: { id } });
        if (!existing) {
          rejected.push({ id, reason: 'Menu item not found' });
          continue;
        }
        // Joi has already validated the price; the per-item check is for
        // existence only. If a future constraint were applied per-item
        // (e.g. cross-field rule), it would go here.
        const updated = await prisma.menuItem.update({ where: { id }, data });
        succeeded.push({
          id: updated.id,
          name: updated.name,
          price: updated.price,
          is_available: updated.isAvailable,
          is_archived: updated.isArchived,
        });
      } catch (itemErr) {
        rejected.push({
          id,
          reason: itemErr.message || 'Update failed',
        });
      }
    }

    res.json({ succeeded, rejected });
  } catch (err) {
    next(err);
  }
});

module.exports = router;