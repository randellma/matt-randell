import { allocate, allocateEven } from './money';

export type SplitMode = 'even' | 'percent' | 'shares' | 'items';

/** What one member owes toward an expense. The entries of an expense sum exactly to its amount. */
export interface SplitEntry {
  member: string; // member record id
  cents: number;
}

export function computeEven(totalCents: number, memberIds: string[]): SplitEntry[] {
  const cents = allocateEven(totalCents, memberIds.length);
  return memberIds.map((member, i) => ({ member, cents: cents[i]! }));
}

/** Percents may have decimals; they must sum to 100 (±0.01 for rounding slop). */
export function computePercent(
  totalCents: number,
  parts: { member: string; percent: number }[],
): SplitEntry[] {
  const sum = parts.reduce((a, p) => a + p.percent, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`percents sum to ${sum}, expected 100`);
  }
  const cents = allocate(totalCents, parts.map(p => p.percent));
  return parts.map((p, i) => ({ member: p.member, cents: cents[i]! }));
}

export function computeShares(
  totalCents: number,
  parts: { member: string; shares: number }[],
): SplitEntry[] {
  const cents = allocate(totalCents, parts.map(p => p.shares));
  return parts.map((p, i) => ({ member: p.member, cents: cents[i]! }));
}
