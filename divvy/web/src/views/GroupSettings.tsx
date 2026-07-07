import { useState } from 'preact/hooks';
import { api } from '../app';
import type { GroupRecord, MemberRecord } from '../api';
import { convertMinor } from '../lib/currency';
import { fetchRate } from '../lib/fx';
import { colorForId, personInitial } from '../lib/avatar';
import { Avatar } from '../components/Avatar';
import { CurrencySelect } from '../components/CurrencySelect';

interface Props {
  group: GroupRecord;
  token: string;
  members: MemberRecord[];
  me: string;
  /** the user tapped a different member as "you" — local identity only */
  onMeChange: (memberId: string) => void;
  /** back out, reloading group data if `changed` */
  onDone: (changed: boolean) => void;
}

/**
 * Group settings: rename the group, switch who "you" are on this device, and
 * configure currencies. Changing the group currency rewrites every expense's
 * and payment's stored conversion at its own date — amounts stay in their
 * original currencies; only the group-level view moves.
 */
export function GroupSettings({ group, token, members, me, onMeChange, onDone }: Props) {
  const oldCurrency = group.currency || 'USD';
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(oldCurrency);
  const [expenseCurrency, setExpenseCurrency] = useState(group.expense_currency || '');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const dirty =
    name.trim() !== group.name ||
    currency !== oldCurrency ||
    (expenseCurrency || '') !== (group.expense_currency || '');

  async function save() {
    setError('');
    if (!name.trim()) return setError('Give the group a name');
    const changingCurrency = currency !== oldCurrency;
    if (
      changingCurrency &&
      !confirm(
        `Report balances in ${currency} instead of ${oldCurrency}?\n\n` +
          'Every expense keeps its original currency — converted amounts are ' +
          "refreshed using each expense's date.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.updateGroup(
        group.id,
        {
          name: name.trim(),
          currency,
          // '' means "same as group" — don't store a redundant copy.
          expense_currency: expenseCurrency === currency ? '' : expenseCurrency,
        },
        token,
      );
      const failures = changingCurrency ? await reconvert(currency) : [];
      if (failures.length > 0) {
        setBusy(false);
        setProgress('');
        setError(
          `No rate found for: ${failures.join(', ')}. Those were converted 1:1 — ` +
            'open each one and set its converted amount by hand.',
        );
        return;
      }
      onDone(true);
    } catch (e) {
      setError(String(e));
      setBusy(false);
      setProgress('');
    }
  }

  /**
   * Rewrite currency/fx on every expense and payment for a new group
   * currency. Records with an empty currency were implicitly in the old group
   * currency — they get it stamped on explicitly so history stays truthful.
   */
  async function reconvert(newCurrency: string): Promise<string[]> {
    const [expenses, payments] = await Promise.all([
      api.listExpenses(group.id, token),
      api.listPayments(group.id, token),
    ]);
    const records = [
      ...expenses.map(e => ({ kind: 'expense' as const, rec: e, label: e.description })),
      ...payments.map(p => ({ kind: 'payment' as const, rec: p, label: `payment on ${p.date.slice(0, 10)}` })),
    ];
    const failures: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const { kind, rec, label } = records[i]!;
      setProgress(`Converting ${i + 1} of ${records.length}…`);
      const recCurrency = rec.currency || oldCurrency;
      let fx = 0;
      if (recCurrency !== newCurrency) {
        try {
          const rate = await fetchRate(recCurrency, newCurrency, rec.date.slice(0, 10));
          fx = convertMinor(rec.amount_cents, recCurrency, newCurrency, rate);
        } catch {
          fx = rec.amount_cents;
          failures.push(label);
        }
      }
      const patch = { currency: recCurrency, fx_cents: fx };
      if (kind === 'expense') await api.patchExpense(rec.id, patch, token);
      else await api.patchPayment(rec.id, patch, token);
    }
    setProgress('');
    return failures;
  }

  return (
    <div class="page">
      <header class="group-header">
        <button class="back" onClick={() => onDone(false)}>‹</button>
        <div class="group-title">
          <h1>Group settings</h1>
        </div>
      </header>
      <div class="rhead subline">{group.name}</div>
      <hr class="rule" />

      <div class="field">
        <span>You are</span>
        <div class="chip-row wrap">
          {members.map(m => (
            <button
              key={m.id}
              class={`chip with-avatar ${m.id === me ? 'on' : ''}`}
              onClick={() => onMeChange(m.id)}
            >
              <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={24} />
              {m.name}
            </button>
          ))}
        </div>
        <p class="hint sans left" style="margin-top:4px;">
          Just a default for “paid by” on this device — switch any time.
        </p>
      </div>
      <hr class="rule" />

      <label class="field">
        <span>Group name</span>
        <input value={name} onInput={e => setName((e.target as HTMLInputElement).value)} />
      </label>

      <label class="field" style="margin-top:10px;">
        <span>Group currency</span>
        <CurrencySelect value={currency} onChange={setCurrency} />
        <p class="hint sans left" style="margin-top:4px;">
          What balances, settle-up, and totals are reported in.
        </p>
      </label>

      <label class="field" style="margin-top:10px;">
        <span>New expenses default to</span>
        <CurrencySelect
          value={expenseCurrency}
          onChange={setExpenseCurrency}
          emptyLabel={`Same as group (${currency})`}
        />
        <p class="hint sans left" style="margin-top:4px;">
          Handy abroad: log expenses in EUR, settle in {currency}. Each expense
          can still switch currency as you add it.
        </p>
      </label>
      <hr class="rule" />

      {progress && <p class="hint">{progress}</p>}
      {error && <p class="error">{error}</p>}

      <button class="btn primary big" onClick={save} disabled={busy || !dirty}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>
      <hr class="rule" style="margin-top:8px;" />
      <div class="barcode" />
      <div class="barnum">DIVVY · SETTINGS</div>
    </div>
  );
}
