import { useState } from 'preact/hooks';
import { api } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord } from '../api';
import { formatCents } from '../lib/money';
import { computeNets, suggestSettlements } from '../lib/balances';

interface Props {
  group: GroupRecord;
  token: string;
  members: MemberRecord[];
  me: string;
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  onChanged: () => void;
}

export function Balances({ group, token, members, expenses, payments, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const memberById = new Map(members.map(m => [m.id, m]));
  const nets = computeNets(
    expenses.map(e => ({ paidBy: e.paid_by, amountCents: e.amount_cents, entries: e.split.entries })),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: p.amount_cents })),
  );
  // Every member shows up, even with no activity yet.
  for (const m of members) if (!nets.has(m.id)) nets.set(m.id, 0);
  const transfers = suggestSettlements(nets);

  async function recordPayment(from: string, to: string, cents: number) {
    const fromName = memberById.get(from)?.name;
    const toName = memberById.get(to)?.name;
    if (!confirm(`Record that ${fromName} paid ${toName} ${formatCents(cents)}?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.createPayment(
        {
          group: group.id,
          from_member: from,
          to_member: to,
          amount_cents: cents,
          date: `${new Date().toISOString().slice(0, 10)} 12:00:00.000Z`,
          note: '',
        },
        token,
      );
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deletePayment(p: PaymentRecord) {
    const fromName = memberById.get(p.from_member)?.name;
    const toName = memberById.get(p.to_member)?.name;
    if (!confirm(`Remove payment ${fromName} → ${toName} ${formatCents(p.amount_cents)}?`)) return;
    setBusy(true);
    try {
      await api.deletePayment(p.id, token);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <section class="card">
        <h2>Balances</h2>
        <ul class="balance-list">
          {[...nets]
            .sort((a, b) => b[1] - a[1])
            .map(([memberId, cents]) => (
              <li key={memberId}>
                <span>{memberById.get(memberId)?.name ?? '?'}</span>
                <b class={cents > 0 ? 'pos' : cents < 0 ? 'neg' : ''}>
                  {cents === 0 ? 'settled' : cents > 0 ? `gets ${formatCents(cents)}` : `owes ${formatCents(-cents)}`}
                </b>
              </li>
            ))}
        </ul>
      </section>

      {transfers.length > 0 && (
        <section class="card">
          <h2>Settle up</h2>
          <ul class="settle-list">
            {transfers.map(t => (
              <li key={`${t.from}-${t.to}`}>
                <span>
                  {memberById.get(t.from)?.name} pays {memberById.get(t.to)?.name}{' '}
                  <b>{formatCents(t.cents)}</b>
                </span>
                <button
                  class="btn small"
                  disabled={busy}
                  onClick={() => recordPayment(t.from, t.to, t.cents)}
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payments.length > 0 && (
        <section class="card">
          <h2>Payments</h2>
          <ul class="payment-list">
            {payments.map(p => (
              <li key={p.id}>
                <span>
                  {p.date.slice(0, 10)} · {memberById.get(p.from_member)?.name} →{' '}
                  {memberById.get(p.to_member)?.name} <b>{formatCents(p.amount_cents)}</b>
                </span>
                <button class="item-remove" disabled={busy} onClick={() => deletePayment(p)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p class="error">{error}</p>}
    </div>
  );
}
