// M4 validator unit tests.
// Exercises the Joi schemas in src/validators/orders.js without touching the
// database. These confirm the validation rules the backend relies on:
//   - table_number required, non-empty, ≤20 chars
//   - addLine: menu_item_id required UUID, quantity ≥ 1 integer
//   - listOrders: all query params validated with defaults
//   - voidLine: reason required, non-empty, ≤500 chars
//
// The route-level integration tests (with a real DB) are part of M10.
import { describe, it, expect } from 'vitest';
const { createOrder, addLine, listOrders, voidLine, changeStatus, addNote } = require('../src/validators/orders');

describe('createOrder', () => {
  it('accepts a valid table number', () => {
    const { error } = createOrder.validate({ table_number: '1' });
    expect(error).toBeUndefined();
  });

  it('rejects missing table number', () => {
    const { error } = createOrder.validate({});
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/table_number.*required/i);
  });

  it('rejects empty table number', () => {
    const { error } = createOrder.validate({ table_number: '' });
    expect(error).toBeDefined();
  });

  it('rejects table number over 20 chars', () => {
    const { error } = createOrder.validate({ table_number: 'a'.repeat(21) });
    expect(error).toBeDefined();
  });

  it('trims whitespace from table number', () => {
    const { value } = createOrder.validate({ table_number: '  5  ' });
    expect(value.table_number).toBe('5');
  });
});

describe('addLine', () => {
  const validUuid = '11111111-1111-1111-1111-111111111111';

  it('accepts a valid line', () => {
    const { error } = addLine.validate({
      menu_item_id: validUuid,
      quantity: 2,
    });
    expect(error).toBeUndefined();
  });

  it('accepts a valid line with special instructions', () => {
    const { error } = addLine.validate({
      menu_item_id: validUuid,
      quantity: 1,
      special_instructions: 'no salt',
    });
    expect(error).toBeUndefined();
  });

  it('rejects missing menu_item_id', () => {
    const { error } = addLine.validate({ quantity: 1 });
    expect(error).toBeDefined();
  });

  it('rejects non-UUID menu_item_id', () => {
    const { error } = addLine.validate({ menu_item_id: 'not-a-uuid', quantity: 1 });
    expect(error).toBeDefined();
  });

  it('rejects quantity 0', () => {
    const { error } = addLine.validate({ menu_item_id: validUuid, quantity: 0 });
    expect(error).toBeDefined();
  });

  it('rejects negative quantity', () => {
    const { error } = addLine.validate({ menu_item_id: validUuid, quantity: -1 });
    expect(error).toBeDefined();
  });

  it('rejects non-integer quantity', () => {
    const { error } = addLine.validate({ menu_item_id: validUuid, quantity: 1.5 });
    expect(error).toBeDefined();
  });

  it('rejects missing quantity', () => {
    const { error } = addLine.validate({ menu_item_id: validUuid });
    expect(error).toBeDefined();
  });
});

describe('listOrders', () => {
  it('accepts empty query (uses defaults)', () => {
    const { error, value } = listOrders.validate({});
    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.limit).toBe(20);
    expect(value.sort).toBe('placed_at');
    expect(value.order).toBe('desc');
  });

  it('accepts valid filter combo', () => {
    const { error } = listOrders.validate({
      search: '1',
      status: 'PLACED',
      sort: 'table_number',
      order: 'asc',
      page: 2,
      limit: 50,
    });
    expect(error).toBeUndefined();
  });

  it('rejects invalid sort field', () => {
    const { error } = listOrders.validate({ sort: 'random' });
    expect(error).toBeDefined();
  });

  it('rejects invalid order direction', () => {
    const { error } = listOrders.validate({ order: 'sideways' });
    expect(error).toBeDefined();
  });

  it('rejects page 0', () => {
    const { error } = listOrders.validate({ page: 0 });
    expect(error).toBeDefined();
  });

  it('rejects limit over 100', () => {
    const { error } = listOrders.validate({ limit: 101 });
    expect(error).toBeDefined();
  });

  it('rejects invalid date format', () => {
    const { error } = listOrders.validate({ date: 'not-a-date' });
    expect(error).toBeDefined();
  });

  it('accepts valid date', () => {
    const { error } = listOrders.validate({ date: '2026-09-02' });
    expect(error).toBeUndefined();
  });
});

describe('voidLine', () => {
  it('accepts a valid reason', () => {
    const { error } = voidLine.validate({ reason: 'Customer changed mind' });
    expect(error).toBeUndefined();
  });

  it('rejects missing reason', () => {
    const { error } = voidLine.validate({});
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/reason.*required/i);
  });

  it('rejects empty reason', () => {
    const { error } = voidLine.validate({ reason: '' });
    expect(error).toBeDefined();
  });

  it('rejects reason over 500 chars', () => {
    const { error } = voidLine.validate({ reason: 'a'.repeat(501) });
    expect(error).toBeDefined();
  });
});

describe('changeStatus', () => {
  it('accepts every valid status', () => {
    const statuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
    for (const status of statuses) {
      const { error } = changeStatus.validate({ status });
      expect(error, `status: ${status}`).toBeUndefined();
    }
  });

  it('rejects missing status', () => {
    const { error } = changeStatus.validate({});
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/status.*required/i);
  });

  it('rejects invalid status string', () => {
    const { error } = changeStatus.validate({ status: 'OPEN' });
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/must be one of/i);
  });

  it('rejects numeric status', () => {
    const { error } = changeStatus.validate({ status: 1 });
    expect(error).toBeDefined();
  });
});

describe('addNote', () => {
  it('accepts a valid note', () => {
    const { error } = addNote.validate({ content: 'Customer requested extra napkins' });
    expect(error).toBeUndefined();
  });

  it('rejects missing content', () => {
    const { error } = addNote.validate({});
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/content.*required/i);
  });

  it('rejects empty content', () => {
    const { error } = addNote.validate({ content: '' });
    expect(error).toBeDefined();
  });

  it('rejects whitespace-only content', () => {
    const { error } = addNote.validate({ content: '   ' });
    expect(error).toBeDefined();
  });

  it('rejects content over 2000 chars', () => {
    const { error } = addNote.validate({ content: 'a'.repeat(2001) });
    expect(error).toBeDefined();
  });

  it('trims whitespace', () => {
    const { value } = addNote.validate({ content: '  Hi  ' });
    expect(value.content).toBe('Hi');
  });
});
