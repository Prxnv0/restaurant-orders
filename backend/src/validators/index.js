// Central export of all validators.
const { createMenuItem, updateMenuItem, bulkUpdate } = require('./menu');
const { createOrder, addLine, listOrders, voidLine } = require('./orders');

module.exports = {
  createMenuItem,
  updateMenuItem,
  bulkUpdate,
  createOrder,
  addLine,
  listOrders,
  voidLine,
};
