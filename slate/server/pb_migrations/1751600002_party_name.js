/// <reference path="../pb_data/types.d.ts" />

// Optional display name for a party ("The Randells"). Stored on every member
// of the party (same denormalized style as the party key itself) so the name
// survives any single member being unlinked. Empty = default to joined names.

migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    members.fields.add(
      new Field({
        name: 'party_name',
        type: 'text',
        required: false,
        max: 60,
      }),
    );
    app.save(members);
  },
  (app) => {
    const members = app.findCollectionByNameOrId('members');
    members.fields.removeByName('party_name');
    app.save(members);
  },
);
