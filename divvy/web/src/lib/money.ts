/**
 * All amounts are integers in a currency's minor units ("cents"). Floating
 * point never touches stored money. Parsing/formatting (which need to know
 * the currency) live in currency.ts; this module is pure integer arithmetic.
 */

/**
 * Split `totalCents` proportionally to `weights`, returning integer cents that
 * sum exactly to the total. Remainder pennies go to the largest fractional
 * parts first (ties broken by lower index, so results are deterministic).
 */
export function allocate(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (totalCents < 0) return allocate(-totalCents, weights).map(c => -c);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) throw new Error('allocate: weights must sum to a positive number');
  if (weights.some(w => w < 0)) throw new Error('allocate: weights must be non-negative');

  const exact = weights.map(w => (totalCents * w) / totalWeight);
  const floors = exact.map(Math.floor);
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0);

  const byFraction = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (remainder === 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return floors;
}

/** Split evenly among n participants (weights all 1). */
export function allocateEven(totalCents: number, count: number): number[] {
  return allocate(totalCents, Array(count).fill(1));
}

/**
 * Rescale integer amounts to a new total, keeping proportions and summing
 * exactly — how a split in one currency becomes the same split in another.
 * Unlike allocate, entries may be negative (discount lines), so this floors
 * exact values directly and hands the remainder to the largest fractions.
 */
export function rescale(cents: number[], newTotal: number): number[] {
  if (cents.length === 0) return [];
  const oldTotal = cents.reduce((a, b) => a + b, 0);
  if (oldTotal === 0) throw new Error('rescale: amounts must not sum to zero');
  const exact = cents.map(c => (c * newTotal) / oldTotal);
  const floors = exact.map(Math.floor);
  let remainder = newTotal - floors.reduce((a, b) => a + b, 0);

  const byFraction = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (remainder === 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return floors;
}
