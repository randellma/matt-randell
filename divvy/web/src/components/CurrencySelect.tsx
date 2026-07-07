import { allCurrencies, COMMON_CURRENCIES, currencyName } from '../lib/currency';

/**
 * Currency picker backed by the native <select> (best picker UX on phones).
 * `compact` renders as a small "EUR ▾" chip with the select laid invisibly on
 * top — for squeezing next to an amount input; the default renders a normal
 * full-width select for settings forms.
 */
export function CurrencySelect({
  value,
  onChange,
  compact,
  emptyLabel,
}: {
  value: string;
  onChange: (code: string) => void;
  compact?: boolean;
  /** adds a '' option with this label (e.g. "Same as group currency") */
  emptyLabel?: string;
}) {
  const rest = allCurrencies().filter(c => !COMMON_CURRENCIES.includes(c));
  const opt = (c: string) => (
    <option key={c} value={c}>
      {c} — {currencyName(c)}
    </option>
  );
  const select = (
    <select
      class={compact ? 'cur-overlay' : undefined}
      value={value}
      aria-label="Currency"
      onChange={e => onChange((e.target as HTMLSelectElement).value)}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      <optgroup label="Common">{COMMON_CURRENCIES.map(opt)}</optgroup>
      <optgroup label="All currencies">{rest.map(opt)}</optgroup>
    </select>
  );
  if (!compact) return select;
  return (
    <span class="cur-chip">
      {value} <span class="cur-caret">▾</span>
      {select}
    </span>
  );
}
