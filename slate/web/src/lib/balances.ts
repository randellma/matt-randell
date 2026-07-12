import { rescale } from './money';
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

/** The currency-relevant subset of an expense record as stored. */
interface ExpenseRecordLike {
  paid_by: string;
  amount_cents: number;
  payers?: { member: string; cents: number }[];
  split: { entries: SplitEntry[] };
  /** '' / absent means the group currency */
  currency?: string;
  /** amount in group-currency minor units when `currency` is foreign */
  fx_cents?: number;
}

/**
 * An expense's total in group-currency minor units. Foreign expenses use the
 * stored conversion; a foreign expense missing one (shouldn't happen, but
 * offline edits can) counts 1:1 rather than dropping money.
 */
export function expenseGroupCents(e: ExpenseRecordLike, groupCurrency: string): number {
  const foreign = e.currency && e.currency !== groupCurrency;
  return foreign ? e.fx_cents || e.amount_cents : e.amount_cents;
}

/** Same rule for payments, which store the identical currency/fx_cents pair. */
export function paymentGroupCents(
  p: { amount_cents: number; currency?: string; fx_cents?: number },
  groupCurrency: string,
): number {
  const foreign = p.currency && p.currency !== groupCurrency;
  return foreign ? p.fx_cents || p.amount_cents : p.amount_cents;
}

function rescaleEntries<T extends { cents: number }>(list: T[], newTotal: number): T[] {
  const scaled = rescale(list.map(x => x.cents), newTotal);
  return list.map((x, i) => ({ ...x, cents: scaled[i]! }));
}

/**
 * An expense record as computeNets wants it: payer credits and split debits
 * in group-currency minor units. Foreign expenses rescale both sides to the
 * converted total, so credits and debits still cancel exactly.
 */
export function expenseForBalance(e: ExpenseRecordLike, groupCurrency: string): ExpenseForBalance {
  const total = expenseGroupCents(e, groupCurrency);
  if (total === e.amount_cents) {
    return { paidBy: e.paid_by, amountCents: e.amount_cents, payers: e.payers, entries: e.split.entries };
  }
  return {
    paidBy: e.paid_by,
    amountCents: total,
    payers: e.payers?.length ? rescaleEntries(e.payers, total) : undefined,
    entries: rescaleEntries(e.split.entries, total),
  };
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
