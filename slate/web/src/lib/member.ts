import type { ExpenseRecord, MemberRecord, PaymentRecord } from '../api';

/** Members still in play: everyone the group hasn't removed. */
export function activeMembers(members: MemberRecord[]): MemberRecord[] {
  return members.filter(m => !m.removed);
}

/**
 * Does any expense or payment point at this member? Scans every place a member
 * id can be stored — the payer relation and multi-payer entries, the split's
 * per-member entries plus its mode-specific state (percents, shares, item
 * assignees), and both sides of a payment.
 *
 * A member nothing references is an accidental add and can be hard-deleted.
 * Anyone referenced must be kept (flagged `removed`) so the cascade wired up in
 * migration 1751600009 doesn't take their history with them. The scan errs
 * toward "referenced" on purpose: a false positive only means a safe
 * soft-remove, a false negative would mean lost expenses.
 */
export function memberReferenced(
  id: string,
  expenses: ExpenseRecord[],
  payments: PaymentRecord[],
): boolean {
  const inExpense = expenses.some(
    e =>
      e.paid_by === id ||
      !!e.payers?.some(p => p.member === id) ||
      e.split.entries.some(en => en.member === id) ||
      id in (e.split.percents ?? {}) ||
      id in (e.split.shares ?? {}) ||
      !!e.split.items?.some(it => it.assignees.includes(id)),
  );
  if (inExpense) return true;
  return payments.some(p => p.from_member === id || p.to_member === id);
}
