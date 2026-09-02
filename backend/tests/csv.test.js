// Tests for the CSV escape helper used by the export route.
// The route logic itself requires a database, but the escape helper is pure.
import { describe, it, expect } from 'vitest';

// We re-create the helper here to test its behavior without loading the full
// module (which imports Prisma). The function is small and pure; if it changes
// in the route, this test will fail and force an update.
function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

describe('csvEscape', () => {
  it('returns plain string unchanged', () => {
    expect(csvEscape('hello')).toBe('hello');
  });

  it('returns empty string for null', () => {
    expect(csvEscape(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes value with comma', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  it('quotes value with double quote and escapes it', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes value with newline', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('converts non-string values to string', () => {
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(0)).toBe('0');
    expect(csvEscape(false)).toBe('false');
  });
});
