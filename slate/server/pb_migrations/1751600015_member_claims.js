/// <reference path="../pb_data/types.d.ts" />

// Claims (docs/adr/0005-claims-link-members-to-accounts.md): an optional link
// from a member to an account — `members.user`. Soft by design: a claimed
// member leaves everyone else's identity picker and wears a badge, and
// nothing else changes. Everything about the member (name, photo, party,
// removed) stays group-editable under the token rule; the rules below guard
// only the link itself:
//
//   • Only the signed-in account can set `user`, and only to itself — nobody
//     claims on another's behalf, signed-out requests can't touch it.
//   • A member already claimed by someone else can't be re-claimed; the
//     claimant may re-assert its own claim (idempotent auto-claim).
//   • Only the claimant can release (clear) the link.
//   • One claim per account per group, enforced by a partial unique index —
//     "wherever you hold a claim you *are* that member", so two would be
//     ambiguous.
//
// Creating a member born claimed ("add yourself" while signed in, and the
// pre-added creator of a new group) is allowed under the same self-only rule.
//
// The relation deliberately does NOT cascade: deleting an account must not
// take the member — the group's ledger — with it. A dangling ref reads as
// unclaimed, same stance as receipts.credit_user.

migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    const users = app.findCollectionByNameOrId('users');

    members.fields.add(
      new Field({
        name: 'user',
        type: 'relation',
        required: false,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );

    const tokenRule = 'group.t = @request.query.t';
    // `user` untouched (or explicitly empty) keeps plain group edits working
    // exactly as before; setting it needs a signed-in account claiming itself.
    members.createRule =
      `${tokenRule} && (@request.body.user:isset = false || @request.body.user = '' || ` +
      `(@request.auth.id != '' && @request.body.user = @request.auth.id))`;
    members.updateRule =
      `${tokenRule} && (@request.body.user:isset = false || ` +
      // release: only the claimant clears its own link
      `(@request.auth.id != '' && @request.body.user = '' && user = @request.auth.id) || ` +
      // claim: only to yourself, and never over someone else's claim
      `(@request.auth.id != '' && @request.body.user = @request.auth.id && (user = '' || user = @request.auth.id)))`;

    members.indexes = [
      ...members.indexes,
      "CREATE UNIQUE INDEX idx_members_group_user ON members (`group`, `user`) WHERE `user` != ''",
    ];
    app.save(members);
  },
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    members.indexes = members.indexes.filter((idx) => !idx.includes('idx_members_group_user'));
    members.fields.removeByName('user');
    members.createRule = 'group.t = @request.query.t';
    members.updateRule = 'group.t = @request.query.t';
    app.save(members);
  },
);
