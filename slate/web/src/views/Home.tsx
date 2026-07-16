import { useEffect, useState } from 'preact/hooks';
import { api, groupPath, navigate } from '../app';
import { aggregateUnits, computeNets, expenseForBalance, paymentGroupCents } from '../lib/balances';
import { detectCurrency, formatMoney } from '../lib/currency';
import { collectiveInitials, colorForId, GROUP_AVATAR_COLOR, personInitial } from '../lib/avatar';
import { activeMembers } from '../lib/member';
import { Avatar } from '../components/Avatar';
import { CurrencySelect } from '../components/CurrencySelect';
import { AccountSheet } from '../components/AccountSheet';
import { useUser } from '../account';
import { listJoinedGroups, mergeGroups, newToken, parseGroupLink, rememberGroup, type JoinedGroup } from '../identity';
import type { ClaimedGroup, UserRecord } from '../api';

interface GroupSummary {
  memberCount: number;
  expenseCount: number;
  balanceCents?: number;
  currency: string;
  /** group avatar photo, if one has been set */
  photoUrl?: string;
}

/** Fetches member/expense counts and your net position for each joined group, best-effort. */
function useGroupSummaries(groups: JoinedGroup[]): Record<string, GroupSummary> {
  const [summaries, setSummaries] = useState<Record<string, GroupSummary>>({});
  const key = groups.map(g => `${g.id}:${g.t}:${g.memberId ?? ''}`).join(',');

  useEffect(() => {
    let cancelled = false;
    for (const g of groups) {
      Promise.all([
        api.getGroup(g.id, g.t),
        api.listMembers(g.id, g.t),
        api.listExpenses(g.id, g.t),
        api.listPayments(g.id, g.t),
      ])
        .then(([group, members, expenses, payments]) => {
          if (cancelled) return;
          const currency = group.currency || 'USD';
          const nets = computeNets(
            expenses.map(e => expenseForBalance(e, currency)),
            payments.map(p => ({ from: p.from_member, to: p.to_member, cents: paymentGroupCents(p, currency) })),
          );
          const units = aggregateUnits(nets, members);
          const myUnit = g.memberId ? units.find(u => u.memberIds.includes(g.memberId!)) : undefined;
          setSummaries(s => ({
            ...s,
            [g.id]: {
              memberCount: activeMembers(members).length,
              expenseCount: expenses.length,
              balanceCents: myUnit?.cents,
              currency,
              photoUrl: api.groupPhotoUrl(group),
            },
          }));
        })
        .catch(() => {
          /* leave this group's summary absent — row falls back to its name only */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  return summaries;
}

/**
 * Groups that follow the account: derived from its claims on the server
 * (ADR-0005), fetched fresh per sign-in. Held only in memory — signing out
 * empties this, which is exactly how derived groups leave Home while the
 * locally-remembered ones stay.
 */
function useClaimedGroups(user: UserRecord | null): ClaimedGroup[] {
  const [claimed, setClaimed] = useState<ClaimedGroup[]>([]);
  useEffect(() => {
    if (!user) {
      setClaimed([]);
      return;
    }
    let cancelled = false;
    api.listClaimedGroups().then(
      gs => {
        if (!cancelled) setClaimed(gs);
      },
      () => {
        /* offline or a dead session — Home just shows the local list */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  return claimed;
}

export function Home() {
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const user = useUser();
  const claimed = useClaimedGroups(user);
  const groups = mergeGroups(listJoinedGroups(), claimed);
  const summaries = useGroupSummaries(groups);
  // The scans row shows the live balance; scans spend credits without
  // touching the cached authStore record, so refresh it on the way in.
  useEffect(() => {
    api.refreshUser();
  }, []);

  return (
    <div class="page">
      <div class="rhead">
        <div class="wordmark">SLATE</div>
        <div class="stars">* * * * *</div>
        <div class="subline">Split expenses without the fuss</div>
        <div class="subline" style="margin-top:3px;">A group is just a link · No sign-up to join</div>
      </div>
      <hr class="rule" />

      {groups.length > 0 && (
        <>
          <div class="seclbl left">Your groups</div>
          <ul class="group-list">
            {groups.map((g, i) => {
              const s = summaries[g.id];
              return (
                <li key={g.id}>
                  {i > 0 && <hr class="rule" />}
                  <button class="row-btn group-row" onClick={() => navigate(groupPath(g.id, g.t))}>
                    <Avatar initials={collectiveInitials(g.name)} color={GROUP_AVATAR_COLOR} size={42} src={s?.photoUrl} />
                    <span class="group-row-main">
                      <span class="group-name">{g.name}</span>
                      <span class="group-meta">
                        {s ? `${s.memberCount} member${s.memberCount === 1 ? '' : 's'} · ${s.expenseCount} expense${s.expenseCount === 1 ? '' : 's'}` : '···'}
                      </span>
                    </span>
                    {s?.balanceCents !== undefined && s.balanceCents !== 0 && (
                      <span class="group-balance">
                        <b class={`num ${s.balanceCents > 0 ? 'pos' : 'neg'}`}>
                          {s.balanceCents > 0 ? '+' : '-'}{formatMoney(Math.abs(s.balanceCents), s.currency)}
                        </b>
                        <span>{s.balanceCents > 0 ? "you're owed" : 'you owe'}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <hr class="rule" />
        </>
      )}

      {creating ? (
        <CreateGroup onCancel={() => setCreating(false)} />
      ) : opening ? (
        <OpenGroup onCancel={() => setOpening(false)} />
      ) : (
        <div class="home-actions">
          <button class="btn ink big" onClick={() => setCreating(true)}>
            + New group
          </button>
          <button class="btn big" onClick={() => setOpening(true)}>
            Open a group link
          </button>
        </div>
      )}

      {groups.length === 0 && !creating && !opening && (
        <p class="hint sans">
          A group is just a link — anyone with it is in. No sign-ups, no fuss.
          Already have a link (say, from Safari)? Tap “Open a group link” to
          pull it in here.
        </p>
      )}

      <hr class="rule" style="margin-top:6px;" />
      {user ? (
        <button class="account-btn" onClick={() => setAccountOpen(true)}>
          <Avatar
            initials={personInitial(user.name || user.email)}
            color={colorForId(user.id)}
            size={36}
            src={api.userPhotoUrl(user)}
          />
          <span class="account-main">
            <span class="account-name">{user.name || user.email}</span>
            <span class="account-scans">{user.credits} scan{user.credits === 1 ? '' : 's'} left</span>
          </span>
        </button>
      ) : (
        <button class="invite-btn" onClick={() => setAccountOpen(true)}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
          </svg>
          Account · Sign in
        </button>
      )}
      <div class="thanks">*** Thank you ***</div>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}

function OpenGroup({ onCancel }: { onCancel: () => void }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    const parsed = parseGroupLink(link);
    if (!parsed) return setError("That doesn't look like a Slate group link.");
    if (!parsed.t) {
      // Token-less link — a PIN-gated group. The group screen shows the PIN
      // gate and remembers the group once the PIN checks out.
      navigate(groupPath(parsed.id, ''));
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Confirm the link is real (and grab the name) before remembering it.
      const group = await api.getGroup(parsed.id, parsed.t);
      rememberGroup({ id: group.id, t: parsed.t, name: group.name });
      navigate(groupPath(group.id, parsed.t));
    } catch {
      setError("Couldn't open that group — check the link is complete.");
      setBusy(false);
    }
  }

  return (
    <section class="ticket-box">
      <h2>Open a group link</h2>
      <p class="hint sans" style="text-align:left">
        Paste a link someone shared with you, or one you copied from another
        browser. Anyone with the link is in.
      </p>
      <div class="inline-add">
        <input
          value={link}
          placeholder="https://…/#/g/…"
          onInput={e => setLink((e.target as HTMLInputElement).value)}
        />
      </div>
      {error && <p class="error">{error}</p>}
      <div class="btn-row">
        <button class="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button class="btn primary" onClick={open} disabled={busy || !link.trim()}>
          {busy ? 'Opening…' : 'Open'}
        </button>
      </div>
    </section>
  );
}

function CreateGroup({ onCancel }: { onCancel: () => void }) {
  const user = useUser();
  const [name, setName] = useState('');
  const [membersText, setMembersText] = useState('');
  const [myName, setMyName] = useState('');
  // Signed in you're pre-added as a claimed member, named from your profile
  // (ADR-0005) — the field starts filled, so usually there's nothing to type.
  const [selfName, setSelfName] = useState(user?.name ?? '');
  // Group currency defaults to wherever this device seems to live.
  const [currency, setCurrency] = useState(detectCurrency);
  const [expenseCurrency, setExpenseCurrency] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const memberNames = [
    ...new Set(
      membersText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
    ),
  ];

  async function create() {
    if (!name.trim()) return setError('Give the group a name');
    if (user) {
      if (!selfName.trim()) return setError('Add your name');
    } else {
      if (memberNames.length === 0) return setError('Add at least one member (you!)');
      if (!myName) return setError('Pick which member is you');
    }
    setBusy(true);
    setError('');
    try {
      const token = newToken();
      const group = await api.createGroup(
        name.trim(),
        token,
        currency,
        expenseCurrency === currency ? '' : expenseCurrency,
      );
      let myId: string | undefined;
      if (user) {
        // You first, born claimed — identity settled before anyone else's row.
        const me = await api.addClaimedMember(group.id, selfName.trim(), token);
        myId = me.id;
        for (const n of memberNames.filter(n => n !== selfName.trim())) {
          await api.addMember(group.id, n, token);
        }
      } else {
        for (const n of memberNames) {
          const m = await api.addMember(group.id, n, token);
          if (n === myName) myId = m.id;
        }
      }
      rememberGroup({ id: group.id, t: token, name: group.name, memberId: myId });
      navigate(groupPath(group.id, token));
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <section class="ticket-box">
      <h2>New group</h2>
      <label class="field">
        <span>Group name</span>
        <input
          value={name}
          onInput={e => setName((e.target as HTMLInputElement).value)}
          placeholder="Beach trip 2026"
        />
      </label>
      {user && (
        <label class="field">
          <span>You — joined &amp; linked to your account automatically</span>
          <input
            value={selfName}
            maxLength={60}
            placeholder="Your name"
            onInput={e => setSelfName((e.target as HTMLInputElement).value)}
          />
        </label>
      )}
      <label class="field">
        <span>{user ? 'Other members' : 'Members'} — one per line (you can always add more later)</span>
        <textarea
          rows={4}
          value={membersText}
          onInput={e => setMembersText((e.target as HTMLTextAreaElement).value)}
          placeholder={user ? 'Sarah\nDad' : 'Matt\nSarah\nDad'}
        />
      </label>
      <div class="field-row">
        <label class="field grow">
          <span>Settle up in</span>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </label>
        <label class="field grow">
          <span>Expenses usually in</span>
          <CurrencySelect
            value={expenseCurrency}
            onChange={setExpenseCurrency}
            emptyLabel={`Same (${currency})`}
          />
        </label>
      </div>
      {!user && memberNames.length > 0 && (
        <div class="field">
          <span>Which one is you?</span>
          <div class="chip-row wrap">
            {memberNames.map(n => (
              <button
                key={n}
                class={`chip ${myName === n ? 'on' : ''}`}
                onClick={() => setMyName(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p class="error">{error}</p>}
      <div class="btn-row">
        <button class="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button class="btn primary" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </section>
  );
}
