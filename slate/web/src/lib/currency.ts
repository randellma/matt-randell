/**
 * Currency metadata, formatting, and parsing. Amounts everywhere in Slate are
 * integers in a currency's minor units ("cents" for USD, whole yen for JPY);
 * this module is where minor-unit awareness lives, driven by Intl so we don't
 * hand-maintain an ISO 4217 table.
 */

/** ISO 4217 code, e.g. "USD". */
export type CurrencyCode = string;

/** Shown first in pickers; everything Intl knows about follows alphabetically. */
export const COMMON_CURRENCIES: CurrencyCode[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'MXN', 'CNY', 'INR', 'NZD', 'SGD',
];

export function allCurrencies(): CurrencyCode[] {
  try {
    return Intl.supportedValuesOf('currency');
  } catch {
    return COMMON_CURRENCIES;
  }
}

const nameFmt = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'currency' });
  } catch {
    return null;
  }
})();

/** "EUR" -> "Euro" (in the user's language); falls back to the code. */
export function currencyName(code: CurrencyCode): string {
  try {
    const name = nameFmt?.of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

const unitCache = new Map<CurrencyCode, number>();

/** Number of minor-unit digits: 2 for USD, 0 for JPY, 3 for BHD. */
export function minorUnits(code: CurrencyCode): number {
  let d = unitCache.get(code);
  if (d === undefined) {
    try {
      d = new Intl.NumberFormat('en-US', { style: 'currency', currency: code })
        .resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      d = 2;
    }
    unitCache.set(code, d);
  }
  return d;
}

const symbolCache = new Map<CurrencyCode, string>();

/** Narrow symbol: "$", "€", "¥" — or the code itself when there is none. */
export function currencySymbol(code: CurrencyCode): string {
  let s = symbolCache.get(code);
  if (s === undefined) {
    try {
      s =
        new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
          .formatToParts(1)
          .find(p => p.type === 'currency')?.value ?? code;
    } catch {
      s = code;
    }
    symbolCache.set(code, s);
  }
  return s;
}

/**
 * Format minor units for the receipt: "-€1,234.56", "¥1,200", "CHF 12.00".
 * Deliberately locale-pinned (grouping commas, dot decimal) so columns of
 * amounts line up the same for every member of a group.
 */
export function formatMoney(minor: number, code: CurrencyCode): string {
  const digits = minorUnits(code);
  const unit = 10 ** digits;
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / unit).toLocaleString('en-US');
  const frac = digits > 0 ? `.${String(abs % unit).padStart(digits, '0')}` : '';
  const sym = currencySymbol(code);
  // Letter symbols (CHF, kr) get a non-breaking space so "CHF12" doesn't read
  // as one token and "CHF 12" never wraps apart.
  const sep = /[A-Za-z]$/.test(sym) ? '\u00a0' : '';
  return `${sign}${sym}${sep}${whole}${frac}`;
}

/**
 * Parse user input like "12", "12.3", "€12.34", "1,200" into minor units,
 * honouring the currency's decimal places. Null if invalid.
 */
export function parseMoney(input: string, code: CurrencyCode): number | null {
  const digits = minorUnits(code);
  // Amounts are positive by design — callers wanting "-5" handle the sign
  // themselves. Reject early so a minus doesn't get eaten as a "symbol".
  if (input.includes('-')) return null;
  const cleaned = input.trim().replace(/^[^\d.]+/, '').replace(/,/g, '');
  const re = digits > 0 ? new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`) : /^\d+$/;
  if (!re.test(cleaned)) return null;
  const [whole = '', frac = ''] = cleaned.split('.');
  return Number(whole) * 10 ** digits + Number(frac.padEnd(digits, '0') || '0');
}

/** Minor units -> plain editable text ("12.50", "1200" for JPY) for input values. */
export function moneyInputValue(minor: number, code: CurrencyCode): string {
  const digits = minorUnits(code);
  return (minor / 10 ** digits).toFixed(digits);
}

/** "0.00" for USD, "0" for JPY — placeholder matching what parseMoney accepts. */
export function moneyPlaceholder(code: CurrencyCode): string {
  const digits = minorUnits(code);
  return digits > 0 ? `0.${'0'.repeat(digits)}` : '0';
}

/** Convert minor units between currencies at `rate` (major units of `to` per major unit of `from`). */
export function convertMinor(minor: number, from: CurrencyCode, to: CurrencyCode, rate: number): number {
  return Math.round((minor / 10 ** minorUnits(from)) * rate * 10 ** minorUnits(to));
}

/** Implied major-unit rate between two already-known minor amounts, for display. */
export function impliedRate(
  fromMinor: number,
  from: CurrencyCode,
  toMinor: number,
  to: CurrencyCode,
): number | null {
  if (fromMinor <= 0) return null;
  return (toMinor / 10 ** minorUnits(to)) / (fromMinor / 10 ** minorUnits(from));
}

// Region -> currency for the places Slate users plausibly are. The 20
// eurozone members share one entry-per-region below; anything unlisted
// falls back to USD.
const EURO_REGIONS = [
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
];
const REGION_CURRENCY: Record<string, CurrencyCode> = {
  ...Object.fromEntries(EURO_REGIONS.map(r => [r, 'EUR'])),
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
  GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RO: 'RON', BG: 'BGN', UA: 'UAH', RS: 'RSD', TR: 'TRY',
  JP: 'JPY', CN: 'CNY', HK: 'HKD', TW: 'TWD', KR: 'KRW', SG: 'SGD', MY: 'MYR', TH: 'THB',
  VN: 'VND', PH: 'PHP', ID: 'IDR', IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR',
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD',
  AE: 'AED', SA: 'SAR', QA: 'QAR', IL: 'ILS', EG: 'EGP', MA: 'MAD', TN: 'TND',
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', GH: 'GHS', TZ: 'TZS',
};

/** Best guess at the user's home currency from the browser locale; USD when unsure. */
export function detectCurrency(): CurrencyCode {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return (region && REGION_CURRENCY[region]) || 'USD';
  } catch {
    return 'USD';
  }
}
