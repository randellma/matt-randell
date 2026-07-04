import { allocate, allocateEven } from './money';
import type { SplitEntry } from './split';

/** A line item as parsed from the receipt, with the members it's assigned to. */
export interface AssignedItem {
  label: string;
  cents: number;
  /** Member ids sharing this item. An item split N ways is shared evenly. */
  assignees: string[];
}

/**
 * The structured result of OCR parsing, before any assignment happens.
 * Field names match the JSON schema the server hook asks Claude for
 * (see server/pb_hooks/receipt_ocr_utils.js) — this is the stored wire format.
 */
export interface ParsedReceipt {
  merchant: string;
  items: { label: string; cents: number }[];
  subtotal_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  total_cents: number | null;
}

/**
 * Turn assigned receipt items into per-member owed amounts.
 *
 * Each item is split evenly among its assignees. Whatever remains between the
 * item sum and the receipt total (tax + tip + fees + rounding) is spread
 * proportionally to each member's item subtotal — the person who ordered the
 * $40 steak carries more of the tip than the person with the $6 side.
 *
 * Entries sum exactly to `totalCents`.
 */
export function computeItemized(items: AssignedItem[], totalCents: number): SplitEntry[] {
  const unassigned = items.filter(i => i.assignees.length === 0);
  if (unassigned.length > 0) {
    throw new Error(`unassigned items: ${unassigned.map(i => i.label).join(', ')}`);
  }

  const memberIds = [...new Set(items.flatMap(i => i.assignees))];
  const subtotals = new Map<string, number>(memberIds.map(id => [id, 0]));

  for (const item of items) {
    const shares = allocateEven(item.cents, item.assignees.length);
    item.assignees.forEach((member, i) => {
      subtotals.set(member, subtotals.get(member)! + shares[i]!);
    });
  }

  const itemSum = items.reduce((a, i) => a + i.cents, 0);
  const extras = totalCents - itemSum;

  // Weights for tax/tip: item subtotals, clamped so a discount-heavy member
  // doesn't get a negative weight. If nothing positive (all-free receipt),
  // fall back to an even split of the extras.
  const weights = memberIds.map(id => Math.max(0, subtotals.get(id)!));
  const extraShares = weights.some(w => w > 0)
    ? allocate(extras, weights)
    : allocateEven(extras, memberIds.length);

  return memberIds.map((member, i) => ({
    member,
    cents: subtotals.get(member)! + extraShares[i]!,
  }));
}
