/// <reference path="../pb_data/types.d.ts" />

// Party linking: members sharing the same opaque `party` key act as one
// wallet in balances and settle-up (couples, families). Empty = solo.
// A plain text key (not a relation) keeps linking/unlinking a single field
// write with no extra collection to manage; display names are derived from
// the member names client-side ("Matt & Sarah").

migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    members.fields.add(
      new Field({
        name: 'party',
        type: 'text',
        required: false,
        max: 64,
      }),
    );
    app.save(members);
  },
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    members.fields.removeByName('party');
    app.save(members);
  },
);
