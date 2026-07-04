import { describe, expect, it } from 'vitest';
import { allocate, allocateEven, formatCents, parseAmount } from './money';

describe('parseAmount', () => {
  it('parses plain dollars', () => expect(parseAmount('12')).toBe(1200));
  it('parses dollars and cents', () => expect(parseAmount('12.34')).toBe(1234));
  it('parses one decimal place', () => expect(parseAmount('12.3')).toBe(1230));
  it('strips $ and commas', () => expect(parseAmount('$1,234.56')).toBe(123456));
  it('rejects three decimal places', () => expect(parseAmount('1.234')).toBeNull());
  it('rejects garbage', () => expect(parseAmount('abc')).toBeNull());
  it('rejects empty', () => expect(parseAmount('')).toBeNull());
  it('rejects negative (expenses are positive)', () => expect(parseAmount('-5')).toBeNull());
});

describe('formatCents', () => {
  it('formats', () => expect(formatCents(1234)).toBe('$12.34'));
  it('pads cents', () => expect(formatCents(1205)).toBe('$12.05'));
  it('formats zero', () => expect(formatCents(0)).toBe('$0.00'));
  it('formats negative', () => expect(formatCents(-99)).toBe('-$0.99'));
});

describe('allocate', () => {
  it('splits exactly when divisible', () => {
    expect(allocate(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });
  it('gives remainder pennies to largest fractional parts', () => {
    // 1000/3 = 333.33…; two get 333, first gets the extra penny
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });
  it('always sums to the total', () => {
    for (let total = 0; total < 250; total++) {
      const parts = allocate(total, [3, 7, 2, 5]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
  it('handles zero-weight members', () => {
    expect(allocate(1000, [1, 0, 1])).toEqual([500, 0, 500]);
  });
  it('is proportional to weights', () => {
    expect(allocate(1000, [3, 1])).toEqual([750, 250]);
  });
  it('handles negative totals (refunds) symmetrically', () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
  });
  it('throws on all-zero weights', () => {
    expect(() => allocate(100, [0, 0])).toThrow();
  });
  it('throws on negative weights', () => {
    expect(() => allocate(100, [1, -1])).toThrow();
  });
  it('returns empty for no weights', () => {
    expect(allocate(0, [])).toEqual([]);
  });
});

describe('allocateEven', () => {
  it('splits a dinner bill', () => {
    expect(allocateEven(10001, 2)).toEqual([5001, 5000]);
  });
});
