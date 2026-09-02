// Joi validation schemas for order endpoints.
const Joi = require('joi');

// ── Create order ───────────────────────────────────────────────────────
const createOrder = Joi.object({
  table_number: Joi.string().trim().min(1).max(20).required(),
});

// ── Add line to order ──────────────────────────────────────────────────
const addLine = Joi.object({
  menu_item_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  special_instructions: Joi.string().max(500).allow('', null).optional(),
});

// ── List orders (query params) ─────────────────────────────────────────
const listOrders = Joi.object({
  search: Joi.string().max(100).optional(),
  status: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  waiter: Joi.string().optional(),
  date: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: Joi.string().valid('placed_at', 'status', 'table_number').default('placed_at'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  include_archived: Joi.boolean().default(false),
});

// ── Void line ──────────────────────────────────────────────────────────
const voidLine = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
});

// ── Change order status ─────────────────────────────────────────────────
const changeStatus = Joi.object({
  status: Joi.string()
    .valid('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')
    .required(),
});

// ── Add note ────────────────────────────────────────────────────────────
const addNote = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),
});

module.exports = {
  createOrder,
  addLine,
  listOrders,
  voidLine,
  changeStatus,
  addNote,
};
