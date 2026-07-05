import { describe, expect, it } from 'vitest';
import { aggregateUnits, computeNets, suggestSettlements, unitNets } from './balances';

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

  it('credits multiple payers when the expense has them', () => {
    const nets = computeNets(
      [
        {
          paidBy: 'alice', // largest payer, kept for old clients — ignored here
          amountCents: 3000,
          payers: [
            { member: 'alice', cents: 2000 },
            { member: 'bob', cents: 1000 },
          ],
          entries: [
            { member: 'alice', cents: 1000 },
            { member: 'bob', cents: 1000 },
            { member: 'carol', cents: 1000 },
          ],
        },
      ],
      [],
    );
    expect(nets.get('alice')).toBe(1000);
    expect(nets.get('bob')).toBe(0);
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

describe('aggregateUnits', () => {
  const members = [
    { id: 'matt', party: 'p1' },
    { id: 'sarah', party: 'p1' },
    { id: 'dad', party: '' },
    { id: 'mom' }, // party undefined — also solo
  ];

  it('combines linked members into one unit and keeps the breakdown', () => {
    const nets = new Map([
      ['matt', 2000],
      ['sarah', -500],
      ['dad', -1500],
      ['mom', 0],
    ]);
    const units = aggregateUnits(nets, members);
    const byKey = Object.fromEntries(units.map(u => [u.key, u]));

    expect(byKey['p1']!.cents).toBe(1500);
    expect(byKey['p1']!.memberIds).toEqual(['matt', 'sarah']);
    expect(byKey['p1']!.memberCents).toEqual([
      { member: 'matt', cents: 2000 },
      { member: 'sarah', cents: -500 },
    ]);
    expect(byKey['dad']!.cents).toBe(-1500);
    expect(byKey['mom']!.cents).toBe(0);
  });

  it('hides intra-party debt from the group: couple nets to zero', () => {
    // Matt paid $30, but Sarah "owes" him half — inside the party that's noise.
    const nets = new Map([
      ['matt', 1500],
      ['sarah', -1500],
      ['dad', 0],
    ]);
    const units = aggregateUnits(nets, members.slice(0, 3));
    const p1 = units.find(u => u.key === 'p1')!;
    expect(p1.cents).toBe(0);
    expect(suggestSettlements(unitNets(units))).toEqual([]);
  });

  it('members missing from the list (deleted) still count as solo units', () => {
    const nets = new Map([
      ['ghost', -700],
      ['matt', 700],
    ]);
    const units = aggregateUnits(nets, [{ id: 'matt', party: '' }]);
    expect(units.find(u => u.key === 'ghost')!.cents).toBe(-700);
  });

  it('unit totals always preserve the zero-sum invariant', () => {
    const nets = new Map([
      ['matt', 1234],
      ['sarah', -600],
      ['dad', -1000],
      ['mom', 366],
    ]);
    const units = aggregateUnits(nets, members);
    expect(units.reduce((a, u) => a + u.cents, 0)).toBe(0);
  });

  it('settlements over units go between units, not people inside one', () => {
    const nets = new Map([
      ['matt', 3000],
      ['sarah', -1000], // couple nets +2000
      ['dad', -2000],
    ]);
    const units = aggregateUnits(nets, members.slice(0, 3));
    const transfers = suggestSettlements(unitNets(units));
    expect(transfers).toEqual([{ from: 'dad', to: 'p1', cents: 2000 }]);
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
