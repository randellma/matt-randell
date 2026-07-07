import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, groupPath, navigate } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord } from '../api';
import { getJoinedGroup, rememberGroup } from '../identity';
import {
  aggregateUnits,
  computeNets,
  expenseForBalance,
  expenseGroupCents,
  paymentGroupCents,
  type ExpenseForBalance,
} from '../lib/balances';
import { formatMoney } from '../lib/currency';
import { partyDisplayName } from '../lib/party';
import { colorForId, personInitial } from '../lib/avatar';
import { Avatar, AvatarStack } from '../components/Avatar';
import { ExpenseForm } from './ExpenseForm';
import { Balances } from './Balances';
import { GroupSettings } from './GroupSettings';

interface Props {
  groupId: string;
  token: string;
  sub: string[];
}

export function Group({ groupId, token, sub }: Props) {
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[] | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'expenses' | 'balances'>('expenses');
  const [me, setMe] = useState<string | undefined>(getJoinedGroup(groupId)?.memberId);
  const [shared, setShared] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [g, m, e, p] = await Promise.all([
        api.getGroup(groupId, token),
        api.listMembers(groupId, token),
        api.listExpenses(groupId, token),
        api.listPayments(groupId, token),
      ]);
      setGroup(g);
      setMembers(m);
      setExpenses(e);
      setPayments(p);
      // A previous attempt may have failed (bad token, server down) — a
      // successful reload must clear the error or the screen stays stuck on it.
      setError('');
      // Opening a valid link is enough to belong here — remember it in this
      // context (PWA or browser) so it shows up on Home, keeping any identity
      // already picked. This is what carries a link-shared group across the
      // PWA/browser storage divide once you've opened it once.
      const existing = getJoinedGroup(groupId);
      rememberGroup({ ...existing, id: g.id, t: token, name: g.name });
    } catch (err) {
      setError('Could not load this group. The link may be wrong or the server unreachable.');
      console.error(err);
    }
  }, [groupId, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) {
    return (
      <div class="page">
        <p class="error">{error}</p>
        <button class="btn" onClick={() => navigate('/')}>Home</button>
      </div>
    );
  }
  if (!group || !members || !expenses || !payments) {
    return <div class="page center"><div class="spinner big-spinner" /></div>;
  }

  const memberById = new Map(members.map(m => [m.id, m]));
  const meValid = me !== undefined && memberById.has(me);

  if (!meValid) {
    return (
      <JoinScreen
        group={group}
        token={token}
        members={members}
        onJoined={(memberId, refreshedMembers) => {
          rememberGroup({ id: group.id, t: token, name: group.name, memberId });
          if (refreshedMembers) setMembers(refreshedMembers);
          setMe(memberId);
        }}
      />
    );
  }

  if (sub[0] === 'settings') {
    return (
      <GroupSettings
        group={group}
        token={token}
        members={members}
        me={me!}
        onMeChange={memberId => {
          rememberGroup({ id: group.id, t: token, name: group.name, memberId });
          setMe(memberId);
        }}
        onDone={changed => {
          navigate(groupPath(groupId, token));
          if (changed) reload();
        }}
      />
    );
  }

  if (sub[0] === 'new' || (sub[0] === 'e' && sub[1])) {
    const editing = sub[0] === 'e' ? expenses.find(x => x.id === sub[1]) : undefined;
    return (
      <ExpenseForm
        group={group}
        token={token}
        members={members}
        me={me!}
        expense={editing}
        onDone={() => {
          navigate(groupPath(groupId, token));
          reload();
        }}
      />
    );
  }

  async function share() {
    const url = `${location.origin}/${groupPath(group!.id, token)}`;
    const data = { title: `Divvy: ${group!.name}`, text: `Join our expense group "${group!.name}"`, url };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch { /* cancelled — fall through to clipboard */ }
    }
    await navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <div class="page">
      <header class="group-header">
        <button class="back" onClick={() => navigate('/')}>‹</button>
        <div class="group-title">
          <h1>{group.name}</h1>
          <button
            class="me-chip"
            title="Group settings"
            onClick={() => navigate(groupPath(groupId, token, '/settings'))}
          >
            <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            You: {memberById.get(me!)?.name} · Settings
          </button>
        </div>
        <button class="btn small" onClick={share}>
          {shared ? 'Copied!' : 'Invite'}
        </button>
      </header>

      <nav class="tabs">
        <button class={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}>
          Expenses
        </button>
        <button class={tab === 'balances' ? 'on' : ''} onClick={() => setTab('balances')}>
          Balances
        </button>
      </nav>

      {tab === 'expenses' ? (
        <>
          <WalletSummary group={group} expenses={expenses} payments={payments} members={members} me={me!} />
          <div class="seclbl left">Recent expenses</div>
          <ExpenseList
            expenses={expenses}
            groupCurrency={group.currency || 'USD'}
            memberById={memberById}
            memberCount={members.length}
            groupId={groupId}
            token={token}
            me={me!}
          />
        </>
      ) : (
        <Balances
          group={group}
          token={token}
          members={members}
          me={me!}
          expenses={expenses}
          payments={payments}
          onChanged={reload}
        />
      )}

      <button class="fab" onClick={() => navigate(groupPath(groupId, token, '/new'))} aria-label="Add expense">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * The group's wallet: total spent, how much is still unsettled across the
 * group (sum of what creditors are owed), and where you personally stand.
 */
