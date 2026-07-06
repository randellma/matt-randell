/** Deterministic avatar colors and initials, matching the Elevated design's palette. */

const PALETTE = [
  '#0E9E6E', // green
  '#2E8B84', // teal
  '#C0872A', // gold
  '#6E63B8', // purple
  '#4F8FD1', // blue
  '#B85C8A', // pink
  '#8FA83A', // olive
  '#D97B4F', // orange
];

/** Stable color for a member, hashed from their id so it survives reordering. */
export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

/** Balance-status color: green if owed, red if owing, muted if settled. */
export function colorForBalance(cents: number): string {
  return cents > 0 ? '#0B7A4E' : cents < 0 ? '#B84A38' : '#9A9683';
}

/** One person: first letter of their name, uppercased. */
export function personInitial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

/** A group, party, or settlement unit: first two letters, uppercased. */
export function collectiveInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}
