import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { api, navigate } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord, SecurityInfo } from '../api';
import { convertMinor, formatMoney } from '../lib/currency';
import { fetchRate } from '../lib/fx';
import { computeNets, expenseForBalance, paymentGroupCents, suggestSettlements } from '../lib/balances';
import { activeMembers, memberReferenced } from '../lib/member';
import { prepareAvatarImage } from '../image';
import { colorForId, collectiveInitials, personInitial } from '../lib/avatar';
import { groupParties, partyDisplayName } from '../lib/party';
import { forgetGroup, newToken } from '../identity';
import { Avatar } from '../components/Avatar';
import { CurrencySelect } from '../components/CurrencySelect';

interface Props {
  group: GroupRecord;
  token: string;
  members: MemberRecord[];
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  me: string;
  /** the user tapped a different member as "you" — local identity only */
  onMeChange: (memberId: string) => void;
  /** turning the PIN on rotated the group token — adopt the new one */
  onTokenRotated: (t: string) => void;
  /** back out, reloading group data if `changed` */
  onDone: (changed: boolean) => void;
}

/**
 * Group settings: photos for the group, members, and parties; rename the
 * group; switch who "you" are on this device; link couples & households; and
 * configure currencies. Photos and party links apply immediately; the name
 * and currency fields go through Save. Changing the group currency rewrites
 * every expense's and payment's stored conversion at its own date — amounts
 * stay in their original currencies; only the group-level view moves.
 */
