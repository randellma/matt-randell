import { describe, expect, it } from 'vitest';
import { computeEven, computePercent, computeShares } from './split';

describe('computeEven', () => {
  it('assigns each member a near-equal share summing to the total', () => {
    const entries = computeEven(1000, ['a', 'b', 'c']);
    expect(entries.map(e => e.member)).toEqual(['a', 'b', 'c']);
    expect(entries.reduce((s, e) => s + e.cents, 0)).toBe(1000);
    expect(Math.max(...entries.map(e => e.cents)) - Math.min(...entries.map(e => e.cents))).toBeLessThanOrEqual(1);
  });
});

describe('computePercent', () => {
  it('splits by percent', () => {
    const entries = computePercent(2000, [
      { member: 'a', percent: 75 },
      { member: 'b', percent: 25 },
    ]);
    expect(entries).toEqual([
      { member: 'a', cents: 1500 },
      { member: 'b', cents: 500 },
    ]);
  });
  it('accepts decimal percents that sum to 100', () => {
    const entries = computePercent(1000, [
      { member: 'a', percent: 33.33 },
      { member: 'b', percent: 33.33 },
      { member: 'c', percent: 33.34 },
    ]);
    expect(entries.reduce((s, e) => s + e.cents, 0)).toBe(1000);
  });
  it('rejects percents not summing to 100', () => {
    expect(() =>
      computePercent(1000, [
        { member: 'a', percent: 50 },
        { member: 'b', percent: 40 },
      ]),
    ).toThrow(/percents sum to 90/);
  });
});

describe('computeShares', () => {
  it('splits by shares', () => {
    const entries = computeShares(3000, [
      { member: 'a', shares: 2 },
      { member: 'b', shares: 1 },
    ]);
    expect(entries).toEqual([
      { member: 'a', cents: 2000 },
      { member: 'b', cents: 1000 },
    ]);
  });
});
