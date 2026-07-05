import type { SplitEntry } from './split';

export interface ExpenseForBalance {
  paidBy: string;
  amountCents: number;
  /** multiple payers; when present, credited instead of paidBy */
  payers?: { member: string; cents: number }[];
  entries: SplitEntry[];
}

export interface PaymentForBalance {
  from: string;
  to: string;
  cents: number;
}

export interface Transfer {
  from: string;
  to: string;
  cents: number;
}

/**
 * Net position per member: positive = the group owes them, negative = they owe.
 * Every member id that appears anywhere is present in the result.
 */
export function computeNets(
  expenses: ExpenseForBalance[],
  payments: PaymentForBalance[],
): Map<string, number> {
  const nets = new Map<string, number>();
  const add = (member: string, cents: number) =>
    nets.set(member, (nets.get(member) ?? 0) + cents);

  for (const e of expenses) {
    if (e.payers?.length) {
      for (const p of e.payers) add(p.member, p.cents);
    } else {
      add(e.paidBy, e.amountCents);
    }
    for (const entry of e.entries) add(entry.member, -entry.cents);
  }
  for (const p of payments) {
    add(p.from, p.cents);
    add(p.to, -p.cents);
  }
  return nets;
}

/**
 * A settlement unit: a linked party acting as one wallet, or a solo member.
 * `cents` is the combined net; `memberCents` keeps the internal breakdown so
 * a couple can still square up between themselves.
 */
export interface UnitBalance {
  /** party key for linked members, otherwise the member id */
  key: string;
  memberIds: string[];
  cents: number;
  memberCents: { member: string; cents: number }[];
}

/**
 * Collapse per-member nets into settlement units. Members sharing a non-empty
 * `party` value form one unit; everyone else is a unit of one. Member ids in
 * `nets` that aren't in `members` (e.g. deleted members still referenced by
 * old expenses) become solo units so no money is dropped.
 */
export function aggregateUnits(
  nets: Map<string, number>,
  members: { id: string; party?: string }[],
): UnitBalance[] {
  const units = new Map<string, UnitBalance>();
  const add = (key: string, member: string, cents: number) => {
    let unit = units.get(key);
    if (!unit) {
      unit = { key, memberIds: [], cents: 0, memberCents: [] };
      units.set(key, unit);
    }
    unit.memberIds.push(member);
    unit.cents += cents;
    unit.memberCents.push({ member, cents });
  };

  const seen = new Set<string>();
  for (const m of members) {
    seen.add(m.id);
    add(m.party || m.id, m.id, nets.get(m.id) ?? 0);
  }
  for (const [member, cents] of nets) {
    if (!seen.has(member)) add(member, member, cents);
  }
  return [...units.values()];
}

/** Combined nets keyed by unit, ready for suggestSettlements. */
export function unitNets(units: UnitBalance[]): Map<string, number> {
  return new Map(units.map(u => [u.key, u.cents]));
}

/**
 * Suggest a small set of transfers that settles all balances: repeatedly pay
 * the largest creditor from the largest debtor. At most n-1 transfers.
 * Works over member nets or unit nets alike.
 */
export function suggestSettlements(nets: Map<string, number>): Transfer[] {
  const debtors = [...nets].filter(([, c]) => c < 0).map(([m, c]) => ({ m, c: -c }));
  const creditors = [...nets].filter(([, c]) => c > 0).map(([m, c]) => ({ m, c }));
  debtors.sort((a, b) => b.c - a.c || a.m.localeCompare(b.m));
  creditors.sort((a, b) => b.c - a.c || a.m.localeCompare(b.m));

  const transfers: Transfer[] = [];
  let d = 0, cIdx = 0;
  while (d < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[d]!, creditor = creditors[cIdx]!;
    const cents = Math.min(debtor.c, creditor.c);
    if (cents > 0) transfers.push({ from: debtor.m, to: creditor.m, cents });
    debtor.c -= cents;
    creditor.c -= cents;
    if (debtor.c === 0) d += 1;
    if (creditor.c === 0) cIdx += 1;
  }
  return transfers;
}
