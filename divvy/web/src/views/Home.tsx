import { useEffect, useState } from 'preact/hooks';
import { api, groupPath, navigate } from '../app';
import { aggregateUnits, computeNets, expenseForBalance, paymentGroupCents } from '../lib/balances';
import { detectCurrency, formatMoney } from '../lib/currency';
import { collectiveInitials } from '../lib/avatar';
import { Avatar } from '../components/Avatar';
import { CurrencySelect } from '../components/CurrencySelect';
import { listJoinedGroups, newToken, parseGroupLink, rememberGroup, type JoinedGroup } from '../identity';

interface GroupSummary {
  memberCount: number;
  expenseCount: number;
  balanceCents?: number;
  currency: string;
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
            [g.id]: { memberCount: members.length, expenseCount: expenses.length, balanceCents: myUnit?.cents, currency },
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

export function Home() {
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const groups = listJoinedGroups();
  const summaries = useGroupSummaries(groups);

  return (
    <div class="page">
      <div class="rhead">
        <div class="wordmark">DIVVY</div>
        <div class="stars">* * * * *</div>
        <div class="subline">Split expenses without the fuss</div>
        <div class="subline" style="margin-top:3px;">No accounts · No sign-ups</div>
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
                    <Avatar initials={collectiveInitials(g.name)} color="#0B7A4E" size={42} />
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
          A group is just a link — anyone with it is in. No accounts, no
          sign-ups, no fuss. Already have a link (say, from Safari)? Tap “Open
          a group link” to pull it in here.
        </p>
      )}

      <hr class="rule" style="margin-top:6px;" />
      <div class="barcode" />
      <div class="barnum">DIVVY · SPLIT EXPENSES</div>
      <div class="rhead subline" style="margin-top:2px;">*** Thank you ***</div>
    </div>
  );
}

function OpenGroup({ onCancel }: { onCancel: () => void }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    const parsed = parseGroupLink(link);
    if (!parsed) return setError("That doesn't look like a Divvy group link.");
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
  const [name, setName] = useState('');
  const [membersText, setMembersText] = useState('');
  const [myName, setMyName] = useState('');
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
    if (memberNames.length === 0) return setError('Add at least one member (you!)');
    if (!myName) return setError('Pick which member is you');
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
      for (const n of memberNames) {
        const m = await api.addMember(group.id, n, token);
        if (n === myName) myId = m.id;
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
      <label class="field">
        <span>Members — one per line (you can always add more later)</span>
        <textarea
          rows={4}
          value={membersText}
          onInput={e => setMembersText((e.target as HTMLTextAreaElement).value)}
          placeholder={'Matt\nSarah\nDad'}
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
      {memberNames.length > 0 && (
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
