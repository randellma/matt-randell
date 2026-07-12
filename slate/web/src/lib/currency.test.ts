import { describe, expect, it } from 'vitest';
import {
  convertMinor,
  formatMoney,
  minorUnits,
  moneyInputValue,
  moneyPlaceholder,
  parseMoney,
} from './currency';

describe('minorUnits', () => {
  it('two for USD', () => expect(minorUnits('USD')).toBe(2));
  it('zero for JPY', () => expect(minorUnits('JPY')).toBe(0));
  it('defaults to two for junk codes', () => expect(minorUnits('XXX?')).toBe(2));
});

describe('parseMoney', () => {
  it('parses plain dollars', () => expect(parseMoney('12', 'USD')).toBe(1200));
  it('parses dollars and cents', () => expect(parseMoney('12.34', 'USD')).toBe(1234));
  it('parses one decimal place', () => expect(parseMoney('12.3', 'USD')).toBe(1230));
  it('strips symbols and commas', () => expect(parseMoney('$1,234.56', 'USD')).toBe(123456));
  it('strips foreign symbols', () => expect(parseMoney('€12.34', 'EUR')).toBe(1234));
  it('rejects three decimal places for USD', () => expect(parseMoney('1.234', 'USD')).toBeNull());
  it('parses whole yen', () => expect(parseMoney('1200', 'JPY')).toBe(1200));
  it('rejects decimal yen', () => expect(parseMoney('12.5', 'JPY')).toBeNull());
  it('rejects garbage', () => expect(parseMoney('abc', 'USD')).toBeNull());
  it('rejects empty', () => expect(parseMoney('', 'USD')).toBeNull());
  it('rejects negative (expenses are positive)', () => expect(parseMoney('-5', 'USD')).toBeNull());
});

describe('formatMoney', () => {
  it('formats USD', () => expect(formatMoney(1234, 'USD')).toBe('$12.34'));
  it('pads cents', () => expect(formatMoney(1205, 'USD')).toBe('$12.05'));
  it('formats zero', () => expect(formatMoney(0, 'USD')).toBe('$0.00'));
  it('formats negative', () => expect(formatMoney(-99, 'USD')).toBe('-$0.99'));
  it('formats EUR with its symbol', () => expect(formatMoney(1234, 'EUR')).toBe('€12.34'));
  it('formats yen without decimals', () => expect(formatMoney(1200, 'JPY')).toBe('¥1,200'));
  it('groups thousands', () => expect(formatMoney(123456789, 'USD')).toBe('$1,234,567.89'));
  it('spaces letter-only symbols (non-breaking)', () => expect(formatMoney(1200, 'CHF')).toBe('CHF\u00a012.00'));
});

describe('moneyInputValue / moneyPlaceholder', () => {
  it('round-trips USD', () => expect(moneyInputValue(1230, 'USD')).toBe('12.30'));
  it('round-trips JPY', () => expect(moneyInputValue(1230, 'JPY')).toBe('1230'));
  it('placeholder matches decimals', () => {
    expect(moneyPlaceholder('USD')).toBe('0.00');
    expect(moneyPlaceholder('JPY')).toBe('0');
  });
});

describe('convertMinor', () => {
  it('converts across equal-decimal currencies', () => {
    // €10.00 at 1.10 → $11.00
    expect(convertMinor(1000, 'EUR', 'USD', 1.1)).toBe(1100);
  });
  it('converts into a zero-decimal currency', () => {
    // $10.00 at 150 ¥/$ → ¥1500
    expect(convertMinor(1000, 'USD', 'JPY', 150)).toBe(1500);
  });
  it('converts out of a zero-decimal currency', () => {
    // ¥1500 at 0.0066 $/¥ → $9.90
    expect(convertMinor(1500, 'JPY', 'USD', 0.0066)).toBe(990);
  });
});
