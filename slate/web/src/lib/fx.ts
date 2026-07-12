/**
 * Exchange rates from Frankfurter (ECB reference rates — free, no key,
 * historical by date). Rates are a convenience prefill: the converted amount
 * on an expense stays editable, and anything Frankfurter doesn't cover just
 * means typing the converted amount yourself.
 */

const BASE = 'https://api.frankfurter.dev/v1';

const cache = new Map<string, Promise<number>>();

/**
 * Major-unit rate: how many `to` one `from` bought on `date` (YYYY-MM-DD).
 * Future or missing dates use the latest rate. Rejects when the pair isn't
 * covered or the network is down — callers fall back to manual entry.
 */
export function fetchRate(from: string, to: string, date: string): Promise<number> {
  if (from === to) return Promise.resolve(1);
  const today = new Date().toISOString().slice(0, 10);
  const day = date && date < today ? date : 'latest';
  const key = `${from}|${to}|${day}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchRateUncached(from, to, day);
    // Failures shouldn't poison the cache — a retry should hit the network.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

async function fetchRateUncached(from: string, to: string, day: string): Promise<number> {
  const res = await fetch(`${BASE}/${day}?base=${from}&symbols=${to}`);
  if (!res.ok) throw new Error(`No rate available for ${from} → ${to}`);
  const data = await res.json();
  const rate = data?.rates?.[to];
  if (typeof rate !== 'number' || !(rate > 0)) {
    throw new Error(`No rate available for ${from} → ${to}`);
  }
  return rate;
}