export function GroupSettings({ group, token, members, expenses, payments, me, onMeChange, onTokenRotated, onDone }: Props) {
  // Local copies so photo/party edits show up without leaving the page; the
  // caller reloads on the way out whenever anything was mutated.
  const [grp, setGrp] = useState(group);
  const [mems, setMems] = useState(members);
  const mutated = useRef(false);

  const oldCurrency = group.currency || 'USD';
  const groupCurrency = grp.currency || 'USD';

  // Net position per member, so removal can be gated to settled members. Reads
  // the expenses/payments as loaded — settling in Balances reloads the group,
  // so this reflects the latest ledger whenever settings is opened.
  const nets = computeNets(
    expenses.map(e => expenseForBalance(e, groupCurrency)),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: paymentGroupCents(p, groupCurrency) })),
  );
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

  /** Immediate mutations (photos, parties) — outside the Save flow. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      mutated.current = true;
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function replaceMembers(updated: MemberRecord[]) {
    setMems(ms => ms.map(m => updated.find(u => u.id === m.id) ?? m));
  }

  /** Drop a hard-deleted member from the local list (no record left to reload). */
  function dropMember(id: string) {
    setMems(ms => ms.filter(m => m.id !== id));
  }

  const pickGroupPhoto = (file: File) =>
    run(async () => setGrp(await api.setGroupPhoto(grp.id, await prepareAvatarImage(file), token)));
  const clearGroupPhoto = () => run(async () => setGrp(await api.setGroupPhoto(grp.id, null, token)));
  const pickMemberPhoto = (m: MemberRecord, file: File) =>
    run(async () => replaceMembers([await api.setMemberPhoto(m.id, await prepareAvatarImage(file), token)]));
  const clearMemberPhoto = (m: MemberRecord) =>
    run(async () => replaceMembers([await api.setMemberPhoto(m.id, null, token)]));

  /** Just forget the group locally — the link still works if it resurfaces. */
  function removeFromDevice() {
    forgetGroup(grp.id);
    navigate('/');
  }

  async function deleteGroup() {
    if (
      !confirm(
        `Delete "${grp.name}" for everyone?\n\n` +
          'All expenses, payments, and receipts go with it, and the link ' +
          "stops working for everybody. This can't be undone.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.deleteGroup(grp.id, token);
      forgetGroup(grp.id);
      navigate('/');
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

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
        <button class="back" onClick={() => onDone(mutated.current)}>‹</button>
        <div class="group-title">
          <h1>Group settings</h1>
        </div>
      </header>
      <div class="rhead subline">{grp.name}</div>
      <hr class="rule" />

      <div class="settings-photo">
        <PhotoInput busy={busy} onPick={pickGroupPhoto}>
          <Avatar
            initials={collectiveInitials(grp.name)}
            color="#0B7A4E"
            size={72}
            src={api.groupPhotoUrl(grp)}
          />
        </PhotoInput>
        <div class="btn-row center">
          <PhotoInput class="btn small" busy={busy} onPick={pickGroupPhoto}>
            {grp.photo ? 'Change photo' : 'Add group photo'}
          </PhotoInput>
          {grp.photo && (
            <button class="btn small" disabled={busy} onClick={clearGroupPhoto}>
              Remove
            </button>
          )}
        </div>
      </div>
      <hr class="rule" />

      <div class="field">
        <span>You are</span>
        <div class="chip-row wrap">
          {activeMembers(mems).map(m => (
            <button
              key={m.id}
              class={`chip with-avatar ${m.id === me ? 'on' : ''}`}
              onClick={() => onMeChange(m.id)}
            >
              <Avatar
                initials={personInitial(m.name)}
                color={colorForId(m.id)}
                size={24}
                src={api.memberPhotoUrl(m)}
              />
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

      <button class="btn primary big" style="margin-top:14px;" onClick={save} disabled={busy || !dirty}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>
      <hr class="rule" />

      <MemberEditor
        members={mems}
        groupId={grp.id}
        token={token}
        me={me}
        busy={busy}
        groupCurrency={groupCurrency}
        netOf={id => nets.get(id) ?? 0}
        referenced={id => memberReferenced(id, expenses, payments)}
        run={run}
        replaceMembers={replaceMembers}
        dropMember={dropMember}
        appendMember={m => setMems(ms => [...ms, m])}
        pickPhoto={pickMemberPhoto}
        clearPhoto={clearMemberPhoto}
      />
      <hr class="rule" />

      <PartyEditor members={mems} token={token} busy={busy} run={run} replaceMembers={replaceMembers} />
      <hr class="rule" />

      <SecuritySection
        group={grp}
        token={token}
        onPinChanged={pinOn => {
          mutated.current = true;
          setGrp(g => ({ ...g, pin_on: pinOn }));
        }}
        onTokenRotated={onTokenRotated}
      />
      <hr class="rule" />

      <div class="stack-sm">
        <div class="seclbl left">Leave or delete</div>
        <button class="btn" disabled={busy} onClick={removeFromDevice}>
          Remove from this device
        </button>
        <p class="hint sans left">
          Takes the group off your Home list. Nothing is deleted — opening the
          link brings it back.
        </p>
        <button class="btn danger" disabled={busy} onClick={deleteGroup}>
          Delete group for everyone
        </button>
        <p class="hint sans left">
          Erases the group with all its expenses, payments, and receipts. The
          link stops working for everybody. No undo.
        </p>
      </div>
      <hr class="rule" />

      {progress && <p class="hint">{progress}</p>}
      {error && <p class="error">{error}</p>}

      <div class="thanks">*** Thank you ***</div>
    </div>
  );
}

/** A file picker dressed as whatever it wraps — a tappable avatar or a button. */
function PhotoInput({
  class: cls,
  busy,
  onPick,
  children,
}: {
  class?: string;
  busy: boolean;
  onPick: (file: File) => void;
  children: ComponentChildren;
}) {
  return (
    <label class={cls ?? 'photo-tap'}>
      {children}
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={busy}
        onChange={e => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          input.value = '';
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

/**
 * The member roster: add people who aren't here to add themselves, rename
 * anyone (expenses point at member ids, so history follows the new name),
 * manage member photos, and remove people who've left. Removing a settled
 * member who's been in expenses keeps them on that history but drops them from
 * every picker; someone never referenced is deleted outright. Removed members
 * collect in a restore list below.
 */
function MemberEditor({
  members,
  groupId,
  token,
  me,
  busy,
  groupCurrency,
  netOf,
  referenced,
  run,
  replaceMembers,
  dropMember,
  appendMember,
  pickPhoto,
  clearPhoto,
}: {
  members: MemberRecord[];
  groupId: string;
  token: string;
  me: string;
  busy: boolean;
  groupCurrency: string;
  netOf: (id: string) => number;
  referenced: (id: string) => boolean;
  run: (action: () => Promise<void>) => void;
  replaceMembers: (updated: MemberRecord[]) => void;
  dropMember: (id: string) => void;
  appendMember: (m: MemberRecord) => void;
  pickPhoto: (m: MemberRecord, file: File) => void;
  clearPhoto: (m: MemberRecord) => void;
}) {
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<MemberRecord | null>(null);

  const active = members.filter(m => !m.removed);
  const removed = members.filter(m => m.removed);

  function add() {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    run(async () => appendMember(await api.addMember(groupId, name, token)));
  }

  function saveName(m: MemberRecord, name: string) {
    setRenaming(null);
    if (!name || name === m.name) return;
    run(async () => replaceMembers([await api.updateMember(m.id, { name }, token)]));
  }

  /** Flag a member removed and unlink them; a lone remaining party-mate is
   *  unlinked too, since a one-person party isn't one. */
  function softRemove(m: MemberRecord) {
    const updates = [
      api.updateMember(m.id, { removed: true, party: '', party_name: '', party_photo: null }, token),
    ];
    const remaining = m.party ? members.filter(o => o.party === m.party && o.id !== m.id) : [];
    if (remaining.length === 1) {
      updates.push(api.updateMember(remaining[0]!.id, { party: '', party_name: '', party_photo: null }, token));
    }
    return updates;
  }

  function remove(m: MemberRecord) {
    const net = netOf(m.id);
    if (net !== 0) {
      // A non-zero balance that's purely internal to a settled party (a couple
      // where one owes the other, but the household nets to zero) can still be
      // removed: record the settle-up between them, then take them off.
      const partyMembers = m.party ? members.filter(o => o.party === m.party) : [];
      const partyNet = partyMembers.reduce((s, o) => s + netOf(o.id), 0);
      const owed = formatMoney(Math.abs(net), groupCurrency);
      if (!(m.party && partyMembers.length >= 2 && partyNet === 0)) {
        alert(
          `${m.name} isn't settled up — ${net > 0 ? `the group owes them ${owed}` : `they owe ${owed}`}.\n\n` +
            'Square their balance to zero on the Balances tab first, then remove them.',
        );
        return;
      }
      const partyName = partyDisplayName(partyMembers);
      if (
        !confirm(
          `Within ${partyName}, ${m.name} ${net < 0 ? `owes ${owed}` : `is owed ${owed}`} — but the ` +
            `household nets to zero.\n\n` +
            `Remove ${m.name}? This records that ${owed} settle-up inside ${partyName} so it stays ` +
            `square, then drops ${m.name} from everything going forward. You can restore them later.`,
        )
      ) {
        return;
      }
      // Settle m against their party-mates: the transfers touching m zero them
      // out (the party nets to zero, so m is always fully covered internally).
      const partyNets = new Map(partyMembers.map(o => [o.id, netOf(o.id)]));
      const transfers = suggestSettlements(partyNets).filter(t => t.from === m.id || t.to === m.id);
      run(async () => {
        const date = `${new Date().toISOString().slice(0, 10)} 12:00:00.000Z`;
        for (const t of transfers) {
          await api.createPayment(
            {
              group: groupId,
              from_member: t.from,
              to_member: t.to,
              amount_cents: t.cents,
              date,
              note: `Settling up on removing from ${partyName}`,
              currency: groupCurrency,
              fx_cents: 0,
            },
            token,
          );
        }
        replaceMembers(await Promise.all(softRemove(m)));
      });
      return;
    }
    if (referenced(m.id)) {
      if (
        !confirm(
          `Remove ${m.name}?\n\n` +
            "They'll stay on the past expenses they were part of, but drop off " +
            'everything going forward — no new splits, no settle-up, no party. ' +
            'You can restore them later from the Removed list.',
        )
      ) {
        return;
      }
      // Unlink from any party at the same time — a removed member settles alone.
      run(async () => replaceMembers(await Promise.all(softRemove(m))));
    } else {
      if (
        !confirm(
          `Delete ${m.name}?\n\n` +
            "They've never been in an expense, so they'll be removed completely. This can't be undone.",
        )
      ) {
        return;
      }
      run(async () => {
        await api.deleteMember(m.id, token);
        dropMember(m.id);
      });
    }
  }

  function restore(m: MemberRecord) {
    run(async () => replaceMembers([await api.updateMember(m.id, { removed: false }, token)]));
  }

  return (
    <div class="stack-sm">
      <div class="seclbl left">Members</div>
      <p class="hint sans left">Tap the avatar for a photo, the name to rename.</p>
      {active.map(m => (
        <div key={m.id} class="party-row">
          <PhotoInput busy={busy} onPick={f => pickPhoto(m, f)}>
            <Avatar
              initials={personInitial(m.name)}
              color={colorForId(m.id)}
              size={34}
              src={api.memberPhotoUrl(m)}
            />
          </PhotoInput>
          <button class="party-name" title="Rename" onClick={() => setRenaming(m)}>
            <span>{m.name} ✏️</span>
          </button>
          {m.photo ? (
            <button class="item-remove" disabled={busy} title="Remove photo" onClick={() => clearPhoto(m)}>
              ✕
            </button>
          ) : (
            <PhotoInput class="btn small" busy={busy} onPick={f => pickPhoto(m, f)}>
              Add photo
            </PhotoInput>
          )}
          {m.id === me ? (
            <span class="hint sans" title="Switch who you are to remove yourself">
              you
            </span>
          ) : (
            <button class="btn small danger" disabled={busy} onClick={() => remove(m)}>
              Remove
            </button>
          )}
        </div>
      ))}

      {removed.length > 0 && (
        <>
          <div class="seclbl left muted">Removed · tap to restore</div>
          {removed.map(m => (
            <div key={m.id} class="party-row">
              <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={34} src={api.memberPhotoUrl(m)} />
              <span class="party-name faint">{m.name}</span>
              <button class="btn small" disabled={busy} onClick={() => restore(m)}>
                Restore
              </button>
            </div>
          ))}
          <p class="hint sans left">
            They still appear on the expenses they were part of; restoring brings
            them back to every picker.
          </p>
        </>
      )}

      <div class="inline-add">
        <input
          value={newName}
          maxLength={60}
          placeholder="Add a member"
          onInput={e => setNewName((e.target as HTMLInputElement).value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add();
          }}
        />
        <button class="btn" disabled={busy || !newName.trim()} onClick={add}>
          Add
        </button>
      </div>
      <p class="hint sans left">
        Anyone you add can pick themselves as “you” when they open the link.
      </p>

      {renaming && (
        <MemberNameSheet
          member={renaming}
          onSave={name => saveName(renaming, name)}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
}

/** Bottom sheet for renaming a member: just a text field, save/cancel. */
function MemberNameSheet({
  member,
  onSave,
  onClose,
}: {
  member: MemberRecord;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.name);
  const trimmed = name.trim();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div class="sheet-overlay" onClick={onClose}>
      <div class="sheet" onClick={e => e.stopPropagation()}>
        <h2>Rename {member.name}</h2>
        <label class="field">
          <span>Name</span>
          <input
            ref={inputRef}
            value={name}
            maxLength={60}
            onInput={e => setName((e.target as HTMLInputElement).value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && trimmed) onSave(trimmed);
            }}
          />
        </label>
        <p class="hint sans left">Their expense history keeps up — only the label changes.</p>
        <div class="btn-row">
          <button class="btn" onClick={onClose}>
            Cancel
          </button>
          <button class="btn primary" disabled={!trimmed} onClick={() => onSave(trimmed)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Link members into parties ("one wallet"). A party is just a shared key on
 * the member records; unlinking clears it (and the party's name and photo).
 */
function PartyEditor({
  members,
  token,
  busy,
  run,
  replaceMembers,
}: {
  members: MemberRecord[];
  token: string;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
  replaceMembers: (updated: MemberRecord[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<MemberRecord[] | null>(null);

  const parties = groupParties(members);
  const solo = members.filter(m => !m.party && !m.removed);

  function link() {
    if (selected.length < 2) return;
    const key = newToken().slice(0, 12);
    const ids = selected;
    setSelected([]);
    run(async () => {
      for (const id of ids) {
        replaceMembers([await api.updateMember(id, { party: key, party_name: '' }, token)]);
      }
    });
  }

  function unlink(partyMembers: MemberRecord[]) {
    run(async () => {
      for (const m of partyMembers) {
        replaceMembers([await api.updateMember(m.id, { party: '', party_name: '', party_photo: null }, token)]);
      }
    });
  }

  function saveName(partyMembers: MemberRecord[], name: string) {
    setRenaming(null);
    run(async () => {
      for (const m of partyMembers) {
        replaceMembers([await api.updateMember(m.id, { party_name: name }, token)]);
      }
    });
  }

  const pickPhoto = (partyMembers: MemberRecord[], file: File) =>
    run(async () =>
      replaceMembers(
        await api.setPartyPhoto(partyMembers.map(m => m.id), await prepareAvatarImage(file), token),
      ),
    );
  const clearPhoto = (partyMembers: MemberRecord[]) =>
    run(async () => replaceMembers(await api.setPartyPhoto(partyMembers.map(m => m.id), null, token)));

  return (
    <div class="stack-sm">
      <div class="seclbl left">Couples &amp; households</div>
      <p class="hint sans left">
        Linked members settle as one wallet — the group sees a combined
        balance; the breakdown stays visible on the Balances tab. Tap the
        avatar for a photo, the name to rename.
      </p>

      {[...parties.entries()].map(([key, pm]) => {
        const custom = pm.map(m => m.party_name).find(Boolean);
        const displayName = partyDisplayName(pm);
        const photo = api.partyPhotoUrl(pm);
        return (
          <div key={key} class="party-row">
            <PhotoInput busy={busy} onPick={f => pickPhoto(pm, f)}>
              <Avatar initials={collectiveInitials(displayName)} color={colorForId(key)} size={34} src={photo} />
            </PhotoInput>
            <button class="party-name" title="Rename" onClick={() => setRenaming(pm)}>
              <span>{displayName} ✏️</span>
              {custom && <span class="party-sub">{pm.map(m => m.name).join(' & ')}</span>}
            </button>
            {photo ? (
              <button class="item-remove" disabled={busy} title="Remove photo" onClick={() => clearPhoto(pm)}>
                ✕
              </button>
            ) : (
              <PhotoInput class="btn small" busy={busy} onPick={f => pickPhoto(pm, f)}>
                Add photo
              </PhotoInput>
            )}
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
 * Optional group PIN + recovery email (ADR-0003). With the PIN on, share
 * links carry only the group id and new people must type the PIN to get in;
 * ten wrong tries lock joining. The recovery email is where the join screen's
 * "forgot the PIN?" button sends the group's access link.
 */
function SecuritySection({
  group,
  token,
  onPinChanged,
  onTokenRotated,
}: {
  group: GroupRecord;
  token: string;
  onPinChanged: (pinOn: boolean) => void;
  onTokenRotated: (t: string) => void;
}) {
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api
      .securityInfo(group.id, token)
      .then(i => {
        setInfo(i);
        setEmail(i.recovery_email ?? '');
      })
      .catch(() => setInfo({ pin: group.pin_on }));
  }, [group.id, token]);

  const pinOn = group.pin_on;
  const pinValid = /^\d{4,6}$/.test(pin);
  const emailDirty = email.trim() !== (info?.recovery_email ?? '');

  async function apply(
    changes: { pin?: string; disable_pin?: boolean; recovery_email?: string; unlock?: boolean },
    note: string,
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.updateSecurity(group.id, token, changes);
      setInfo({
        pin: res.pin,
        locked: false,
        recovery_email: res.recovery_email,
        attempts: res.attempts,
      });
      setEmail(res.recovery_email);
      setPin('');
      setNotice(note);
      onPinChanged(res.pin);
      if (res.t !== token) onTokenRotated(res.t);
    } catch (e) {
      const r = (e as { response?: { message?: string } }).response;
      setError(r?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function enablePin() {
    if (
      !confirm(
        `Turn on the PIN for "${group.name}"?\n\n` +
          'The share link changes: links shared before now stop working, and ' +
          'everyone currently in the group will be asked for the PIN once — ' +
          'so tell them what it is.',
      )
    ) {
      return;
    }
    apply({ pin }, 'PIN is on. Invite people with the share button and tell them the PIN.');
  }

  function disablePin() {
    if (!confirm('Turn off the PIN?\n\nAnyone with the share link can join again, no PIN asked.')) return;
    apply({ disable_pin: true }, 'PIN is off — the link alone is enough to join again.');
  }

  return (
    <div class="stack-sm">
      <div class="seclbl left">PIN &amp; recovery</div>
      {!pinOn ? (
        <>
          <p class="hint sans left">
            Right now anyone with the link is in. Add a 4–6 digit PIN and new
            people must type it to join — the link alone stops being enough.
          </p>
          <div class="inline-add">
            <input
              class="pin-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="4–6 digits"
              value={pin}
              onInput={e => setPin((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
            />
            <button class="btn" disabled={busy || !pinValid} onClick={enablePin}>
              Turn on PIN
            </button>
          </div>
        </>
      ) : (
        <>
          <p class="hint sans left">
            PIN is on — new people need it to join. Ten wrong tries lock
            joining until someone here unlocks it or changes the PIN.
          </p>
          {info?.locked && (
            <>
              <p class="error left">Joining is locked — too many wrong PIN attempts.</p>
              <button class="btn" disabled={busy} onClick={() => apply({ unlock: true }, 'Joining unlocked.')}>
                Unlock joining
              </button>
            </>
          )}
          <div class="inline-add">
            <input
              class="pin-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="New PIN"
              value={pin}
              onInput={e => setPin((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
            />
            <button
              class="btn"
              disabled={busy || !pinValid}
              onClick={() => apply({ pin }, 'PIN changed — tell the group.')}
            >
              Change PIN
            </button>
          </div>
          <button class="btn" disabled={busy} onClick={disablePin}>
            Turn off the PIN
          </button>

          <label class="field" style="margin-top:10px;">
            <span>Recovery email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onInput={e => setEmail((e.target as HTMLInputElement).value)}
            />
          </label>
          <button
            class="btn"
            disabled={busy || !emailDirty}
            onClick={() =>
              apply(
                { recovery_email: email.trim() },
                email.trim() ? 'Recovery email saved.' : 'Recovery email removed.',
              )
            }
          >
            Save recovery email
          </button>
          <p class="hint sans left">
            If the PIN is forgotten or joining gets locked, the join screen can
            email an access link to this address. Leave empty for none.
          </p>
        </>
      )}
      {notice && <p class="hint sans left">{notice}</p>}
      {error && <p class="error">{error}</p>}
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div class="sheet-overlay" onClick={onClose}>
      <div class="sheet" onClick={e => e.stopPropagation()}>
        <h2>Name your crew</h2>
        <label class="field">
          <span>Party name</span>
          <input
            ref={inputRef}
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
