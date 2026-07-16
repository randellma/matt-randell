import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api, navigate } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PaymentRecord, ScanAllowance, SecurityInfo, SponsorshipRecord } from '../api';
import { convertMinor, formatMoney } from '../lib/currency';
import { fetchRate } from '../lib/fx';
import { computeNets, expenseForBalance, paymentGroupCents, suggestSettlements } from '../lib/balances';
import { activeMembers, memberReferenced } from '../lib/member';
import { prepareAvatarImage } from '../image';
import { colorForId, collectiveInitials, GROUP_AVATAR_COLOR, personInitial } from '../lib/avatar';
import { groupParties, partyDisplayName } from '../lib/party';
import { forgetGroup, newToken } from '../identity';
import { Avatar } from '../components/Avatar';
import { CurrencySelect } from '../components/CurrencySelect';
import { PhotoInput } from '../components/PhotoInput';
import { CreditsSheet } from '../components/CreditsSheet';
import { useUser } from '../account';
import { useAlert, useConfirm } from '../components/ConfirmDialog';

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
 * Group settings, split across two tabs behind a segmented control:
 *
 * - **Group** — identity (photo + name), currencies, receipt-scan coverage,
 *   the join PIN, and leave/delete.
 * - **People** — who "you" are on this device, the member roster, and couples
 *   & households.
 *
 * Everything auto-saves the moment it changes — there is no Save button — and
 * a brief "✓ Saved" badge in the header confirms each write. Changing the
 * group currency still rewrites every expense's and payment's stored
 * conversion at its own date: amounts stay in their original currencies; only
 * the group-level view moves.
 */
