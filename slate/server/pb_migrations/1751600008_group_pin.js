/// <reference path="../pb_data/types.d.ts" />

// Optional group PIN (see docs/adr/0003-optional-group-pin.md). A group may
// require a 4–6 digit PIN to join: its share link then carries only the group
// id, and a custom route (pb_hooks/group_security.pb.js) trades a correct PIN
// for the token. The PIN state lives on the group:
//
//   pin_on           — visible flag so the PWA knows which link form to share;
//                      writable only through the custom route (rules block it)
//   pin_hash/salt    — sha256(salt:pin); hidden, so never in API responses
//   pin_attempts     — consecutive wrong joins; joining locks at 10
//   recovery_email   — where "forgot the PIN" access links go; hidden
//   recovery_sent_at — unix seconds of the last recovery email, for cooldown
//
// Hidden fields can't be read or written through the record API at all; the
// visible `pin_on` (and `t`, which the enable flow rotates) get explicit
// :isset guards so the open create/update rules can't touch them either.

migrate(
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.fields.add(
      new Field({ name: 'pin_on', type: 'bool' }),
      new Field({ name: 'pin_hash', type: 'text', hidden: true, max: 64 }),
      new Field({ name: 'pin_salt', type: 'text', hidden: true, max: 64 }),
      new Field({ name: 'pin_attempts', type: 'number', hidden: true, onlyInt: true }),
      new Field({ name: 'recovery_email', type: 'text', hidden: true, max: 254 }),
      new Field({ name: 'recovery_sent_at', type: 'number', hidden: true, onlyInt: true }),
    );
    groups.createRule = '@request.body.pin_on:isset = false';
    groups.updateRule =
      't = @request.query.t && @request.body.pin_on:isset = false && @request.body.t:isset = false';
    app.save(groups);
  },
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    for (const name of ['pin_on', 'pin_hash', 'pin_salt', 'pin_attempts', 'recovery_email', 'recovery_sent_at']) {
      groups.fields.removeByName(name);
    }
    groups.createRule = '';
    groups.updateRule = 't = @request.query.t';
    app.save(groups);
  },
);
