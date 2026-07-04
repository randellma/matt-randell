import { useState } from 'preact/hooks';
import { api } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord } from '../api';
import { formatCents } from '../lib/money';
import { aggregateUnits, computeNets, suggestSettlements, unitNets, type UnitBalance } from '../lib/balances';
import { newToken } from '../identity';

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
  const nameOf = (id: string) => memberById.get(id)?.name ?? '?';

  const nets = computeNets(
    expenses.map(e => ({ paidBy: e.paid_by, amountCents: e.amount_cents, entries: e.split.entries })),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: p.amount_cents })),
  );
  const units = aggregateUnits(nets, members);
  const unitByKey = new Map(units.map(u => [u.key, u]));
  const unitName = (u: UnitBalance) => {
    const custom = u.memberIds.map(id => memberById.get(id)?.party_name).find(Boolean);
    return custom || u.memberIds.map(nameOf).join(' & ');
  };
  const transfers = suggestSettlements(unitNets(units));

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
    if (!confirm(`Record that ${unitName(fromUnit)} paid ${unitName(toUnit)} ${formatCents(cents)}?`)) return;
    run(async () => {
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
    });
  }

  function deletePayment(p: PaymentRecord) {
    if (!confirm(`Remove payment ${nameOf(p.from_member)} → ${nameOf(p.to_member)} ${formatCents(p.amount_cents)}?`)) return;
    run(() => api.deletePayment(p.id, token));
  }

  return (
    <div class="stack">
      <section class="card">
        <h2>Balances</h2>
        <ul class="balance-list">
          {[...units]
            .sort((a, b) => b.cents - a.cents)
            .map(u => (
              <li key={u.key} class="balance-unit">
                <div class="balance-line">
                  <span>{unitName(u)}</span>
                  <BalanceAmount cents={u.cents} />
                </div>
                {u.memberIds.length > 1 && (
                  <ul class="party-breakdown">
                    {u.memberCents.map(mc => (
                      <li key={mc.member}>
                        <span>{nameOf(mc.member)}</span>
                        <BalanceAmount cents={mc.cents} muted />
                      </li>
                    ))}
                  </ul>
                )}
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
                  {unitName(unitByKey.get(t.from)!)} pays {unitName(unitByKey.get(t.to)!)}{' '}
                  <b>{formatCents(t.cents)}</b>
                </span>
                <button class="btn small" disabled={busy} onClick={() => recordTransfer(t.from, t.to, t.cents)}>
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PartyEditor members={members} token={token} busy={busy} run={run} />

      {payments.length > 0 && (
        <section class="card">
          <h2>Payments</h2>
          <ul class="payment-list">
            {payments.map(p => (
              <li key={p.id}>
                <span>
                  {p.date.slice(0, 10)} · {nameOf(p.from_member)} → {nameOf(p.to_member)}{' '}
                  <b>{formatCents(p.amount_cents)}</b>
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

function BalanceAmount({ cents, muted }: { cents: number; muted?: boolean }) {
  const cls = muted ? '' : cents > 0 ? 'pos' : cents < 0 ? 'neg' : '';
  return (
    <b class={cls}>
      {cents === 0 ? 'settled' : cents > 0 ? `gets ${formatCents(cents)}` : `owes ${formatCents(-cents)}`}
    </b>
  );
}

/**
 * Link members into parties ("one wallet"). A party is just a shared key on
 * the member records; unlinking clears it.
 */
function PartyEditor({
  members,
  token,
  busy,
  run,
}: {
  members: MemberRecord[];
  token: string;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const parties = new Map<string, MemberRecord[]>();
  for (const m of members) {
    if (m.party) parties.set(m.party, [...(parties.get(m.party) ?? []), m]);
  }
  const solo = members.filter(m => !m.party);

  function link() {
    if (selected.length < 2) return;
    const key = newToken().slice(0, 12);
    const ids = selected;
    setSelected([]);
    run(async () => {
      for (const id of ids) await api.updateMember(id, { party: key, party_name: '' }, token);
    });
  }

  function unlink(partyMembers: MemberRecord[]) {
    run(async () => {
      for (const m of partyMembers) await api.updateMember(m.id, { party: '', party_name: '' }, token);
    });
  }

  function rename(partyMembers: MemberRecord[]) {
    const joined = partyMembers.map(m => m.name).join(' & ');
    const current = partyMembers.map(m => m.party_name).find(Boolean) ?? '';
    const answer = prompt(
      `Name this crew (leave empty for "${joined}")`,
      current,
    );
    if (answer === null) return; // cancelled
    const name = answer.trim().slice(0, 60);
    run(async () => {
      for (const m of partyMembers) await api.updateMember(m.id, { party_name: name }, token);
    });
  }

  return (
    <section class="card">
      <h2>Couples & households</h2>
      <p class="hint left">
        Linked members settle as one wallet — no more “your wife owes you”. The
        group sees a combined balance; the breakdown stays visible above.
      </p>

      {[...parties.entries()].map(([key, pm]) => {
        const custom = pm.map(m => m.party_name).find(Boolean);
        return (
          <div key={key} class="party-row">
            <button class="party-name" title="Rename" onClick={() => rename(pm)}>
              <span>{custom || pm.map(m => m.name).join(' & ')} ✏️</span>
              {custom && <span class="party-sub">{pm.map(m => m.name).join(' & ')}</span>}
            </button>
            <button class="btn small" disabled={busy} onClick={() => unlink(pm)}>
              Unlink
            </button>
          </div>
        );
      })}

      {solo.length >= 2 && (
        <>
          <div class="chip-row wrap">
            {solo.map(m => {
              const on = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  class={`chip ${on ? 'on' : ''}`}
                  onClick={() =>
                    setSelected(on ? selected.filter(s => s !== m.id) : [...selected, m.id])
                  }
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <button class="btn" disabled={busy || selected.length < 2} onClick={link}>
            Link {selected.length >= 2 ? selected.map(id => members.find(m => m.id === id)?.name).join(' & ') : 'selected'}
          </button>
        </>
      )}
    </section>
  );
}
