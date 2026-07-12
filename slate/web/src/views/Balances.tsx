import { useState } from 'preact/hooks';
import { api } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord } from '../api';
import { formatMoney, moneyPlaceholder, parseMoney } from '../lib/currency';
import {
  aggregateUnits,
  computeNets,
  expenseForBalance,
  paymentGroupCents,
  suggestSettlements,
  unitNets,
  type UnitBalance,
} from '../lib/balances';
import { colorForBalance, colorForId, collectiveInitials } from '../lib/avatar';
import { Avatar } from '../components/Avatar';

interface Props {
  group: GroupRecord;
  token: string;
  members: MemberRecord[];
  me: string;
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  onChanged: () => void;
}

export function Balances({ group, token, members, me, expenses, payments, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const memberById = new Map(members.map(m => [m.id, m]));
  const nameOf = (id: string) => memberById.get(id)?.name ?? '?';
  const groupCurrency = group.currency || 'USD';
  const fmt = (cents: number) => formatMoney(cents, groupCurrency);

  const nets = computeNets(
    expenses.map(e => expenseForBalance(e, groupCurrency)),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: paymentGroupCents(p, groupCurrency) })),
  );
  const units = aggregateUnits(nets, members);
  // A removed member who's settled up drops off the ledger entirely; one left
  // with a non-zero balance (e.g. an old expense was edited after removal)
  // still shows, so money is never hidden.
  const removedIds = new Set(members.filter(m => m.removed).map(m => m.id));
  const visibleUnits = units.filter(
    u => !(u.cents === 0 && u.memberIds.every(id => removedIds.has(id))),
  );
  const unitByKey = new Map(units.map(u => [u.key, u]));
  const unitName = (u: UnitBalance) => {
    const custom = u.memberIds.map(id => memberById.get(id)?.party_name).find(Boolean);
    return custom || u.memberIds.map(nameOf).join(' & ');
  };
  /** Party photo for a linked unit, the member's own photo for a solo one. */
  const unitPhoto = (u: UnitBalance) => {
    const unitMembers = u.memberIds.map(id => memberById.get(id)).filter(m => m !== undefined);
    if (u.memberIds.length > 1) return api.partyPhotoUrl(unitMembers);
    return unitMembers[0] ? api.memberPhotoUrl(unitMembers[0]) : undefined;
  };
  const transfers = suggestSettlements(unitNets(visibleUnits));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function recordTransfer(fromKey: string, toKey: string, cents: number) {
    const fromUnit = unitByKey.get(fromKey)!;
    const toUnit = unitByKey.get(toKey)!;
    // Representatives: within each party, the person deepest in the red pays,
    // the person most in the black receives — keeps internal breakdowns sane.
    const from = [...fromUnit.memberCents].sort((a, b) => a.cents - b.cents)[0]!.member;
    const to = [...toUnit.memberCents].sort((a, b) => b.cents - a.cents)[0]!.member;
    if (!confirm(`Record that ${unitName(fromUnit)} paid ${unitName(toUnit)} ${fmt(cents)}?`)) return;
    run(async () => {
      await api.createPayment(
        {
          group: group.id,
          from_member: from,
          to_member: to,
          amount_cents: cents,
          date: `${new Date().toISOString().slice(0, 10)} 12:00:00.000Z`,
          note: partyNote(fromUnit, toUnit, unitName),
          currency: groupCurrency,
          fx_cents: 0,
        },
        token,
      );
    });
  }

  function deletePayment(p: PaymentRecord) {
    if (!confirm(`Remove payment ${nameOf(p.from_member)} → ${nameOf(p.to_member)} ${formatMoney(p.amount_cents, p.currency || groupCurrency)}?`)) return;
    run(() => api.deletePayment(p.id, token));
  }

  // The wallet a transfer row describes from your point of view.
  const meUnit = units.find(u => u.memberIds.includes(me));
  const transferLabel = (from: UnitBalance, to: UnitBalance) => {
    const pays = from.memberIds.length > 1 ? 'pay' : 'pays';
    if (meUnit?.key === from.key) return `You pay ${unitName(to)}`;
    if (meUnit?.key === to.key) return `${unitName(from)} ${pays} you`;
    return `${unitName(from)} ${pays} ${unitName(to)}`;
  };

  return (
    <div class="stack">
      <div>
        <div class="seclbl left">Balances by wallet</div>
        <ul class="balance-list">
          {[...visibleUnits]
            .sort((a, b) => b.cents - a.cents)
            .map((u, i) => {
              const plural = u.memberIds.length > 1;
              const verb = u.cents === 0 ? 'settled' : u.cents > 0 ? (plural ? 'get' : 'gets') : plural ? 'owe' : 'owes';
              return (
                <li key={u.key}>
                  {i > 0 && <hr class="rule" style="margin-bottom:16px;" />}
                  <div class="balance-unit">
                    <div
                      class={`balance-line ${plural ? 'expandable' : ''}`}
                      onClick={plural ? () => toggleExpanded(u.key) : undefined}
                    >
                      <Avatar initials={collectiveInitials(unitName(u))} color={colorForBalance(u.cents)} size={32} src={unitPhoto(u)} />
                      <span class="balance-name">
                        <span class="name">{unitName(u)}</span>
                        {plural && <span class={`caret ${expanded.has(u.key) ? 'open' : ''}`}>▾</span>}
                      </span>
                      <span class={`balance-amt ${u.cents === 0 ? 'zero' : u.cents > 0 ? 'pos' : 'neg'}`}>
                        <span class="verb">{verb}</span>
                        <b class="num">{fmt(Math.abs(u.cents))}</b>
                      </span>
                    </div>
                    {plural && expanded.has(u.key) && (
                      <ul class="party-breakdown">
                        {u.memberCents.map(mc => (
                          <li key={mc.member} class="li">
                            <span class="nm">{nameOf(mc.member)}</span>
                            <span class="lead" />
                            <span class="amt" style={{ color: mc.cents < 0 ? 'var(--red)' : 'var(--green)' }}>
                              {mc.cents < 0 ? '−' : '+'}{fmt(Math.abs(mc.cents))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      </div>

      {transfers.length > 0 && (
        <div>
          <div class="seclbl left" id="settle-up" style="scroll-margin-top:14px;">Settle up</div>
          <ul class="settle-list" style="margin-top:13px;">
            {transfers.map(t => {
              const from = unitByKey.get(t.from)!;
              const to = unitByKey.get(t.to)!;
              // Show the counterparty when you're on the row; both wallets otherwise.
              const other = meUnit?.key === from.key ? to : from;
              return (
                <li key={`${t.from}-${t.to}`} class="settle-row">
                  <span class="settle-main">
                    {meUnit && (meUnit.key === from.key || meUnit.key === to.key) ? (
                      <Avatar initials={collectiveInitials(unitName(other))} color={colorForId(other.key)} size={30} src={unitPhoto(other)} />
                    ) : (
                      <span class="avatar-stack">
                        <Avatar initials={collectiveInitials(unitName(from))} color={colorForId(from.key)} size={30} src={unitPhoto(from)} />
                        <Avatar initials={collectiveInitials(unitName(to))} color={colorForId(to.key)} size={30} src={unitPhoto(to)} />
                      </span>
                    )}
                    <span class="settle-text">
                      <span class="settle-label">{transferLabel(from, to)}</span>
                      <b class="settle-amt num">{fmt(t.cents)}</b>
                    </span>
                  </span>
                  <button class="btn primary small" disabled={busy} onClick={() => recordTransfer(t.from, t.to, t.cents)}>
                    Mark paid
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <hr class="rule solid" />

      <div>
        <div class="seclbl left">Payments</div>
        {payments.length > 0 && (
          <ul class="payment-list" style="margin-top:11px;">
            {payments.map(p => (
              <li key={p.id}>
                <span>
                  {p.date.slice(0, 10)} · {nameOf(p.from_member)} → {nameOf(p.to_member)}{' '}
                  <b class="num">{formatMoney(p.amount_cents, p.currency || groupCurrency)}</b>
                  {p.note && <span class="payment-note"> · {p.note}</span>}
                </span>
                <button class="item-remove" disabled={busy} onClick={() => deletePayment(p)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <button class="btn" style="margin-top:11px;" disabled={busy} onClick={() => setRecording(true)}>
          Record a payment
        </button>
        <p class="hint sans left" style="margin-top:9px;">
          For money that changed hands in any other way than the suggestions above.
        </p>
        <p class="hint sans left" style="margin-top:4px;">
          Couples &amp; households are linked in Group settings.
        </p>
      </div>

      {recording && (
        <PaymentSheet
          units={visibleUnits}
          unitName={unitName}
          nameOf={nameOf}
          currency={groupCurrency}
          onClose={() => setRecording(false)}
          onSave={(from_member, to_member, amount_cents, note) => {
            setRecording(false);
            const fromUnit = visibleUnits.find(u => u.memberIds.includes(from_member))!;
            const toUnit = visibleUnits.find(u => u.memberIds.includes(to_member))!;
            const auto = partyNote(fromUnit, toUnit, unitName);
            run(async () => {
              await api.createPayment(
                {
                  group: group.id,
                  from_member,
                  to_member,
                  amount_cents,
                  date: `${new Date().toISOString().slice(0, 10)} 12:00:00.000Z`,
                  note: [auto, note].filter(Boolean).join(' · '),
                  currency: groupCurrency,
                  fx_cents: 0,
                },
                token,
              );
            });
          }}
        />
      )}

      {error && <p class="error">{error}</p>}
    </div>
  );
}

/**
 * A payment's from_member/to_member always names an individual representative,
 * even when a whole party settled — so when either side is a linked party,
 * note which wallet(s) were actually involved.
 */
function partyNote(fromUnit: UnitBalance, toUnit: UnitBalance, unitName: (u: UnitBalance) => string): string {
  const fromIsParty = fromUnit.memberIds.length > 1;
  const toIsParty = toUnit.memberIds.length > 1;
  if (fromIsParty && toIsParty) return `${unitName(fromUnit)} wallet → ${unitName(toUnit)} wallet`;
  if (fromIsParty) return `From the ${unitName(fromUnit)} wallet`;
  if (toIsParty) return `Into the ${unitName(toUnit)} wallet`;
  return '';
}

/**
 * Bottom sheet for recording an arbitrary payment — any amount, between any
 * two people, not just what settle-up suggests. Chips list every member plus
 * each party as one wallet; picking a party resolves to its representative
 * (deepest in the red pays, most in the black receives — same rule as settle).
 */
function PaymentSheet({
  units,
  unitName,
  nameOf,
  currency,
  onSave,
  onClose,
}: {
  units: UnitBalance[];
  unitName: (u: UnitBalance) => string;
  nameOf: (id: string) => string;
  /** payments are recorded in the group currency */
  currency: string;
  onSave: (fromMember: string, toMember: string, cents: number, note: string) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');

  interface Option {
    key: string;
    label: string;
    resolve: (dir: 'from' | 'to') => string;
  }
  const memberOptions: Option[] = units.flatMap(u =>
    u.memberIds.map(id => ({ key: id, label: nameOf(id), resolve: () => id })),
  );
  const partyOptions: Option[] = units
    .filter(u => u.memberIds.length > 1)
    .map(u => ({
      key: u.key,
      label: unitName(u),
      resolve: dir => {
        const sorted = [...u.memberCents].sort((a, b) => a.cents - b.cents);
        return dir === 'from' ? sorted[0]!.member : sorted[sorted.length - 1]!.member;
      },
    }));
  const byKey = new Map([...memberOptions, ...partyOptions].map(o => [o.key, o]));

  const cents = parseMoney(amountText, currency);
  const fromMember = from ? byKey.get(from)!.resolve('from') : '';
  const toMember = to ? byKey.get(to)!.resolve('to') : '';
  const samePerson = !!fromMember && fromMember === toMember;
  const valid = fromMember && toMember && !samePerson && cents !== null && cents > 0;

  // Parties always get their own row so they never blend in with people.
  const chipRow = (value: string, set: (key: string) => void) => {
    const chips = (opts: Option[], isParty: boolean) =>
      opts.map(o => (
        <button
          key={o.key}
          class={`chip ${isParty ? 'party' : ''} ${value === o.key ? 'on' : ''}`}
          onClick={() => set(o.key === value ? '' : o.key)}
        >
          {o.label}
        </button>
      ));
    return (
      <div class="chip-rows">
        <div class="chip-row wrap">{chips(memberOptions, false)}</div>
        {partyOptions.length > 0 && <div class="chip-row wrap">{chips(partyOptions, true)}</div>}
      </div>
    );
  };

  return (
    <div class="sheet-overlay" onClick={onClose}>
      <div class="sheet" onClick={e => e.stopPropagation()}>
        <h2>Record a payment</h2>
        <div class="field">
          <span>Who paid</span>
          {chipRow(from, setFrom)}
        </div>
        <div class="field">
          <span>Who received</span>
          {chipRow(to, setTo)}
        </div>
        <div class="field-row">
          <label class="field grow">
            <span>Amount ({currency})</span>
            <input
              inputMode="decimal"
              value={amountText}
              placeholder={moneyPlaceholder(currency)}
              onInput={e => setAmountText((e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field grow">
            <span>Note (optional)</span>
            <input
              value={note}
              maxLength={200}
              placeholder="Venmo, cash…"
              onInput={e => setNote((e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        {samePerson && <p class="hint warn">Payer and receiver are the same person</p>}
        <div class="btn-row">
          <button class="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            class="btn primary"
            disabled={!valid}
            onClick={() => onSave(fromMember, toMember, cents!, note.trim())}
          >
            Record
          </button>
        </div>
      </div>
    </div>
  );
}

