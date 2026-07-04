import { useMemo, useState } from 'preact/hooks';
import { api } from '../app';
import type { ExpenseRecord, GroupRecord, MemberRecord, SplitData } from '../api';
import { formatCents, parseAmount } from '../lib/money';
import { computeEven, computePercent, computeShares, type SplitEntry, type SplitMode } from '../lib/split';
import { computeItemized, type AssignedItem } from '../lib/receipt';
import { prepareReceiptImage } from '../image';

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
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? me);
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

      <section class="card">
        <label class="field">
          <span>Description</span>
          <input
            value={description}
            placeholder="Dinner at Rosa's"
            onInput={e => setDescription((e.target as HTMLInputElement).value)}
          />
        </label>
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
            <span>Date</span>
            <input
              type="date"
              value={date}
              onInput={e => setDate((e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        <label class="field">
          <span>Paid by</span>
          <select value={paidBy} onInput={e => setPaidBy((e.target as HTMLSelectElement).value)}>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section class="card">
        <div class="mode-tabs">
          {MODES.map(m => (
            <button key={m.id} class={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'even' && (
          <div class="chip-row wrap">
            {members.map(m => {
              const on = participants.includes(m.id);
              return (
                <button
                  key={m.id}
                  class={`chip ${on ? 'on' : ''}`}
                  onClick={() =>
                    setParticipants(on ? participants.filter(p => p !== m.id) : [...participants, m.id])
                  }
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        )}

        {mode === 'percent' && (
          <div class="split-rows">
            {members.map(m => (
              <div key={m.id} class="split-row">
                <span class="split-name">{m.name}</span>
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
              </div>
            ))}
            <PercentSum percents={percents} members={members} />
          </div>
        )}

        {mode === 'shares' && (
          <div class="split-rows">
            {members.map(m => (
              <div key={m.id} class="split-row">
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
          <ItemEditor
            items={items}
            setItems={setItems}
            members={members}
            amountCents={amountCents}
            scanState={scanState}
            onScan={scanReceipt}
          />
        )}
      </section>

      <section class="card preview">
        <h2>Who owes what</h2>
        {preview.entries ? (
          <ul class="preview-list">
            {preview.entries.map(e => (
              <li key={e.member}>
                <span>{memberById.get(e.member)?.name ?? '?'}</span>
                <b>{formatCents(e.cents)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p class="hint">{preview.problem}</p>
        )}
      </section>

      {error && <p class="error">{error}</p>}

      <button class="btn primary big" onClick={save} disabled={busy || scanState === 'working'}>
        {busy ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
      </button>
    </div>
  );
}

function PercentSum({ percents, members }: { percents: Record<string, string>; members: MemberRecord[] }) {
  const sum = members.reduce((a, m) => a + (parseFloat(percents[m.id] ?? '') || 0), 0);
  const ok = Math.abs(sum - 100) <= 0.01;
  return (
    <p class={ok ? 'hint ok' : 'hint warn'}>
      Total: {Number(sum.toFixed(2))}% {ok ? '✓' : '(needs to be 100%)'}
    </p>
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

  function toggle(idx: number, memberId: string) {
    setItems(prev =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const assignees = it.assignees.includes(memberId)
          ? it.assignees.filter(a => a !== memberId)
          : [...it.assignees, memberId];
        return { ...it, assignees };
      }),
    );
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
          📷 {items.length ? 'Rescan receipt' : 'Scan receipt'}
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
          <p class="hint">
            Tap names to assign each item. Items with several people are split between them.
          </p>
          <ul class="item-list">
            {items.map((item, idx) => (
              <li key={idx} class={`item ${item.assignees.length === 0 ? 'unassigned' : ''}`}>
                <div class="item-head">
                  <span class="item-label">{item.label}</span>
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
                <div class="chip-row wrap">
                  {members.map(m => (
                    <button
                      key={m.id}
                      class={`chip sm ${item.assignees.includes(m.id) ? 'on' : ''}`}
                      onClick={() => toggle(idx, m.id)}
                    >
                      {m.name}
                    </button>
                  ))}
                  <button class="chip sm ghost" onClick={() => assignAll(idx)}>
                    everyone
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div class="totals-line">
            <span>Items: {formatCents(itemSum)}</span>
            {extras !== null && (
              <span class={extras < 0 ? 'warn' : ''}>
                Tax & tip: {formatCents(extras)} (split proportionally)
              </span>
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
