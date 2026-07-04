import { describe, expect, it } from 'vitest';
import { computeNets, suggestSettlements } from './balances';

describe('computeNets', () => {
  it('credits the payer and debits the participants', () => {
    const nets = computeNets(
      [
        {
          paidBy: 'alice',
          amountCents: 3000,
          entries: [
            { member: 'alice', cents: 1000 },
            { member: 'bob', cents: 1000 },
            { member: 'carol', cents: 1000 },
          ],
        },
      ],
      [],
    );
    expect(nets.get('alice')).toBe(2000);
    expect(nets.get('bob')).toBe(-1000);
    expect(nets.get('carol')).toBe(-1000);
  });

  it('applies payments', () => {
    const nets = computeNets(
      [
        {
          paidBy: 'alice',
          amountCents: 2000,
          entries: [
            { member: 'alice', cents: 1000 },
            { member: 'bob', cents: 1000 },
          ],
        },
      ],
      [{ from: 'bob', to: 'alice', cents: 1000 }],
    );
    expect(nets.get('alice')).toBe(0);
    expect(nets.get('bob')).toBe(0);
  });

  it('nets across multiple expenses', () => {
    const nets = computeNets(
      [
        {
          paidBy: 'alice',
          amountCents: 1000,
          entries: [
            { member: 'alice', cents: 500 },
            { member: 'bob', cents: 500 },
          ],
        },
        {
          paidBy: 'bob',
          amountCents: 1000,
          entries: [
            { member: 'alice', cents: 500 },
            { member: 'bob', cents: 500 },
          ],
        },
      ],
      [],
    );
    expect(nets.get('alice')).toBe(0);
    expect(nets.get('bob')).toBe(0);
  });
});

describe('suggestSettlements', () => {
  it('settles everyone with at most n-1 transfers', () => {
    const nets = new Map([
      ['a', 3000],
      ['b', -1000],
      ['c', -2000],
    ]);
    const transfers = suggestSettlements(nets);
    expect(transfers).toEqual([
      { from: 'c', to: 'a', cents: 2000 },
      { from: 'b', to: 'a', cents: 1000 },
    ]);
  });

  it('returns nothing when settled', () => {
    expect(suggestSettlements(new Map([['a', 0]]))).toEqual([]);
  });

  it('zeroes all balances after applying suggested transfers', () => {
    const nets = new Map([
      ['a', 1234],
      ['b', -567],
      ['c', -667],
      ['d', 999],
      ['e', -999],
    ]);
    const transfers = suggestSettlements(nets);
    const after = new Map(nets);
    for (const t of transfers) {
      after.set(t.from, after.get(t.from)! + t.cents);
      after.set(t.to, after.get(t.to)! - t.cents);
    }
    for (const [, v] of after) expect(v).toBe(0);
  });
});
