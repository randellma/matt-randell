import { useState } from 'preact/hooks';
import { api } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord } from '../api';
import { formatCents, parseAmount } from '../lib/money';
import { aggregateUnits, computeNets, suggestSettlements, unitNets, type UnitBalance } from '../lib/balances';
import { newToken } from '../identity';
import { colorForBalance, collectiveInitials } from '../lib/avatar';
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

export function Balances({ group, token, members, expenses, payments, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);

  const memberById = new Map(members.map(m => [m.id, m]));
  const nameOf = (id: string) => memberById.get(id)?.name ?? '?';

  const nets = computeNets(
    expenses.map(e => ({ paidBy: e.paid_by, amountCents: e.amount_cents, payers: e.payers, entries: e.split.entries })),
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
      <div>
        <div class="seclbl left">The ledger</div>
        <ul class="balance-list">
          {[...units]
            .sort((a, b) => b.cents - a.cents)
            .map((u, i) => (
              <li key={u.key}>
                {i > 0 && <hr class="rule" style="margin-bottom:16px;" />}
                <div class="balance-unit">
                  <div class="balance-line">
                    <Avatar initials={collectiveInitials(unitName(u))} color={colorForBalance(u.cents)} size={32} />
                    <span class="name">{unitName(u)}</span>
                    <BalanceAmount cents={u.cents} />
                  </div>
                  {u.memberIds.length > 1 && (
                    <ul class="party-breakdown">
                      {u.memberCents.map(mc => (
                        <li key={mc.member} class="li">
                          <span class="nm faint">{nameOf(mc.member)}</span>
                          <span class="lead" />
                          <span class="amt" style={{ color: mc.cents < 0 ? 'var(--red)' : 'var(--accent)' }}>
                            {mc.cents < 0 ? '−' : '+'}{formatCents(Math.abs(mc.cents))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
        </ul>
      </div>
      <hr class="rule solid" />

      {transfers.length > 0 && (
        <>
          <div>
            <div class="seclbl left">Settle up</div>
            <ul class="settle-list">
              {transfers.map(t => {
                const from = unitByKey.get(t.from)!;
                const to = unitByKey.get(t.to)!;
                return (
                  <li key={`${t.from}-${t.to}`} class="settle-row">
                    <span class="settle-people">
                      <Avatar initials={collectiveInitials(unitName(from))} color="#B84A38" size={26} />
                      <span class="settle-arrow">→</span>
                      <Avatar initials={collectiveInitials(unitName(to))} color="#0B7A4E" size={26} />
                      <span>{unitName(from)} pays {unitName(to)} {formatCents(t.cents)}</span>
                    </span>
                    <button class="btn primary small" disabled={busy} onClick={() => recordTransfer(t.from, t.to, t.cents)}>
                      Mark paid
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <hr class="rule" />
        </>
      )}

      <PartyEditor members={members} token={token} busy={busy} run={run} unitByKey={unitByKey} />
      <hr class="rule" />

      <div>
        <div class="seclbl left">Payments</div>
        {payments.length > 0 && (
          <ul class="payment-list" style="margin-top:11px;">
            {payments.map(p => (
              <li key={p.id}>
                <span>
                  {p.date.slice(0, 10)} · {nameOf(p.from_member)} → {nameOf(p.to_member)}{' '}
                  <b>{formatCents(p.amount_cents)}</b>
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
        <p class="hint sans left">
          For money that changed hands in any other way than the suggestions above.
        </p>
      </div>

      {recording && (
        <PaymentSheet
          units={units}
          unitName={unitName}
          nameOf={nameOf}
          onClose={() => setRecording(false)}
          onSave={(from_member, to_member, amount_cents, note) => {
            setRecording(false);
            run(async () => {
              await api.createPayment(
                {
                  group: group.id,
                  from_member,
                  to_member,
                  amount_cents,
                  date: `${new Date().toISOString().slice(0, 10)} 12:00:00.000Z`,
                  note,
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

function BalanceAmount({ cents }: { cents: number }) {
  if (cents === 0) return <span class="stamp">Settled</span>;
  return (
    <span class={`stamp ${cents < 0 ? 'red' : ''}`}>
      {cents > 0 ? `Gets ${formatCents(cents)}` : `Owes ${formatCents(-cents)}`}
    </span>
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
  unitByKey,
}: {
  members: MemberRecord[];
  token: string;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
  unitByKey: Map<string, UnitBalance>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<MemberRecord[] | null>(null);

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

  function saveName(partyMembers: MemberRecord[], name: string) {
    setRenaming(null);
    run(async () => {
      for (const m of partyMembers) await api.updateMember(m.id, { party_name: name }, token);
    });
  }

  return (
    <div class="stack-sm">
      <div class="seclbl left">Couples &amp; households</div>
      <p class="hint sans left">
        Linked members settle as one wallet — the group sees a combined
        balance; the breakdown stays visible above.
      </p>

      {[...parties.entries()].map(([key, pm]) => {
        const custom = pm.map(m => m.party_name).find(Boolean);
        const displayName = custom || pm.map(m => m.name).join(' & ');
        const cents = unitByKey.get(key)?.cents ?? 0;
        return (
          <div key={key} class="party-row">
            <Avatar initials={collectiveInitials(displayName)} color={colorForBalance(cents)} size={30} />
            <button class="party-name" title="Rename" onClick={() => setRenaming(pm)}>
              <span>{displayName} ✏️</span>
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

      {renaming && (
        <PartyNameSheet
          partyMembers={renaming}
          onSave={name => saveName(renaming, name)}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
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
  onSave,
  onClose,
}: {
  units: UnitBalance[];
  unitName: (u: UnitBalance) => string;
  nameOf: (id: string) => string;
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

  const cents = parseAmount(amountText);
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
            <span>Amount</span>
            <input
              inputMode="decimal"
              value={amountText}
              placeholder="0.00"
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

/** Bottom sheet for naming a party: just a text field, save/cancel. */
function PartyNameSheet({
  partyMembers,
  onSave,
  onClose,
}: {
  partyMembers: MemberRecord[];
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const joined = partyMembers.map(m => m.name).join(' & ');
  const [name, setName] = useState(partyMembers.map(m => m.party_name).find(Boolean) ?? '');

  return (
    <div class="sheet-overlay" onClick={onClose}>
      <div class="sheet" onClick={e => e.stopPropagation()}>
        <h2>Name your crew</h2>
        <label class="field">
          <span>Party name</span>
          <input
            autofocus
            value={name}
            maxLength={60}
            placeholder={joined}
            onInput={e => setName((e.target as HTMLInputElement).value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSave(name.trim());
            }}
          />
        </label>
        <p class="hint sans left">Leave empty to go back to “{joined}”.</p>
        <div class="btn-row">
          <button class="btn" onClick={onClose}>
            Cancel
          </button>
          <button class="btn primary" onClick={() => onSave(name.trim())}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
