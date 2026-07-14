// Deterministic avatar colors and initials for the link-preview card's member
// stack. A runtime-neutral copy of the app's src/lib/avatar.ts (the og render
// pipeline is plain JS and can't pull in the TS app bundle) — keep the palette
// and hashing in sync with that file so a member's card tile matches the app.

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
export function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** One person: first letter of their name, uppercased. */
export function personInitial(name) {
  return (name.trim()[0] ?? '?').toUpperCase();
}