function WalletSummary({
  group,
  expenses,
  payments,
  members,
  me,
}: {
  group: GroupRecord;
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  members: MemberRecord[];
  me: string;
}) {
  const groupCurrency = group.currency || 'USD';
  const fmt = (cents: number) => formatMoney(cents, groupCurrency);
  const totalSpent = expenses.reduce((a, e) => a + expenseGroupCents(e, groupCurrency), 0);
  const nets = computeNets(
    expenses.map(e => expenseForBalance(e, groupCurrency)),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: paymentGroupCents(p, groupCurrency) })),
  );
  const units = aggregateUnits(nets, members);
  const unsettled = units.reduce((a, u) => a + Math.max(0, u.cents), 0);
  const myUnit = units.find(u => u.memberIds.includes(me));
  const mine = myUnit?.cents ?? 0;
  // If you're in a party, the wallet is shared — label it by the party's name.
  const partySuffix =
    myUnit && myUnit.memberIds.length > 1
      ? ` · ${partyDisplayName(members.filter(m => myUnit.memberIds.includes(m.id)))}`
      : '';
  return (
    <>
      <div class="wallet-summary">
        <div class="subline">Your running balance{partySuffix}</div>
        <span class={`stamp big ${mine < 0 ? 'red' : ''}`}>
          {mine === 0 ? "You're settled up" : mine > 0 ? `You're owed ${fmt(mine)}` : `You owe ${fmt(-mine)}`}
        </span>
        <div class="wallet-stats">
          <div class="li"><span class="nm muted">Total spent</span><span class="lead" /><span class="amt">{fmt(totalSpent)}</span></div>
          <div class="li"><span class="nm muted">Unsettled</span><span class="lead" /><span class="amt">{fmt(unsettled)}</span></div>
        </div>
      </div>
      <hr class="rule" />
    </>
  );
}

/** What this expense did to `me`'s balance (in group currency): paid in, minus owed. */
function myDelta(e: ExpenseForBalance, me: string): number {
  const paid = e.payers?.length
    ? (e.payers.find(p => p.member === me)?.cents ?? 0)
    : e.paidBy === me
      ? e.amountCents
      : 0;
  const owed = e.entries.find(en => en.member === me)?.cents ?? 0;
  return paid - owed;
}

function ExpenseList({
  expenses,
  groupCurrency,
  memberById,
  memberCount,
  groupId,
  token,
  me,
}: {
  expenses: ExpenseRecord[];
  groupCurrency: string;
  memberById: Map<string, { name: string }>;
  memberCount: number;
  groupId: string;
  token: string;
  me: string;
}) {
  if (expenses.length === 0) {
    return <p class="hint">No expenses yet. Tap + to add the first one.</p>;
  }
  const nameOf = (id: string) => memberById.get(id)?.name ?? '?';
  const payerNames = (e: ExpenseRecord) =>
    e.payers?.length ? e.payers.map(p => nameOf(p.member)).join(' & ') : nameOf(e.paid_by);
  const participants = (e: ExpenseRecord) => {
    const ids = e.split.entries.map(en => en.member);
    if (memberCount > 1 && ids.length === memberCount) return 'everyone';
    return ids.length <= 3 ? ids.map(nameOf).join(', ') : `${ids.length} people`;
  };
  return (
    <>
      <ul class="expense-list">
        {expenses.map((e, i) => {
          const delta = myDelta(expenseForBalance(e, groupCurrency), me);
          const currency = e.currency || groupCurrency;
          const people = e.split.entries.map(en => ({
            id: en.member,
            initials: personInitial(nameOf(en.member)),
            color: colorForId(en.member),
          }));
          return (
            <li key={e.id}>
              {i > 0 && <hr class="rule" />}
              <button class="row-btn expense-row" onClick={() => navigate(groupPath(groupId, token, `/e/${e.id}`))}>
                <AvatarStack people={people} />
                <div class="expense-main">
                  <span class="expense-desc">{e.description}</span>
                  <span class="expense-meta">
                    {payerNames(e)} paid · split {e.split.entries.length} ways ({participants(e)}) · {e.date.slice(0, 10)}
                  </span>
                </div>
                <span class="expense-amount-col">
                  <span class="expense-amount num">{formatMoney(e.amount_cents, currency)}</span>
                  {currency !== groupCurrency && (
                    <span class="expense-fx num muted">
                      ≈ {formatMoney(expenseGroupCents(e, groupCurrency), groupCurrency)}
                    </span>
                  )}
                  {delta !== 0 && (
                    <span class={`expense-delta num ${delta > 0 ? 'pos' : 'neg'}`}>
                      {delta > 0 ? '+' : '-'}{formatMoney(Math.abs(delta), groupCurrency)} you
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <hr class="rule" />
    </>
  );
}

function JoinScreen({
  group,
  token,
  members,
  onJoined,
}: {
  group: GroupRecord;
  token: string;
  members: MemberRecord[];
  onJoined: (memberId: string, refreshedMembers?: MemberRecord[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function addMe() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const m = await api.addMember(group.id, newName.trim(), token);
      const refreshed = await api.listMembers(group.id, token);
      onJoined(m.id, refreshed);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <div class="page">
      <header class="app-header">
        <h1>{group.name}</h1>
        <p class="tagline">Who are you?</p>
      </header>
      <section class="ticket-box">
        <div class="chip-row wrap">
          {members.map(m => (
            <button key={m.id} class="chip lg with-avatar" onClick={() => onJoined(m.id)}>
              <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={30} />
              {m.name}
            </button>
          ))}
        </div>
        <div class="divider">or add yourself</div>
        <div class="inline-add">
          <input
            value={newName}
            placeholder="Your name"
            onInput={e => setNewName((e.target as HTMLInputElement).value)}
          />
          <button class="btn primary" onClick={addMe} disabled={busy || !newName.trim()}>
            {busy ? '…' : 'Join'}
          </button>
        </div>
        {error && <p class="error">{error}</p>}
      </section>
      <p class="hint sans">
        No password, no account — picking a name just makes adding expenses quicker.
      </p>
    </div>
  );
}