export function GroupSettings({ group, token, members, expenses, payments, me, onMeChange, onTokenRotated, onDone }: Props) {
  // Local copies so edits show up without leaving the page; the caller reloads
  // on the way out whenever anything was mutated.
  const [grp, setGrp] = useState(group);
  const [mems, setMems] = useState(members);
  const mutated = useRef(false);
  const confirm = useConfirm();

  const [tab, setTab] = useState<'group' | 'people'>('group');
  // The "✓ Saved" badge: flashSaved() shows it, then fades it after ~1.5s. A
  // ref holds the pending timer so back-to-back saves keep it up cleanly.
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();
  const flashSaved = useCallback(() => {
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }, []);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const groupCurrency = grp.currency || 'USD';

  // Net position per member, so removal can be gated to settled members. Reads
  // the expenses/payments as loaded — settling in Balances reloads the group,
  // so this reflects the latest ledger whenever settings is opened.
  const nets = computeNets(
    expenses.map(e => expenseForBalance(e, groupCurrency)),
    payments.map(p => ({ from: p.from_member, to: p.to_member, cents: paymentGroupCents(p, groupCurrency) })),
  );
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const nameTimer = useRef<ReturnType<typeof setTimeout>>();

  /** Immediate mutations (photos, members, parties) — flash "✓ Saved" on success. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      mutated.current = true;
      flashSaved();
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

  /** Persist a plain group field (name / expense_currency) and confirm it saved. */
  async function saveGroup(patch: Partial<Pick<GroupRecord, 'name' | 'expense_currency'>>) {
    setBusy(true);
    setError('');
    try {
      setGrp(await api.updateGroup(grp.id, patch, token));
      mutated.current = true;
      flashSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Commit the group name once the user pauses typing or leaves the field. */
  function commitName(value: string) {
    clearTimeout(nameTimer.current);
    const trimmed = value.trim();
    if (!trimmed) return setError('Give the group a name');
    if (trimmed === grp.name) return;
    saveGroup({ name: trimmed });
  }
  function onNameInput(value: string) {
    setName(value);
    setError('');
    clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => commitName(value), 700);
  }

  /** Change the default currency for new expenses — a cheap patch, saved at once. */
  function changeExpenseCurrency(next: string) {
    // '' means "same as group" — don't store a redundant copy.
    saveGroup({ expense_currency: next === groupCurrency ? '' : next });
  }

  /**
   * Switch the group's reporting currency. Confirms first (it rewrites every
   * record's conversion), then updates the group and reconverts the ledger.
   */
  async function changeGroupCurrency(next: string) {
    const from = groupCurrency;
    if (next === from) return;
    setError('');
    if (
      !(await confirm({
        title: `Report balances in ${next} instead of ${from}?`,
        message:
          'Every expense keeps its original currency — converted amounts are ' +
          'refreshed using each expense’s date.',
        confirmLabel: 'Change currency',
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      const updated = await api.updateGroup(
        grp.id,
        // A default equal to the new group currency is redundant — clear it.
        { currency: next, expense_currency: grp.expense_currency === next ? '' : grp.expense_currency },
        token,
      );
      const failures = await reconvert(from, next);
      setGrp(updated);
      mutated.current = true;
      if (failures.length > 0) {
        setBusy(false);
        setProgress('');
        setError(
          `No rate found for: ${failures.join(', ')}. Those were converted 1:1 — ` +
            'open each one and set its converted amount by hand.',
        );
        return;
      }
      flashSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  /**
   * Rewrite currency/fx on every expense and payment for a new group
   * currency. Records with an empty currency were implicitly in the old group
   * currency — they get it stamped on explicitly so history stays truthful.
   */
  async function reconvert(oldCurrency: string, newCurrency: string): Promise<string[]> {
    const [expenses, payments] = await Promise.all([
      api.listExpenses(grp.id, token),
      api.listPayments(grp.id, token),
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

  /** Just forget the group locally — the link still works if it resurfaces. */
  function removeFromDevice() {
    forgetGroup(grp.id);
    navigate('/');
  }

  async function deleteGroup() {
    if (
      !(await confirm({
        title: `Delete “${grp.name}” for everyone?`,
        message:
          'All expenses, payments, and receipts go with it, and the link ' +
          'stops working for everybody. This can’t be undone.',
        confirmLabel: 'Delete',
        danger: true,
      }))
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

  return (
    <div class="page">
      <header class="group-header">
        <button class="back" onClick={() => onDone(mutated.current)}>‹</button>
        <div class="group-title">
          <h1>Settings</h1>
          <div class="subline settings-sub">{grp.name}</div>
        </div>
        {saved && <span class="saved-tag">✓ Saved</span>}
      </header>

      <nav class="tabs settings-tabs">
        <button class={tab === 'group' ? 'on' : ''} onClick={() => setTab('group')}>
          Group
        </button>
        <button class={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>
          People
        </button>
      </nav>

      {tab === 'group' ? (
        <div class="stack">
          <div>
            <div class="settings-identity">
              <PhotoInput busy={busy} onPick={pickGroupPhoto}>
                <Avatar
                  initials={collectiveInitials(name.trim() || grp.name)}
                  color={GROUP_AVATAR_COLOR}
                  size={64}
                  src={api.groupPhotoUrl(grp)}
                />
              </PhotoInput>
              <label class="field grow">
                <span>Group name</span>
                <input
                  value={name}
                  onInput={e => onNameInput((e.target as HTMLInputElement).value)}
                  onBlur={e => commitName((e.target as HTMLInputElement).value)}
                />
              </label>
            </div>
            <p class="hint sans left" style="margin-top:8px;">
              Tap the photo to change it. Name &amp; photo show for everyone in the group.
            </p>
            {grp.photo && (
              <button class="btn small" style="margin-top:8px;" disabled={busy} onClick={clearGroupPhoto}>
                Remove photo
              </button>
            )}
          </div>
          <hr class="rule" />

          <div class="stack-sm">
            <div class="seclbl left">Currency</div>
            <label class="field">
              <span>Group currency</span>
              <CurrencySelect value={groupCurrency} onChange={changeGroupCurrency} />
            </label>
            <label class="field">
              <span>New expenses default to</span>
              <CurrencySelect
                value={grp.expense_currency || ''}
                onChange={changeExpenseCurrency}
                emptyLabel={`Same as group (${groupCurrency})`}
              />
            </label>
            <p class="hint sans left">
              Balances, settle-up &amp; totals report in your group currency. Log any
              expense in another currency as you add it.
            </p>
            {progress && <p class="hint">{progress}</p>}
          </div>
          <hr class="rule" />

          <ScanCreditsSection groupId={grp.id} token={token} onSaved={flashSaved} />
          <hr class="rule" />

          <SecuritySection
            group={grp}
            token={token}
            onPinChanged={pinOn => {
              mutated.current = true;
              setGrp(g => ({ ...g, pin_on: pinOn }));
              flashSaved();
            }}
            onTokenRotated={onTokenRotated}
          />
          <hr class="rule" />

          <div class="stack-sm">
            <div class="seclbl left muted">Leave or delete</div>
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
        </div>
      ) : (
        <div class="stack">
          <div class="stack-sm">
            <div class="seclbl left">You on this device</div>
            <p class="hint sans left">
              Pick who you are so “paid by” defaults to you — switch any time.
            </p>
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
          </div>
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
        </div>
      )}

      {error && <p class="error">{error}</p>}

      <div class="thanks">*** Thank you ***</div>
    </div>
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
  const confirm = useConfirm();
  const alert = useAlert();

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

  async function remove(m: MemberRecord) {
    const net = netOf(m.id);
    if (net !== 0) {
      // A non-zero balance that's purely internal to a settled party (a couple
      // where one owes the other, but the household nets to zero) can still be
      // removed: record the settle-up between them, then take them off.
      const partyMembers = m.party ? members.filter(o => o.party === m.party) : [];
      const partyNet = partyMembers.reduce((s, o) => s + netOf(o.id), 0);
      const owed = formatMoney(Math.abs(net), groupCurrency);
      if (!(m.party && partyMembers.length >= 2 && partyNet === 0)) {
        await alert({
          title: `${m.name} isn’t settled up`,
          message:
            `${net > 0 ? `The group owes them ${owed}` : `They owe ${owed}`}.\n\n` +
            'Square their balance to zero on the Balances tab first, then remove them.',
        });
        return;
      }
      const partyName = partyDisplayName(partyMembers);
      if (
        !(await confirm({
          title: `Remove ${m.name}?`,
          message:
            `Within ${partyName}, ${m.name} ${net < 0 ? `owes ${owed}` : `is owed ${owed}`} — but the ` +
            `household nets to zero.\n\n` +
            `This records that ${owed} settle-up inside ${partyName} so it stays square, then drops ` +
            `${m.name} from everything going forward. You can restore them later.`,
          confirmLabel: 'Remove',
          danger: true,
        }))
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
        !(await confirm({
          title: `Remove ${m.name}?`,
          message:
            'They’ll stay on the past expenses they were part of, but drop off ' +
            'everything going forward — no new splits, no settle-up, no party. ' +
            'You can restore them later from the Removed list.',
          confirmLabel: 'Remove',
          danger: true,
        }))
      ) {
        return;
      }
      // Unlink from any party at the same time — a removed member settles alone.
      run(async () => replaceMembers(await Promise.all(softRemove(m))));
    } else {
      if (
        !(await confirm({
          title: `Delete ${m.name}?`,
          message:
            'They’ve never been in an expense, so they’ll be removed completely. This can’t be undone.',
          confirmLabel: 'Delete',
          danger: true,
        }))
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
 * Receipt scans for this group (ADR-0004). Shows whose credits currently
 * cover scans here, lets the signed-in account start/stop covering the group
 * from its own balance, and opens the Slate Plus sheet to sign in or top up.
 */
function ScanCreditsSection({ groupId, token, onSaved }: { groupId: string; token: string; onSaved: () => void }) {
  const user = useUser();
  const [allowance, setAllowance] = useState<ScanAllowance | null>(null);
  /** my sponsorship row for this group, if I'm covering it */
  const [mine, setMine] = useState<SponsorshipRecord | null>(null);
  const [busy, setBusy] = useState(false);
  /** null = closed; otherwise why the Slate Plus sheet is up */
  const [plusReason, setPlusReason] = useState<'account' | 'cover' | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      // Balance may have moved since the last authStore refresh (scans spend
      // credits without touching it) — the button label reads user.credits.
      api.refreshUser();
      const [a, rows] = await Promise.all([
        api.scanAllowance(groupId, token),
        api.listSponsorships(groupId, token),
      ]);
      setAllowance(a);
      setMine(user ? (rows.find(r => r.user === user.id) ?? null) : null);
    } catch {
      /* section renders without the coverage line — the buttons still work */
    }
  }, [groupId, token, user?.id]);
  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleCover() {
    if (!user) {
      setPlusReason('cover');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mine) await api.unsponsorGroup(mine.id, token);
      else await api.sponsorGroup(groupId, token);
      await reload();
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Card headline + sub adapt to who (if anyone) is covering scans here.
  const sponsorNames = allowance?.sponsors.map(s => s.name).join(', ');
  const title = mine
    ? 'You’re covering this group'
    : sponsorNames
      ? `Covered by ${sponsorNames}`
      : 'Scans use each scanner’s own credits';
  const sub = mine
    ? `${user?.credits ?? 0} scans left · anyone here can scan`
    : allowance && allowance.sponsors.length > 0
      ? 'Anyone in the group can scan on their credits'
      : 'Cover the group so everyone here can scan on yours';

  return (
    <div class="stack-sm">
      <div class="seclbl left">Receipt scans</div>
      <div class="scan-cover-card">
        <div class="scan-cover-head">
          <span class="scan-cover-icon">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
          <span class="scan-cover-text">
            <b>{title}</b>
            <span class="scan-cover-sub">{sub}</span>
          </span>
        </div>
        <div class="scan-cover-actions">
          <button class="scan-cover-btn primary" onClick={() => setPlusReason('account')}>
            {user ? 'Top up' : 'Get scans'}
          </button>
          <button class="scan-cover-btn" disabled={busy} onClick={toggleCover}>
            {mine ? 'Stop covering' : user ? 'Cover this group' : 'Sign in to cover'}
          </button>
        </div>
      </div>
      {error && <p class="error">{error}</p>}
      <CreditsSheet
        open={plusReason !== null}
        reason={plusReason ?? 'account'}
        onClose={() => setPlusReason(null)}
        onChanged={reload}
      />
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
  // With the PIN off, flipping the toggle "arms" it — revealing the digit
  // field to set a code before the turn-on confirm fires.
  const [arming, setArming] = useState(false);
  const confirm = useConfirm();

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

  async function enablePin() {
    if (
      !(await confirm({
        title: `Turn on the PIN for “${group.name}”?`,
        message:
          'The share link changes: links shared before now stop working, and ' +
          'everyone currently in the group will be asked for the PIN once — ' +
          'so tell them what it is.',
        confirmLabel: 'Turn on PIN',
      }))
    ) {
      return;
    }
    await apply({ pin }, 'PIN is on. Invite people with the share button and tell them the PIN.');
    setArming(false);
  }

  async function disablePin() {
    if (
      !(await confirm({
        title: 'Turn off the PIN?',
        message: 'Anyone with the share link can join again, no PIN asked.',
        confirmLabel: 'Turn off PIN',
        danger: true,
      }))
    )
      return;
    apply({ disable_pin: true }, 'PIN is off — the link alone is enough to join again.');
  }

  return (
    <div class="stack-sm">
      <div class="seclbl left">Group PIN</div>
      <div class="toggle-row">
        <div class="toggle-row-text">
          <div class="toggle-row-title">Require a PIN to join</div>
          <p class="hint sans left">
            {pinOn
              ? 'PIN is on — new people need it to join. Ten wrong tries lock joining until someone here unlocks it or changes the PIN.'
              : 'Anyone with the link is in right now. Add a 4–6 digit PIN and new people must enter it to join.'}
          </p>
        </div>
        <button
          class={`toggle ${pinOn ? 'on' : ''}`}
          role="switch"
          aria-checked={pinOn}
          aria-label="Require a PIN to join"
          disabled={busy}
          onClick={() => {
            if (pinOn) disablePin();
            else setArming(a => !a);
          }}
        >
          <span class="toggle-knob" />
        </button>
      </div>

      {!pinOn && arming && (
        <div class="inline-add pin-reveal">
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
            Turn on
          </button>
        </div>
      )}

      {pinOn && (
        <div class="stack-sm pin-reveal">
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

          <label class="field">
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
        </div>
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
