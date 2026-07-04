import { describe, expect, it } from 'vitest';
import { computeItemized } from './receipt';

describe('computeItemized', () => {
  it('splits a simple two-person dinner with shared appetizer, tax and tip', () => {
    // Alice: $20 entree. Bob: $10 entree. Shared: $10 appetizer.
    // Subtotal $40, total $50 ($10 tax+tip → 25% overhead).
    const entries = computeItemized(
      [
        { label: 'Steak', cents: 2000, assignees: ['alice'] },
        { label: 'Burger', cents: 1000, assignees: ['bob'] },
        { label: 'Nachos', cents: 1000, assignees: ['alice', 'bob'] },
      ],
      5000,
    );
    const byMember = Object.fromEntries(entries.map(e => [e.member, e.cents]));
    // Alice items: 2000 + 500 = 2500 → +25% = 3125. Bob: 1500 → 1875.
    expect(byMember['alice']).toBe(3125);
    expect(byMember['bob']).toBe(1875);
  });

  it('always reconciles exactly to the receipt total', () => {
    const entries = computeItemized(
      [
        { label: 'A', cents: 999, assignees: ['x', 'y', 'z'] },
        { label: 'B', cents: 1501, assignees: ['x'] },
        { label: 'C', cents: 777, assignees: ['y', 'z'] },
      ],
      4004, // odd tax+tip remainder to force penny distribution
    );
    expect(entries.reduce((s, e) => s + e.cents, 0)).toBe(4004);
  });

  it('splits an item unevenly-divisible among 3 without losing pennies', () => {
    const entries = computeItemized(
      [{ label: 'Pitcher', cents: 1000, assignees: ['a', 'b', 'c'] }],
      1000,
    );
    expect(entries.reduce((s, e) => s + e.cents, 0)).toBe(1000);
  });

  it('handles discounts as negative line items', () => {
    // $30 of items minus $5 coupon assigned to everyone, $27 total ($2 tax).
    const entries = computeItemized(
      [
        { label: 'Pizza', cents: 2000, assignees: ['a'] },
        { label: 'Salad', cents: 1000, assignees: ['b'] },
        { label: 'Coupon', cents: -500, assignees: ['a', 'b'] },
      ],
      2700,
    );
    expect(entries.reduce((s, e) => s + e.cents, 0)).toBe(2700);
    const byMember = Object.fromEntries(entries.map(e => [e.member, e.cents]));
    expect(byMember['a']!).toBeGreaterThan(byMember['b']!);
  });

  it('throws when an item has no assignees', () => {
    expect(() =>
      computeItemized([{ label: 'Orphan', cents: 500, assignees: [] }], 500),
    ).toThrow(/Orphan/);
  });

  it('splits extras evenly when item subtotals are all zero', () => {
    const entries = computeItemized(
      [{ label: 'Freebie', cents: 0, assignees: ['a', 'b'] }],
      200, // delivery fee only
    );
    expect(entries).toEqual([
      { member: 'a', cents: 100 },
      { member: 'b', cents: 100 },
    ]);
  });
});
