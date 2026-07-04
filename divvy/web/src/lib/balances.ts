import type { SplitEntry } from './split';

export interface ExpenseForBalance {
  paidBy: string;
  amountCents: number;
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
    add(e.paidBy, e.amountCents);
    for (const entry of e.entries) add(entry.member, -entry.cents);
  }
  for (const p of payments) {
    add(p.from, p.cents);
    add(p.to, -p.cents);
  }
  return nets;
}

/**
 * Suggest a small set of transfers that settles all balances: repeatedly pay
 * the largest creditor from the largest debtor. At most n-1 transfers.
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
