/** All amounts are integer cents. Floating point never touches stored money. */

/** Parse user input like "12", "12.3", "12.34", "$12.34" into cents. Null if invalid. */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0') || '0');
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

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
