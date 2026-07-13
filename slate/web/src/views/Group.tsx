import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api, groupPath, navigate } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord, SecurityInfo } from '../api';
import { getJoinedGroup, rememberGroup } from '../identity';
import { PinGate } from './PinGate';
import {
  aggregateUnits,
  computeNets,
  expenseForBalance,
  expenseGroupCents,
  paymentGroupCents,
  suggestSettlements,
  unitNets,
  type ExpenseForBalance,
} from '../lib/balances';
import { formatMoney } from '../lib/currency';
import { partyDisplayName } from '../lib/party';
import { activeMembers } from '../lib/member';
import { colorForId, collectiveInitials, GROUP_AVATAR_COLOR, personInitial } from '../lib/avatar';
import { Avatar, AvatarStack } from '../components/Avatar';
import { ShareDrawer } from '../components/ShareDrawer';
import { ExpenseForm } from './ExpenseForm';
import { Balances } from './Balances';
import { GroupSettings } from './GroupSettings';

interface Props {
  groupId: string;
  /** token from the URL — absent on token-less routes (PIN-gated groups) */
  token?: string;
  sub: string[];
}

export function Group({ groupId, token: urlToken, sub }: Props) {
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[] | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'expenses' | 'balances'>('expenses');
  const [me, setMe] = useState<string | undefined>(getJoinedGroup(groupId)?.memberId);
  const [shareOpen, setShareOpen] = useState(false);
  // The working credential: from the URL on full links, from localStorage on
  // token-less ones. Empty until the PIN gate hands one over.
  const [token, setToken] = useState(urlToken ?? getJoinedGroup(groupId)?.t ?? '');
  // Set when we hold no working token but the group takes a PIN — render the gate.
  const [pinInfo, setPinInfo] = useState<SecurityInfo | null>(null);
  // URL form for in-app navigation: keep the token in the URL only if it
  // arrived there and still works; PIN-gated groups stay token-less so the
  // credential never sits in the address bar.
  const linkToken = urlToken === token ? token : '';

  const reload = useCallback(async () => {
    const load = async (tok: string) => {
      const [g, m, e, p] = await Promise.all([
        api.getGroup(groupId, tok),
        api.listMembers(groupId, tok),
        api.listExpenses(groupId, tok),
        api.listPayments(groupId, tok),
      ]);
      setGroup(g);
      setMembers(m);
      setExpenses(e);
      setPayments(p);
      // A previous attempt may have failed (bad token, server down) — a
      // successful reload must clear the error or the screen stays stuck on it.
      setError('');
      setPinInfo(null);
      // Opening a valid link is enough to belong here — remember it in this
      // context (PWA or browser) so it shows up on Home, keeping any identity
      // already picked. This is what carries a link-shared group across the
      // PWA/browser storage divide once you've opened it once.
      const existing = getJoinedGroup(groupId);
      rememberGroup({ ...existing, id: g.id, t: tok, name: g.name });
    };
    try {
      if (!token) throw new Error('no token yet');
      await load(token);
    } catch (err) {
      // The URL token may be stale (rotated when a PIN went on) while a newer
      // one sits in localStorage — try that before giving up.
      const stored = getJoinedGroup(groupId)?.t;
      if (stored && stored !== token) {
        try {
          await load(stored);
          setToken(stored);
          return;
        } catch {
          /* fall through to the PIN probe */
        }
      }
      // No working token. If the group is PIN-gated, the gate can get us in.
      try {
        const info = await api.securityInfo(groupId);
        if (info.pin) {
          setPinInfo(info);
          return;
        }
      } catch {
        /* server unreachable — the generic error below covers it */
      }
      setError('Could not load this group. The link may be wrong or the server unreachable.');
      console.error(err);
    }
  }, [groupId, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (pinInfo) {
    return (
      <PinGate
        groupId={groupId}
        info={pinInfo}
        onJoined={t => {
          rememberGroup({
            ...getJoinedGroup(groupId),
            id: groupId,
            t,
            name: pinInfo.name ?? '',
          });
          setPinInfo(null);
          setToken(t);
          // The URL may still carry the dead token — move to the token-less route.
          if (urlToken) navigate(groupPath(groupId, '', sub.length ? `/${sub.join('/')}` : ''));
        }}
      />
    );
  }

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
        expenses={expenses}
        payments={payments}
        me={me!}
        onMeChange={memberId => {
          rememberGroup({ id: group.id, t: token, name: group.name, memberId });
          setMe(memberId);
        }}
        onTokenRotated={t => {
          // Turning the PIN on rotated the token: adopt it here and get the
          // old one out of the address bar — this device stays signed in.
          rememberGroup({ ...getJoinedGroup(groupId), id: group.id, t, name: group.name });
          setToken(t);
          navigate(groupPath(groupId, '', '/settings'));
        }}
        onDone={changed => {
          navigate(groupPath(groupId, linkToken));
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
          navigate(groupPath(groupId, linkToken));
          reload();
        }}
      />
    );
  }

  // Path form (not the hash route) so the server can serve a per-group
  // link-preview card to messaging-app crawlers. PIN-gated groups share a
  // token-less link — the PIN is the way in, not the URL.
  const shareUrl = group.pin_on
    ? `${location.origin}/g/${group.id}`
    : `${location.origin}/g/${group.id}/${token}`;

  // Your position, for the slate board and the expenses-tab totals. "You"
  // means your wallet: yourself, or your whole party if you're linked.
  const groupCurrency = group.currency || 'USD';
  const nets = computeNets(
    expenses.map(e => expenseForBalance(e, groupCurrency)),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: paymentGroupCents(p, groupCurrency) })),
  );
  const units = aggregateUnits(nets, members);
  const totalSpent = expenses.reduce((a, e) => a + expenseGroupCents(e, groupCurrency), 0);
  const unsettled = units.reduce((a, u) => a + Math.max(0, u.cents), 0);
  const myUnit = units.find(u => u.memberIds.includes(me!));
  const mine = myUnit?.cents ?? 0;
  const transfers = suggestSettlements(unitNets(units));
  const myTransfers = myUnit
    ? transfers.filter(t => (mine < 0 ? t.from === myUnit.key : t.to === myUnit.key)).length
    : 0;
  // If you're in a party, the wallet is shared — label the board with its name.
  const walletName =
    myUnit && myUnit.memberIds.length > 1
      ? partyDisplayName(members.filter(m => myUnit.memberIds.includes(m.id)))
      : '';

  function settleUp() {
    const scroll = () =>
      document.getElementById('settle-up')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (tab !== 'balances') {
      setTab('balances');
      setTimeout(scroll, 80);
    } else {
      scroll();
    }
  }

  const fmt = (cents: number) => formatMoney(cents, groupCurrency);

  return (
    <div class="page">
      <header class="group-header">
        <button class="back" onClick={() => navigate('/')}>‹</button>
        <Avatar
          initials={collectiveInitials(group.name)}
          color={GROUP_AVATAR_COLOR}
          size={52}
          radius={12}
          src={api.groupPhotoUrl(group)}
        />
        <div class="group-header-text">
          <h1>{group.name}</h1>
          <div class="group-header-bottom">
            <span class="me-chip">
              <span class="me-dot">{personInitial(memberById.get(me!)?.name ?? '?')}</span>
              You · {memberById.get(me!)?.name}
            </span>
            <span class="spacer" />
            <button
              class="icon-btn"
              title="Group settings"
              aria-label="Group settings"
              onClick={() => navigate(groupPath(groupId, linkToken, '/settings'))}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button class="icon-btn" title="Add people" aria-label="Add people to this group" onClick={() => setShareOpen(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6M22 11h-6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <SlateBoard
        mine={mine}
        walletName={walletName}
        paymentsLeft={myTransfers}
        hasPayments={payments.length > 0}
        hasExpenses={expenses.length > 0}
        fmt={fmt}
        onSettleUp={settleUp}
      />

      <nav class="tabs">
        <button class={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}>
          Activity
        </button>
        <button class={tab === 'balances' ? 'on' : ''} onClick={() => setTab('balances')}>
          Balances
        </button>
      </nav>

      {tab === 'expenses' ? (
        <>
          <div class="seclbl left">Recent expenses</div>
          <ExpenseList
            expenses={expenses}
            groupCurrency={groupCurrency}
            memberById={memberById}
            memberCount={members.length}
            groupId={groupId}
            token={linkToken}
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
          totalSpent={totalSpent}
          unsettled={unsettled}
          onChanged={reload}
        />
      )}

      <hr class="rule" style="margin-top:4px;" />
      <button class="invite-btn" onClick={() => setShareOpen(true)}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
        Add people to this slate
      </button>
      <div class="thanks">*** Thank you ***</div>

      <ShareDrawer
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        groupName={group.name}
        url={shareUrl}
        pinOn={group.pin_on}
      />

      <button class="fab" onClick={() => navigate(groupPath(groupId, linkToken, '/new'))} aria-label="Add expense">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * The slate board — a charcoal card above the tabs, on-screen everywhere,
 * showing where your wallet stands. Settling the last debt wipes it clean
 * with a chalk-eraser sweep.
 */
function SlateBoard({
  mine,
  walletName,
  paymentsLeft,
  hasPayments,
  hasExpenses,
  fmt,
  onSettleUp,
}: {
  mine: number;
  walletName: string;
  paymentsLeft: number;
  hasPayments: boolean;
  hasExpenses: boolean;
  fmt: (cents: number) => string;
  onSettleUp: () => void;
}) {
  // Play the wipe only when the balance just went to zero — not when a group
  // that's already square first loads.
  const prev = useRef<number | null>(null);
  const justWiped = prev.current !== null && prev.current !== 0 && mine === 0;
  useEffect(() => {
    prev.current = mine;
  }, [mine]);

  const clean = mine === 0;
  const wipeNote =
    paymentsLeft === 1 ? '1 payment wipes it clean' : `${paymentsLeft} payments wipe it clean`;

  return (
    <div class="slate-board">
      {clean ? (
        <div class={`slate-inner ${justWiped ? 'chalkin' : ''}`}>
          <div class="slate-label">
            <span>You're square</span>
            {walletName && <span class="wallet">· {walletName}</span>}
          </div>
          <div class="slate-amount">{fmt(0)}</div>
          <div class="slate-note">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12l5 5 11-11" />
            </svg>
            <span>
              {hasPayments
                ? 'Slate wiped clean · tap a payment to undo'
                : hasExpenses
                  ? 'Nothing owed either way'
                  : 'Nothing on the slate yet — tap + to start'}
            </span>
          </div>
        </div>
      ) : (
        <div class="slate-inner">
          <div class="slate-label">
            <span>{mine < 0 ? 'You owe' : "You're owed"}</span>
            {walletName && <span class="wallet">· {walletName}</span>}
          </div>
          <div class="slate-amount">{fmt(Math.abs(mine))}</div>
          <div class="slate-actions">
            <button class="slate-settle" onClick={onSettleUp}>Settle up</button>
            <div class="slate-note">
              <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="9" width="15" height="8" rx="2" transform="rotate(-20 11.5 13)" />
                <path d="M6 20h13" />
              </svg>
              <span style="max-width:118px;">{wipeNote}</span>
            </div>
          </div>
        </div>
      )}
      {justWiped && <div class="slate-wipe" />}
    </div>
  );
}

/**
 * What this expense did to your wallet's balance (in group currency): paid in,
 * minus owed. `meIds` is you alone, or every member of your party — a couple
 * settles as one, so their expense deltas aggregate the same way.
 */
function walletDelta(e: ExpenseForBalance, meIds: string[]): number {
  const paid = e.payers?.length
    ? e.payers.filter(p => meIds.includes(p.member)).reduce((a, p) => a + p.cents, 0)
    : meIds.includes(e.paidBy)
      ? e.amountCents
      : 0;
  const owed = e.entries
    .filter(en => meIds.includes(en.member))
    .reduce((a, en) => a + en.cents, 0);
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
  memberById: Map<string, MemberRecord>;
  memberCount: number;
  groupId: string;
  token: string;
  me: string;
}) {
  if (expenses.length === 0) {
    return <p class="hint">No expenses yet. Tap + to add the first one.</p>;
  }
  // "You" means your wallet: yourself, or your whole party if you're linked.
  const myParty = memberById.get(me)?.party;
  const meIds = myParty
    ? [...memberById.values()].filter(m => m.party === myParty).map(m => m.id)
    : [me];
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
          const delta = walletDelta(expenseForBalance(e, groupCurrency), meIds);
          const currency = e.currency || groupCurrency;
          const people = e.split.entries.map(en => {
            const m = memberById.get(en.member);
            return {
              id: en.member,
              initials: personInitial(nameOf(en.member)),
              color: colorForId(en.member),
              src: m && api.memberPhotoUrl(m),
            };
          });
          return (
            <li key={e.id}>
              {i > 0 && <hr class="rule" />}
              <button class="row-btn expense-row" onClick={() => navigate(groupPath(groupId, token, `/e/${e.id}`))}>
                <AvatarStack people={people} />
                <div class="expense-main">
                  <span class="expense-desc">{e.description}</span>
                  <span class="expense-meta">
                    {payerNames(e)} paid · split {e.split.entries.length} ways ({participants(e)}) · {e.date.slice(0, 10)}
                    {e.receipt && (
                      <>
                        {' · '}
                        <svg class="meta-clip" viewBox="0 0 24 24" width="10" height="10" aria-label="Has receipt" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </>
                    )}
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
        {group.photo && (
          <div style="display:flex;justify-content:center;margin-bottom:10px;">
            <Avatar initials={collectiveInitials(group.name)} color={GROUP_AVATAR_COLOR} size={64} src={api.groupPhotoUrl(group)} />
          </div>
        )}
        <h1>{group.name}</h1>
        <p class="tagline">Who are you?</p>
      </header>
      <section class="ticket-box">
        <div class="chip-row wrap">
          {activeMembers(members).map(m => (
            <button key={m.id} class="chip lg with-avatar" onClick={() => onJoined(m.id)}>
              <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={30} src={api.memberPhotoUrl(m)} />
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
