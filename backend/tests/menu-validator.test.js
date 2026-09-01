// M3 validator unit tests.
// Exercises the Joi schemas in src/validators/menu.js without touching the
// database. These confirm the validation rules the backend relies on:
//   - name required, non-empty, ≤255 chars
//   - price ≥ 0
//   - is_available / is_archived boolean
//   - bulk-update: at least one of price / is_available; at least one id;
//     ids must be UUIDs
//
// The route-level integration tests (with a real DB) are part of M10.
import { describe, it, expect } from 'vitest';
const {
  createMenuItem,
  updateMenuItem,
  bulkUpdate,
} = require('../src/validators/menu');

describe('createMenuItem validator', () => {
  it('accepts a valid item with all fields', () => {
    const { error, value } = createMenuItem.validate({
      name: 'Margherita Pizza',
      price: 12.5,
      is_available: true,
    });
    expect(error).toBeUndefined();
    expect(value.name).toBe('Margherita Pizza');
    expect(value.price).toBe(12.5);
  });

  it('accepts a valid item without is_available (default applies at route layer)', () => {
    const { error, value } = createMenuItem.validate({
      name: 'Side Salad',
      price: 4,
    });
    expect(error).toBeUndefined();
    expect(value.is_available).toBeUndefined();
  });

  it('rejects missing name', () => {
    const { error } = createMenuItem.validate({ price: 5 });
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('name');
  });

  it('rejects empty name', () => {
    const { error } = createMenuItem.validate({ name: '   ', price: 5 });
    expect(error).toBeDefined();
  });

  it('rejects negative price', () => {
    const { error } = createMenuItem.validate({ name: 'Soup', price: -1 });
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('price');
  });

  it('rejects missing price', () => {
    const { error } = createMenuItem.validate({ name: 'Soup' });
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('price');
  });

  it('accepts price of zero', () => {
    const { error } = createMenuItem.validate({ name: 'Free Water', price: 0 });
    expect(error).toBeUndefined();
  });

  it('rejects name longer than 255 chars', () => {
    const { error } = createMenuItem.validate({
      name: 'x'.repeat(256),
      price: 1,
    });
    expect(error).toBeDefined();
  });
});

describe('updateMenuItem validator', () => {
  it('accepts a partial update with just price', () => {
    const { error, value } = updateMenuItem.validate({ price: 9.99 });
    expect(error).toBeUndefined();
    expect(value.price).toBe(9.99);
  });

  it('accepts an archive toggle', () => {
    const { error, value } = updateMenuItem.validate({ is_archived: true });
    expect(error).toBeUndefined();
    expect(value.is_archived).toBe(true);
  });

  it('rejects an empty body (no fields to update)', () => {
    const { error } = updateMenuItem.validate({});
    expect(error).toBeDefined();
  });

  it('rejects negative price in update', () => {
    const { error } = updateMenuItem.validate({ price: -0.01 });
    expect(error).toBeDefined();
  });
});

describe('bulkUpdate validator', () => {
  const uuid1 = '11111111-1111-1111-1111-111111111111';
  const uuid2 = '22222222-2222-2222-2222-222222222222';

  it('accepts a bulk price change with two ids', () => {
    const { error, value } = bulkUpdate.validate({
      item_ids: [uuid1, uuid2],
      price: 7.5,
    });
    expect(error).toBeUndefined();
    expect(value.item_ids).toHaveLength(2);
    expect(value.price).toBe(7.5);
  });

  it('accepts a bulk availability change', () => {
    const { error, value } = bulkUpdate.validate({
      item_ids: [uuid1],
      is_available: false,
    });
    expect(error).toBeUndefined();
  });

  it('rejects when neither price nor is_available is provided', () => {
    const { error } = bulkUpdate.validate({ item_ids: [uuid1] });
    expect(error).toBeDefined();
  });

  it('rejects empty item_ids', () => {
    const { error } = bulkUpdate.validate({ item_ids: [], price: 1 });
    expect(error).toBeDefined();
  });

  it('rejects a non-UUID id in item_ids', () => {
    const { error } = bulkUpdate.validate({
      item_ids: ['not-a-uuid'],
      price: 1,
    });
    expect(error).toBeDefined();
  });

  it('rejects more than 500 ids', () => {
    const ids = Array.from({ length: 501 }, (_, i) =>
      // pad to a valid-looking UUID; uniqueness is not the validator's job
      `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
    );
    const { error } = bulkUpdate.validate({ item_ids: ids, price: 1 });
    expect(error).toBeDefined();
  });
});
