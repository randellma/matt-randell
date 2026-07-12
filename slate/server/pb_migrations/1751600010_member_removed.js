/// <reference path="../pb_data/types.d.ts" />

// Removing a member. Two shapes, decided client-side by whether any expense or
// payment still points at the member:
//
//   • Never referenced (an accidental add) — the record is hard-deleted. The
//     cascade wired up in 1751600009 has nothing to take with it, so this is
//     safe: no expense/payment references the member.
//   • Referenced by history — the record is kept and flagged `removed`. History
//     keeps resolving the member's name, and Balances keep summing to zero,
//     but the member drops out of every forward-facing picker. A hard delete
//     here would (via that same cascade) wipe the very expenses we want to
//     preserve — hence the flag.
//
// `removed` is a plain visible bool under the existing token rules; the PWA
// sets it (and clears the member's party) in one update, and can clear it again
// to restore. Removal is gated in the UI to members whose net balance is zero.

migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    members.fields.add(new Field({ name: 'removed', type: 'bool' }));
    app.save(members);
  },
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    members.fields.removeByName('removed');
    app.save(members);
  },
);
