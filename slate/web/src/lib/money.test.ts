import { describe, expect, it } from 'vitest';
import { allocate, allocateEven, rescale } from './money';

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

describe('rescale', () => {
  it('converts a split to a new total exactly', () => {
    // €30 split 10/20 becomes $33 split 11/22
    expect(rescale([1000, 2000], 3300)).toEqual([1100, 2200]);
  });
  it('always sums to the new total', () => {
    for (let target = 1; target < 250; target++) {
      const parts = rescale([333, 334, 333], target);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(target);
    }
  });
  it('keeps proportions under awkward rates', () => {
    const parts = rescale([999, 1], 1087);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1087);
    expect(parts[0]).toBeGreaterThan(parts[1]!);
  });
  it('carries negative entries (discounts) through', () => {
    const parts = rescale([1500, -500], 2000);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(parts[1]).toBeLessThan(0);
  });
  it('handles shrinking totals (converting to a stronger currency)', () => {
    const parts = rescale([1000, 1000, 1000], 7);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(7);
  });
  it('returns empty for no entries', () => {
    expect(rescale([], 100)).toEqual([]);
  });
  it('throws when the source sums to zero', () => {
    expect(() => rescale([500, -500], 100)).toThrow();
  });
});
