import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, PayerEntry, SplitData } from '../api';
import { allocate, allocateEven, formatCents, parseAmount } from '../lib/money';
import { groupParties, partyDisplayName } from '../lib/party';
import { computeEven, computePercent, computeShares, type SplitEntry, type SplitMode } from '../lib/split';
import { computeItemized, type AssignedItem } from '../lib/receipt';
import { prepareReceiptImage } from '../image';
import { colorForId, personInitial } from '../lib/avatar';
import { Avatar } from '../components/Avatar';

interface Props {
  group: GroupRecord;
  token: string;
  members: MemberRecord[];
  me: string;
  expense?: ExpenseRecord;
  onDone: () => void;
}

const MODES: { id: SplitMode; label: string }[] = [
  { id: 'even', label: 'Evenly' },
  { id: 'percent', label: 'Percent' },
  { id: 'shares', label: 'Shares' },
  { id: 'items', label: 'Receipt' },
];

export function ExpenseForm({ group, token, members, me, expense, onDone }: Props) {
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amountText, setAmountText] = useState(
    expense ? (expense.amount_cents / 100).toFixed(2) : '',
  );
  const [payerIds, setPayerIds] = useState<string[]>(
    expense?.payers?.length ? expense.payers.map(p => p.member) : [expense?.paid_by ?? me],
  );
  // Per-payer amount text, shown only with 2+ payers. Follows an even split of
  // the total until someone hand-edits a value.
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (expense?.payers && expense.payers.length > 1) {
      for (const p of expense.payers) init[p.member] = (p.cents / 100).toFixed(2);
    }
    return init;
  });
  const [payersEdited, setPayersEdited] = useState(
    !!expense?.payers && expense.payers.length > 1,
  );
  const [date, setDate] = useState(
    expense?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [mode, setMode] = useState<SplitMode>(expense?.split_mode ?? 'even');
  const [participants, setParticipants] = useState<string[]>(
    expense?.split.mode === 'even'
      ? expense.split.entries.map(e => e.member)
      : members.map(m => m.id),
  );
  const [percents, setPercents] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (expense?.split.percents) {
      for (const [k, v] of Object.entries(expense.split.percents)) init[k] = String(v);
    } else {
      const even = allocate(100, members.map(() => 1));
      members.forEach((m, i) => { init[m.id] = String(even[i]); });
    }
    return init;
  });
  const [shares, setShares] = useState<Record<string, number>>(
    expense?.split.shares ?? Object.fromEntries(members.map(m => [m.id, 1])),
  );
  const [items, setItems] = useState<AssignedItem[]>(expense?.split.items ?? []);
  const [receiptId, setReceiptId] = useState(expense?.receipt ?? '');
  const [scanState, setScanState] = useState<'idle' | 'working'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amountCents = parseAmount(amountText);

  // Keep multi-payer amounts pinned to an even split of the total until edited.
  useEffect(() => {
    if (payersEdited || payerIds.length < 2 || amountCents === null || amountCents <= 0) return;
    const cents = allocateEven(amountCents, payerIds.length);
    setPayerAmounts(Object.fromEntries(payerIds.map((id, i) => [id, (cents[i]! / 100).toFixed(2)])));
  }, [payersEdited, payerIds, amountCents]);

  function togglePayers(ids: string[]) {
    setPayerIds(ids);
    setPayersEdited(false);
  }

  function stepPercent(id: string, delta: number) {
    const current = parseFloat(percents[id] ?? '') || 0;
    // If we're not already on a multiple of 5 (e.g. a fresh even split like 33/33/34),
    // the first tap snaps to the nearest multiple of 5 in the direction pressed;
    // every tap after that just moves by 5.
    const onGrid = current % 5 === 0;
    const snapped = delta > 0 ? Math.ceil(current / 5) * 5 : Math.floor(current / 5) * 5;
    const next = Math.min(100, Math.max(0, onGrid ? current + delta : snapped));
    setPercents({ ...percents, [id]: String(next) });
  }

  // Drop someone from the percent split entirely, then re-split 100% evenly
  // across whoever's left (so you're not left with an under/over 100% mess to
  // clean up by hand) — small manual tweaks from there are still expected.
  function removeFromPercent(id: string) {
    if ((parseFloat(percents[id] ?? '') || 0) <= 0) return;
    const remaining = members.filter(m => m.id !== id && (parseFloat(percents[m.id] ?? '') || 0) > 0);
    const shares = allocate(100, remaining.map(() => 1));
    const next: Record<string, string> = { ...percents, [id]: '0' };
    remaining.forEach((m, i) => { next[m.id] = String(shares[i]); });
    setPercents(next);
  }

  // Bring someone back into the percent split, re-splitting 100% evenly
  // across them plus whoever was already in.
  function addBackToPercent(id: string) {
    const activeIds = [
      ...members.filter(m => m.id !== id && (parseFloat(percents[m.id] ?? '') || 0) > 0).map(m => m.id),
      id,
    ];
    const shares = allocate(100, activeIds.map(() => 1));
    const next = { ...percents };
    activeIds.forEach((mid, i) => { next[mid] = String(shares[i]); });
    setPercents(next);
  }

  // Undo any removals/manual tweaks — back to an even split across everyone.
  function resetPercents() {
    const even = allocate(100, members.map(() => 1));
    const next: Record<string, string> = {};
    members.forEach((m, i) => { next[m.id] = String(even[i]); });
    setPercents(next);
  }

  function editPayerAmount(id: string, text: string) {
    setPayersEdited(true);
    const next = { ...payerAmounts, [id]: text };
    // With exactly two payers, the other side auto-balances to the total.
    if (payerIds.length === 2 && amountCents !== null) {
      const cents = parseAmount(text);
      const other = payerIds.find(p => p !== id)!;
      if (cents !== null && cents <= amountCents) {
        next[other] = ((amountCents - cents) / 100).toFixed(2);
      }
    }
    setPayerAmounts(next);
  }

  // Live preview of what each member will owe, or a reason why we can't compute it.
  const preview = useMemo<{ entries?: SplitEntry[]; problem?: string }>(() => {
    if (amountCents === null || amountCents <= 0) return { problem: 'Enter an amount' };
    try {
      switch (mode) {
        case 'even': {
          if (participants.length === 0) return { problem: 'Pick who was involved' };
          return { entries: computeEven(amountCents, participants) };
        }
        case 'percent': {
          const parts = members
            .map(m => ({ member: m.id, percent: parseFloat(percents[m.id] ?? '') || 0 }))
            .filter(p => p.percent > 0);
          if (parts.length === 0) return { problem: 'Enter percentages' };
          return { entries: computePercent(amountCents, parts) };
        }
        case 'shares': {
          const parts = members
            .map(m => ({ member: m.id, shares: shares[m.id] ?? 0 }))
            .filter(p => p.shares > 0);
          if (parts.length === 0) return { problem: 'Give someone at least one share' };
          return { entries: computeShares(amountCents, parts) };
        }
        case 'items': {
          if (items.length === 0) return { problem: 'Scan a receipt or add items' };
          return { entries: computeItemized(items, amountCents) };
        }
      }
    } catch (e) {
      return { problem: e instanceof Error ? e.message : String(e) };
    }
  }, [amountCents, mode, participants, percents, shares, items, members]);

  // Percent mode's "who owes what" stays visible even while the percentages
  // don't add to 100 — it just shows what each literal percentage works out
  // to (so the totals visibly won't add up until it's fixed), rather than
  // vanishing behind the "needs 100%" message like `preview` would.
  const percentDisplayEntries = useMemo<SplitEntry[] | null>(() => {
    if (mode !== 'percent' || amountCents === null || amountCents <= 0) return null;
    const parts = members
      .map(m => ({ member: m.id, percent: parseFloat(percents[m.id] ?? '') || 0 }))
      .filter(p => p.percent > 0);
    if (parts.length === 0) return null;
    return parts.map(p => ({ member: p.member, cents: Math.round((amountCents * p.percent) / 100) }));
  }, [mode, amountCents, percents, members]);

  const owesEntries = mode === 'percent' ? percentDisplayEntries : (preview.entries ?? null);

  async function scanReceipt(file: File) {
    setScanState('working');
    setError('');
    try {
      const image = await prepareReceiptImage(file);
      const created = await api.uploadReceipt(group.id, image, token);
      const receipt = await api.waitForReceipt(created.id, token);
      if (receipt.status === 'failed' || !receipt.parsed) {
        throw new Error(receipt.error || 'Receipt parsing failed');
      }
      const parsed = receipt.parsed;
      setItems(parsed.items.map(i => ({ label: i.label, cents: i.cents, assignees: [] })));
      setReceiptId(receipt.id);
      const itemSum = parsed.items.reduce((a, i) => a + i.cents, 0);
      const total = parsed.total_cents ?? itemSum + (parsed.tax_cents ?? 0) + (parsed.tip_cents ?? 0);
      setAmountText((total / 100).toFixed(2));
      if (!description && parsed.merchant) setDescription(parsed.merchant);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanState('idle');
    }
  }

  async function save() {
    setError('');
    if (!description.trim()) return setError('Add a description');
    if (amountCents === null || amountCents <= 0) return setError('Enter a valid amount');
    if (!preview.entries) return setError(preview.problem ?? 'Split is incomplete');

    let payers: PayerEntry[];
    if (payerIds.length === 0) return setError('Pick who paid');
    if (payerIds.length === 1) {
      payers = [{ member: payerIds[0]!, cents: amountCents }];
    } else {
      const entries = payerIds.map(id => ({ member: id, cents: parseAmount(payerAmounts[id] ?? '') }));
      if (entries.some(p => p.cents === null)) return setError('Enter what each payer paid');
      const sum = entries.reduce((a, p) => a + p.cents!, 0);
      if (sum !== amountCents) {
        return setError(
          `Payer amounts add up to ${formatCents(sum)}, but the expense is ${formatCents(amountCents)}`,
        );
      }
      payers = entries.filter(p => p.cents! > 0).map(p => ({ member: p.member, cents: p.cents! }));
    }
    const paidBy = payers.reduce((a, b) => (b.cents > a.cents ? b : a)).member;

    const split: SplitData = { mode, entries: preview.entries };
    if (mode === 'percent') {
      split.percents = Object.fromEntries(
        members
          .map(m => [m.id, parseFloat(percents[m.id] ?? '') || 0] as const)
          .filter(([, v]) => v > 0),
      );
    }
    if (mode === 'shares') {
      split.shares = Object.fromEntries(
        Object.entries(shares).filter(([, v]) => v > 0),
      );
    }
    if (mode === 'items') split.items = items;

    setBusy(true);
    try {
      await api.saveExpense(
        {
          group: group.id,
          description: description.trim(),
          amount_cents: amountCents,
          paid_by: paidBy,
          payers,
          date: `${date} 12:00:00.000Z`,
          split_mode: mode,
          split,
          receipt: receiptId,
          notes: expense?.notes ?? '',
        },
        token,
        expense?.id,
      );
      onDone();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!expense) return;
    if (!confirm(`Delete "${expense.description}"?`)) return;
    setBusy(true);
    try {
      await api.deleteExpense(expense.id, token);
      onDone();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  const memberById = new Map(members.map(m => [m.id, m]));

  return (
    <div class="page">
      <header class="group-header">
        <button class="back" onClick={onDone}>‹</button>
        <div class="group-title">
          <h1>{expense ? 'Edit expense' : 'Add expense'}</h1>
        </div>
        {expense && (
          <button class="btn small danger" onClick={remove} disabled={busy}>
            Delete
          </button>
        )}
      </header>
      <div class="rhead subline">{expense ? 'Editing a line for' : 'New line for'} {group.name}</div>
      <hr class="rule" />

      <div>
        <label class="field">
          <span>Description</span>
          <input
            value={description}
            placeholder="Dinner at Rosa's"
            onInput={e => setDescription((e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="field-row" style="margin-top:13px;">
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
            <span>Date</span>
            <input
              type="date"
              value={date}
              onInput={e => setDate((e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        <div class="field" style="margin-top:14px;">
          <span>Paid by</span>
          <MemberChips members={members} selected={payerIds} onChange={togglePayers} />
        </div>
        {payerIds.length > 1 && (
          <div class="split-rows" style="margin-top:11px;">
            {payerIds.map(id => (
              <div key={id} class="split-row">
                <span class="split-name">{memberById.get(id)?.name ?? '?'}</span>
                <span class="payer-input">
                  $
                  <input
                    inputMode="decimal"
                    value={payerAmounts[id] ?? ''}
                    placeholder="0.00"
                    onInput={e => editPayerAmount(id, (e.target as HTMLInputElement).value)}
                  />
                </span>
              </div>
            ))}
            <PayerSum payerIds={payerIds} payerAmounts={payerAmounts} amountCents={amountCents} />
          </div>
        )}
      </div>
      <hr class="rule" />

      <div>
        <label class="field">
          <span>Split method</span>
        </label>
        <div class="mode-tabs" style="margin-top:2px;">
          {MODES.map(m => (
            <button key={m.id} class={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'even' && (
          <div style="margin-top:13px;">
            <p class="hint sans" style="margin:0 0 11px;text-align:left;">Tap who was in on this one.</p>
            <MemberChips members={members} selected={participants} onChange={setParticipants} />
          </div>
        )}

        {mode === 'percent' && (() => {
          const inSplit = members.filter(m => (parseFloat(percents[m.id] ?? '') || 0) > 0);
          const removed = members.filter(m => (parseFloat(percents[m.id] ?? '') || 0) <= 0);
          return (
            <div class="split-rows" style="margin-top:13px;">
              {inSplit.map(m => (
                <div key={m.id} class="split-row">
                  <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={28} />
                  <span class="split-name">{m.name}</span>
                  <span class="stepper">
                    <button onClick={() => stepPercent(m.id, -5)}>−</button>
                    <span class="pct-input">
                      <input
                        inputMode="decimal"
                        value={percents[m.id] ?? ''}
                        placeholder="0"
                        onInput={e =>
                          setPercents({ ...percents, [m.id]: (e.target as HTMLInputElement).value })
                        }
                      />
                      %
                    </span>
                    <button onClick={() => stepPercent(m.id, 5)}>+</button>
                  </span>
                  <button class="pct-remove" title={`Remove ${m.name}`} onClick={() => removeFromPercent(m.id)}>
                    ×
                  </button>
                </div>
              ))}
              <PercentSum percents={percents} members={members} />

              {removed.length > 0 && (
                <>
                  <div class="seclbl left muted">Removed · tap to add back</div>
                  <div class="chip-row wrap">
                    {removed.map(m => (
                      <button key={m.id} class="chip ghost with-avatar" onClick={() => addBackToPercent(m.id)}>
                        <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={24} />
                        {m.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button class="btn" onClick={resetPercents}>↺ Reset to equal split</button>
            </div>
          );
        })()}

        {mode === 'shares' && (
          <div class="split-rows" style="margin-top:13px;">
            {members.map(m => (
              <div key={m.id} class="split-row">
                <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={28} />
                <span class="split-name">{m.name}</span>
                <span class="stepper">
                  <button onClick={() => setShares({ ...shares, [m.id]: Math.max(0, (shares[m.id] ?? 0) - 1) })}>
                    −
                  </button>
                  <b>{shares[m.id] ?? 0}</b>
                  <button onClick={() => setShares({ ...shares, [m.id]: (shares[m.id] ?? 0) + 1 })}>
                    +
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {mode === 'items' && (
          <div style="margin-top:13px;">
            <ItemEditor
              items={items}
              setItems={setItems}
              members={members}
              amountCents={amountCents}
              scanState={scanState}
              onScan={scanReceipt}
            />
          </div>
        )}
      </div>
      <hr class="rule" />

      <div>
        <div class="seclbl left">Who owes what</div>
        {owesEntries ? (
          <ul class="preview-list" style="margin-top:11px;">
            {(() => {
              const entries = owesEntries!;
              const maxCents = Math.max(1, ...entries.map(e => e.cents));
              return entries.map(e => (
                <li key={e.member}>
                  <Avatar initials={personInitial(memberById.get(e.member)?.name ?? '?')} color={colorForId(e.member)} size={28} />
                  <span class="preview-name">{memberById.get(e.member)?.name ?? '?'}</span>
                  <span class="preview-bar-track">
                    <span class="preview-bar-fill" style={{ width: `${Math.round((e.cents / maxCents) * 100)}%` }} />
                  </span>
                  <b class="num">{formatCents(e.cents)}</b>
                </li>
              ));
            })()}
          </ul>
        ) : (
          <p class="hint" style="margin-top:11px;">{preview.problem}</p>
        )}
      </div>
      <hr class="rule solid" />

      {error && <p class="error">{error}</p>}

      <button class="btn primary big" onClick={save} disabled={busy || scanState === 'working'}>
        {busy
          ? 'Saving…'
          : `${expense ? 'Save changes' : 'Add expense'}${amountCents !== null && amountCents > 0 ? ` · ${formatCents(amountCents)}` : ''}`}
      </button>
      <hr class="rule" style="margin-top:8px;" />
      <div class="barcode" />
      <div class="barnum">DIVVY · {date.slice(5, 7)}/{date.slice(8, 10)}/{date.slice(0, 4)}</div>
    </div>
  );
}

/**
 * Toggleable member chips, plus one quick-chip per Party that toggles all its
 * members at once ("The Randells"). Used for payers, participants, and
 * item assignees so all three selectors feel the same.
 */
function MemberChips({
  members,
  selected,
  onChange,
  size,
  children,
}: {
  members: MemberRecord[];
  selected: string[];
  onChange: (ids: string[]) => void;
  size?: 'sm';
  children?: ComponentChildren;
}) {
  const parties = groupParties(members);
  const cls = size ? `chip ${size}` : 'chip';
  const avatarSize = size === 'sm' ? 20 : 24;
  const partyChips = [...parties.values()].map(pm => {
    const ids = pm.map(m => m.id);
    const allOn = ids.every(id => selected.includes(id));
    return (
      <button
        key={pm[0]!.party}
        class={`${cls} party ${allOn ? 'on' : ''}`}
        onClick={() =>
          onChange(
            allOn
              ? selected.filter(s => !ids.includes(s))
              : [...selected, ...ids.filter(id => !selected.includes(id))],
          )
        }
      >
        {partyDisplayName(pm)}
      </button>
    );
  });
  // Parties always get their own row so they never blend in with people.
  return (
    <div class="chip-rows">
      <div class="chip-row wrap">
        {members.map(m => {
          const on = selected.includes(m.id);
          return (
            <button
              key={m.id}
              class={`${cls} with-avatar ${on ? 'on' : ''}`}
              onClick={() => onChange(on ? selected.filter(s => s !== m.id) : [...selected, m.id])}
            >
              <Avatar initials={personInitial(m.name)} color={colorForId(m.id)} size={avatarSize} />
              {m.name}
            </button>
          );
        })}
        {parties.size === 0 && children}
      </div>
      {parties.size > 0 && (
        <div class="chip-row wrap">
          {partyChips}
          {children}
        </div>
      )}
    </div>
  );
}

function PayerSum({
  payerIds,
  payerAmounts,
  amountCents,
}: {
  payerIds: string[];
  payerAmounts: Record<string, string>;
  amountCents: number | null;
}) {
  if (amountCents === null) return null;
  const sum = payerIds.reduce((a, id) => a + (parseAmount(payerAmounts[id] ?? '') ?? 0), 0);
  const ok = sum === amountCents;
  return (
    <p class={ok ? 'hint ok' : 'hint warn'}>
      Paid: {formatCents(sum)} {ok ? '✓' : `(expense is ${formatCents(amountCents)})`}
    </p>
  );
}

function PercentSum({ percents, members }: { percents: Record<string, string>; members: MemberRecord[] }) {
  const sum = members.reduce((a, m) => a + (parseFloat(percents[m.id] ?? '') || 0), 0);
  const ok = Math.abs(sum - 100) <= 0.01;
  return (
    <div class={`pct-sum${ok ? '' : ' muted'}`}>
      Total {Number(sum.toFixed(2))}% — {ok ? 'ok' : 'needs 100%'}
    </div>
  );
}

function ItemEditor({
  items,
  setItems,
  members,
  amountCents,
  scanState,
  onScan,
}: {
  items: AssignedItem[];
  setItems: (updater: AssignedItem[] | ((prev: AssignedItem[]) => AssignedItem[])) => void;
  members: MemberRecord[];
  amountCents: number | null;
  scanState: 'idle' | 'working';
  onScan: (file: File) => void;
}) {
  const [draftLabel, setDraftLabel] = useState('');
  const [draftPrice, setDraftPrice] = useState('');

  const itemSum = items.reduce((a, i) => a + i.cents, 0);
  const extras = amountCents !== null ? amountCents - itemSum : null;
  const unassigned = items.filter(i => i.assignees.length === 0).length;

  function setAssignees(idx: number, assignees: string[]) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, assignees } : it)));
  }

  function assignAll(idx: number) {
    setItems(prev =>
      prev.map((it, i) => (i === idx ? { ...it, assignees: members.map(m => m.id) } : it)),
    );
  }

  function editPrice(idx: number) {
    const item = items[idx]!;
    const answer = prompt(`Price for "${item.label}"`, (item.cents / 100).toFixed(2));
    if (answer === null) return;
    const cents = parseAmount(answer.startsWith('-') ? answer.slice(1) : answer);
    if (cents === null) return;
    const signed = answer.startsWith('-') ? -cents : cents;
    setItems(items.map((it, i) => (i === idx ? { ...it, cents: signed } : it)));
  }

  function addDraft() {
    const cents = parseAmount(draftPrice);
    if (!draftLabel.trim() || cents === null) return;
    setItems([...items, { label: draftLabel.trim(), cents, assignees: [] }]);
    setDraftLabel('');
    setDraftPrice('');
  }

  return (
    <div class="item-editor">
      {scanState === 'working' ? (
        <div class="scan-status">
          <div class="spinner" /> Reading receipt…
        </div>
      ) : (
        <label class="btn scan-btn">
          {items.length ? 'Rescan receipt' : 'Scan receipt'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) onScan(file);
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </label>
      )}

      {items.length > 0 && (
        <>
          <p class="hint sans">
            Tap names to assign each line. Shared items split evenly; tax &amp; tip follow what each person ordered.
          </p>
          <ul class="item-list">
            {items.map((item, idx) => (
              <li key={idx} class={`item ${item.assignees.length === 0 ? 'unassigned' : ''}`}>
                <div class="item-head">
                  <span class="item-label">{item.label}</span>
                  <span class="lead" />
                  <button class="item-price" onClick={() => editPrice(idx)}>
                    {formatCents(item.cents)}
                  </button>
                  <button
                    class="item-remove"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </div>
                <MemberChips
                  members={members}
                  size="sm"
                  selected={item.assignees}
                  onChange={ids => setAssignees(idx, ids)}
                >
                  <button class="chip sm ghost" onClick={() => assignAll(idx)}>
                    everyone
                  </button>
                </MemberChips>
              </li>
            ))}
          </ul>

          <div class="totals-line">
            <div class="li"><span class="nm muted">Items</span><span class="lead" /><span class="amt">{formatCents(itemSum)}</span></div>
            {extras !== null && (
              <div class={`li ${extras < 0 ? 'warn' : ''}`}>
                <span class="nm muted">Tax &amp; tip · proportional</span><span class="lead" /><span class="amt">{formatCents(extras)}</span>
              </div>
            )}
          </div>
          {unassigned > 0 && (
            <p class="hint warn">
              {unassigned} item{unassigned > 1 ? 's' : ''} not assigned to anyone yet
            </p>
          )}
        </>
      )}

      <div class="inline-add">
        <input
          value={draftLabel}
          placeholder="Add item"
          onInput={e => setDraftLabel((e.target as HTMLInputElement).value)}
        />
        <input
          class="price"
          inputMode="decimal"
          value={draftPrice}
          placeholder="0.00"
          onInput={e => setDraftPrice((e.target as HTMLInputElement).value)}
        />
        <button class="btn" onClick={addDraft}>
          Add
        </button>
      </div>
    </div>
  );
}
