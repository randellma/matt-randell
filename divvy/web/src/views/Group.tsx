import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, groupPath, navigate } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord } from '../api';
import { getJoinedGroup, rememberGroup } from '../identity';
import { aggregateUnits, computeNets } from '../lib/balances';
import { formatCents } from '../lib/money';
import { partyDisplayName } from '../lib/party';
import { ExpenseForm } from './ExpenseForm';
import { Balances } from './Balances';

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
          <button class="me-chip" title="Switch who you are" onClick={() => setMe(undefined)}>
            you: {memberById.get(me!)?.name}
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
          {expenses.length > 0 && (
            <GroupSummary
              expenses={expenses}
              payments={payments}
              members={members}
              me={me!}
              onShowBalances={() => setTab('balances')}
            />
          )}
          <ExpenseList
            expenses={expenses}
            memberById={memberById}
            memberCount={members.length}
            groupId={groupId}
            token={token}
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
 * One-glance group position: total spent, how much is still unsettled across
 * the group (sum of what creditors are owed), and where you stand. Tapping it
 * jumps to the Balances tab.
 */
function GroupSummary({
  expenses,
  payments,
  members,
  me,
  onShowBalances,
}: {
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  members: MemberRecord[];
  me: string;
  onShowBalances: () => void;
}) {
  const totalSpent = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const nets = computeNets(
    expenses.map(e => ({ paidBy: e.paid_by, amountCents: e.amount_cents, payers: e.payers, entries: e.split.entries })),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: p.amount_cents })),
  );
  const units = aggregateUnits(nets, members);
  const unsettled = units.reduce((a, u) => a + Math.max(0, u.cents), 0);
  const myUnit = units.find(u => u.memberIds.includes(me));
  const mine = myUnit?.cents ?? 0;
  // If you're in a party, your position is your wallet's — labeled by its name.
  const label =
    myUnit && myUnit.memberIds.length > 1
      ? partyDisplayName(members.filter(m => myUnit.memberIds.includes(m.id)))
      : 'You';
  return (
    <button class="summary-strip" onClick={onShowBalances} title="See balances">
      <span class="stat">
        <span>Total spent</span>
        <b>{formatCents(totalSpent)}</b>
      </span>
      <span class="stat">
        <span>Unsettled</span>
        <b>{formatCents(unsettled)}</b>
      </span>
      <span class="stat">
        <span>{label}</span>
        <b class={mine > 0 ? 'pos' : mine < 0 ? 'neg' : ''}>
          {mine === 0 ? 'settled ✓' : mine > 0 ? `get ${formatCents(mine)}` : `owe ${formatCents(-mine)}`}
        </b>
      </span>
    </button>
  );
}

function ExpenseList({
  expenses,
  memberById,
  memberCount,
  groupId,
  token,
}: {
  expenses: ExpenseRecord[];
  memberById: Map<string, { name: string }>;
  memberCount: number;
  groupId: string;
  token: string;
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
    <ul class="expense-list">
      {expenses.map(e => (
        <li key={e.id}>
          <button class="expense-row" onClick={() => navigate(groupPath(groupId, token, `/e/${e.id}`))}>
            <div class="expense-main">
              <span class="expense-desc">{e.description}</span>
              <span class="expense-meta">
                {payerNames(e)} paid for {participants(e)} · {e.date.slice(0, 10)}
              </span>
            </div>
            <span class="expense-amount">{formatCents(e.amount_cents)}</span>
          </button>
        </li>
      ))}
    </ul>
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
      <section class="card">
        <div class="chip-row wrap">
          {members.map(m => (
            <button key={m.id} class="chip lg" onClick={() => onJoined(m.id)}>
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
      <p class="hint">
        No password, no account — picking a name just makes adding expenses quicker.
      </p>
    </div>
  );
}
