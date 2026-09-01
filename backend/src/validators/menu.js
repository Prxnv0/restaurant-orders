// Joi validation schemas for menu endpoints.
const Joi = require('joi');

// Single-item create
const createMenuItem = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  price: Joi.number().min(0).required(),
  is_available: Joi.boolean().optional(),
});

// Single-item update (any subset)
const updateMenuItem = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  price: Joi.number().min(0).optional(),
  is_available: Joi.boolean().optional(),
  is_archived: Joi.boolean().optional(),
}).min(1); // at least one field

// Bulk update — at least one of price or is_available, list of ids
const bulkUpdate = Joi.object({
  item_ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(500)
    .required(),
  price: Joi.number().min(0).optional(),
  is_available: Joi.boolean().optional(),
}).or('price', 'is_available'); // require at least one change

module.exports = {
  createMenuItem,
  updateMenuItem,
  bulkUpdate,
};