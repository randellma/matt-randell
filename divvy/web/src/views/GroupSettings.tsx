import { useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { api } from '../app';
import type { GroupRecord, MemberRecord } from '../api';
import { convertMinor } from '../lib/currency';
import { fetchRate } from '../lib/fx';
import { prepareAvatarImage } from '../image';
import { colorForId, collectiveInitials, personInitial } from '../lib/avatar';
import { groupParties, partyDisplayName } from '../lib/party';
import { newToken } from '../identity';
import { Avatar } from '../components/Avatar';
import { CurrencySelect } from '../components/CurrencySelect';

interface Props {
  group: GroupRecord;
  token: string;
  members: MemberRecord[];
  me: string;
  /** the user tapped a different member as "you" — local identity only */
  onMeChange: (memberId: string) => void;
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
export function GroupSettings({ group, token, members, me, onMeChange, onDone }: Props) {
  // Local copies so photo/party edits show up without leaving the page; the
  // caller reloads on the way out whenever anything was mutated.
  const [grp, setGrp] = useState(group);
  const [mems, setMems] = useState(members);
  const mutated = useRef(false);

  const oldCurrency = group.currency || 'USD';
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

  const pickGroupPhoto = (file: File) =>
    run(async () => setGrp(await api.setGroupPhoto(grp.id, await prepareAvatarImage(file), token)));
  const clearGroupPhoto = () => run(async () => setGrp(await api.setGroupPhoto(grp.id, null, token)));
  const pickMemberPhoto = (m: MemberRecord, file: File) =>
    run(async () => replaceMembers([await api.setMemberPhoto(m.id, await prepareAvatarImage(file), token)]));
  const clearMemberPhoto = (m: MemberRecord) =>
    run(async () => replaceMembers([await api.setMemberPhoto(m.id, null, token)]));

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
          {mems.map(m => (
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

      <div class="stack-sm">
        <div class="seclbl left">Member photos</div>
        <p class="hint sans left">Tap an avatar to add or change a photo.</p>
        {mems.map(m => (
          <div key={m.id} class="party-row">
            <PhotoInput busy={busy} onPick={f => pickMemberPhoto(m, f)}>
              <Avatar
                initials={personInitial(m.name)}
                color={colorForId(m.id)}
                size={34}
                src={api.memberPhotoUrl(m)}
              />
            </PhotoInput>
            <span class="row-name">{m.name}</span>
            {m.photo ? (
              <button class="item-remove" disabled={busy} title="Remove photo" onClick={() => clearMemberPhoto(m)}>
                ✕
              </button>
            ) : (
              <PhotoInput class="btn small" busy={busy} onPick={f => pickMemberPhoto(m, f)}>
                Add photo
              </PhotoInput>
            )}
          </div>
        ))}
      </div>
      <hr class="rule" />

      <PartyEditor members={mems} token={token} busy={busy} run={run} replaceMembers={replaceMembers} />
      <hr class="rule" />

      {progress && <p class="hint">{progress}</p>}
      {error && <p class="error">{error}</p>}

      <div class="barcode" />
      <div class="barnum">DIVVY · SETTINGS</div>
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
  const solo = members.filter(m => !m.party);

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
